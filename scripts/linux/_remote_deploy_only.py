#!/usr/bin/env python3
"""Deploy existing lan-exam-src.tgz: clean extract, docker build, nginx."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[2]
TARBALL = ROOT / "lan-exam-src.tgz"
password = (ROOT / ".deploy-ssh-password").read_text(encoding="utf-8").strip()
host = os.environ.get("SSH_HOST", "49.234.177.185")
user = os.environ.get("SSH_USER", "ubuntu")
web_port = os.environ.get("WEB_HOST_PORT", "8001")


def emit(text: str) -> None:
    if not text:
        return
    line = text.rstrip() + "\n"
    buf = getattr(sys.stdout, "buffer", None)
    if buf is not None:
        buf.write(line.encode("utf-8", errors="replace"))
        buf.flush()


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> int:
    print(f"\n>>> {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    code = stdout.channel.recv_exit_status()
    emit(stdout.read().decode("utf-8", errors="replace"))
    emit(stderr.read().decode("utf-8", errors="replace"))
    return code


def main() -> int:
    if not TARBALL.is_file():
        print(f"Missing {TARBALL}", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"==> Connecting {user}@{host}")
    client.connect(host, username=user, password=password, timeout=30, allow_agent=False, look_for_keys=False)

    remote_tar = f"/home/{user}/lan-exam-src.tgz"
    remote_dir = f"/home/{user}/LAN_exam"
    staging = f"/home/{user}/LAN_exam_staging"

    print(f"==> Uploading {TARBALL.stat().st_size // (1024 * 1024)} MB")
    sftp = client.open_sftp()
    last = 0.0
    total = TARBALL.stat().st_size

    def progress(done: int, total_size: int) -> None:
        nonlocal last
        now = time.time()
        if now - last >= 1.5 or done == total_size:
            pct = 100.0 * done / total_size if total_size else 0
            print(f"    {done // (1024 * 1024)} / {total_size // (1024 * 1024)} MB ({pct:.0f}%)")
            last = now

    sftp.put(str(TARBALL), remote_tar, callback=progress)
    sftp.close()
    print("==> Upload done")

    run(client, f"rm -rf {staging} && mkdir -p {staging}", 120)
    run(client, f"tar -xzf {remote_tar} -C {staging}", 300)
    run(client, f"find {staging}/scripts/linux -type f -name '*.sh' -exec sed -i 's/\\r$//' {{}} +", 60)
    run(
        client,
        f"test -f {remote_dir}/.env.deploy && cp {remote_dir}/.env.deploy {staging}/.env.deploy || true",
        30,
    )
    run(client, f"rm -rf {remote_dir} && mv {staging} {remote_dir}", 120)

    code = run(
        client,
        f"cd {remote_dir} && chmod +x scripts/linux/deploy-docker.sh && "
        "sg docker -c 'ADMIN_REMOTE=true bash scripts/linux/deploy-docker.sh' 2>&1 || "
        "ADMIN_REMOTE=true bash scripts/linux/deploy-docker.sh 2>&1",
        3600,
    )
    if code != 0:
        client.close()
        return code

    print("==> Updating nginx: port 80 -> LAN Exam")
    nginx = (
        "sudo cp /etc/nginx/conf.d/mood_monitor.conf "
        "/etc/nginx/conf.d/mood_monitor.conf.bak.$(date +%Y%m%d%H%M%S) && "
        f"sudo sed -i 's|proxy_pass http://127.0.0.1:5051;|proxy_pass http://127.0.0.1:{web_port};|g' "
        "/etc/nginx/conf.d/mood_monitor.conf && "
        "sudo nginx -t && sudo systemctl reload nginx"
    )
    run(client, nginx, 120)
    run(client, f"curl -sf http://127.0.0.1:{web_port}/health && echo && curl -sf http://127.0.0.1/health", 60)
    run(
        client,
        f"cd {remote_dir} && docker compose --env-file .env.deploy "
        "-f docker-compose.yml -f docker-compose.host-app.yml ps",
        60,
    )
    client.close()
    print(f"\n==> Done: http://{host}/exam/login")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
