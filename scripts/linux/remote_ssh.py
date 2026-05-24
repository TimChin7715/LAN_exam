#!/usr/bin/env python3
"""Password-based remote Linux Docker deploy helpers (testing only).

Requires: pip install paramiko

Environment:
  SSH_HOST       (required) — server hostname or IP
  SSH_USER       (required) — SSH username
  SSH_PASSWORD   — password, or use repo-root .deploy-ssh-password (gitignored)
  WEB_HOST_PORT  — optional, for diag (default 8001)

Subcommands:
  deploy  — upload lan-exam-src.tgz, extract, run deploy-docker.sh
  finish  — re-upload compose + deploy script, rerun deploy-docker.sh
  diag    — health checks and compose status on the server
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[2]
TARBALL = ROOT / "lan-exam-src.tgz"

FINISH_UPLOADS = (
    "scripts/linux/deploy-docker.sh",
    "docker-compose.yml",
    "docker-compose.host-app.yml",
)


def remote_paths(user: str) -> tuple[str, str, str]:
    home = f"/home/{user}"
    return f"{home}/lan-exam-src.tgz", f"{home}/LAN_exam", home


def load_config() -> tuple[str, str, str]:
    host = os.environ.get("SSH_HOST", "").strip()
    user = os.environ.get("SSH_USER", "").strip()
    password = os.environ.get("SSH_PASSWORD", "").strip()
    pass_file = ROOT / ".deploy-ssh-password"
    if not password and pass_file.is_file():
        password = pass_file.read_text(encoding="utf-8").strip()

    if not host:
        print("Set SSH_HOST (server IP or hostname).", file=sys.stderr)
        sys.exit(1)
    if not user:
        print("Set SSH_USER (e.g. ubuntu).", file=sys.stderr)
        sys.exit(1)
    if not password:
        print(
            "Set SSH_PASSWORD or create .deploy-ssh-password from .deploy-ssh-password.example.",
            file=sys.stderr,
        )
        sys.exit(1)
    return host, user, password


def connect(host: str, user: str, password: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"==> Connecting {user}@{host}")
    client.connect(
        host,
        username=user,
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def run(
    client: paramiko.SSHClient,
    cmd: str,
    timeout: int = 3600,
) -> tuple[int, str, str]:
    print(f"\n>>> {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out.rstrip())
    if err:
        print(err.rstrip(), file=sys.stderr)
    return exit_code, out, err


def remote_deploy_cmd(remote_dir: str) -> str:
    return (
        f"cd {remote_dir} && chmod +x scripts/linux/deploy-docker.sh && "
        "sg docker -c 'bash scripts/linux/deploy-docker.sh' 2>/dev/null || "
        "bash scripts/linux/deploy-docker.sh"
    )


def cmd_deploy(client: paramiko.SSHClient, user: str) -> int:
    remote_tar, remote_dir, _ = remote_paths(user)

    if not TARBALL.is_file():
        print(f"Missing {TARBALL} — pack from repo root first (see docs/DEPLOY-LINUX-TEST.md).", file=sys.stderr)
        return 1

    run(client, "mkdir -p ~/.ssh && chmod 700 ~/.ssh || true", timeout=60)

    print(f"==> Uploading {TARBALL.name} ({TARBALL.stat().st_size // (1024 * 1024)} MB)")
    sftp = client.open_sftp()
    last = 0.0
    total = TARBALL.stat().st_size

    def progress(done: int, total_size: int) -> None:
        nonlocal last
        now = time.time()
        if now - last >= 2.0 or done == total_size:
            pct = 100.0 * done / total_size if total_size else 0
            print(f"    {done // (1024 * 1024)} / {total_size // (1024 * 1024)} MB ({pct:.0f}%)")
            last = now

    sftp.put(str(TARBALL), remote_tar, callback=progress)
    sftp.close()
    print("==> Upload done")

    code, _, _ = run(client, "command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1")
    if code != 0:
        print("==> Installing Docker (first time on server)...")
        install = (
            "sudo apt-get update -qq && "
            "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 && "
            f"sudo usermod -aG docker {user}"
        )
        run(client, install, timeout=600)
        print("==> Docker installed; group change may require re-login — trying sg docker")

    run(client, f"mkdir -p {remote_dir}")
    run(client, f"tar -xzf {remote_tar} -C {remote_dir}", timeout=300)
    code, _, _ = run(client, remote_deploy_cmd(remote_dir), timeout=3600)
    if code != 0:
        return code
    print("\n==> Remote deploy script finished.")
    return 0


def cmd_finish(client: paramiko.SSHClient, user: str) -> int:
    _, remote_dir, _ = remote_paths(user)
    sftp = client.open_sftp()
    for rel in FINISH_UPLOADS:
        local_f = ROOT / rel
        remote_f = f"{remote_dir}/{rel.replace(chr(92), '/')}"
        sftp.put(str(local_f), remote_f)
        print(f"==> Uploaded {rel}")
    sftp.close()
    run(
        client,
        f"find {remote_dir}/scripts/linux -type f -name '*.sh' -exec sed -i 's/\\r$//' {{}} +",
    )
    code, _, _ = run(client, remote_deploy_cmd(remote_dir), timeout=3600)
    return code


def cmd_diag(client: paramiko.SSHClient, host: str) -> int:
    web_port = os.environ.get("WEB_HOST_PORT", "8001")
    compose = (
        f"cd ~/LAN_exam && docker compose --env-file .env.deploy "
        f"-f docker-compose.yml -f docker-compose.host-app.yml"
    )
    run(client, f"{compose} ps", timeout=60)
    run(client, f"ss -tln | grep {web_port} || echo 'no {web_port} listen'", timeout=60)
    run(client, f"curl -sf http://127.0.0.1:{web_port}/health || echo health_fail", timeout=60)
    run(client, f"curl -sI http://127.0.0.1:{web_port}/exam/login | head -5", timeout=60)
    run(client, f"curl -s -o /dev/null -w '%{{http_code}}' http://{host}:{web_port}/exam/login", timeout=60)
    run(client, f"curl -s -o /dev/null -w '%{{http_code}}' http://{host}:{web_port}/health", timeout=60)
    run(client, f"{compose} logs app --tail 40", timeout=60)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="LAN Exam Linux test deploy over SSH (paramiko).")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("deploy", help="full tarball upload + deploy-docker.sh")
    sub.add_parser("finish", help="re-upload compose files and redeploy")
    sub.add_parser("diag", help="remote health and compose checks")
    args = parser.parse_args()

    host, user, password = load_config()
    client = connect(host, user, password)
    try:
        if args.command == "deploy":
            return cmd_deploy(client, user)
        if args.command == "finish":
            return cmd_finish(client, user)
        if args.command == "diag":
            return cmd_diag(client, host)
    finally:
        client.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
