#!/usr/bin/env python3
"""Temporarily allow remote admin access on Linux test server (SSH).

Usage (from repo root):
  set SSH_HOST / SSH_USER and .deploy-ssh-password
  python scripts/linux/remote_admin_open.py apply
  python scripts/linux/remote_admin_open.py restore
  python scripts/linux/remote_admin_open.py status
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "linux"))
from remote_ssh import connect, load_config, run  # noqa: E402

REMOTE_DIR = "~/LAN_exam"
COMPOSE_BASE = (
    f"cd {REMOTE_DIR} && docker compose --env-file .env.deploy "
    f"-f docker-compose.yml -f docker-compose.host-app.yml"
)
OVERRIDE_FILE = "docker-compose.admin-remote.yml"
WEB_PORT = "8001"

OVERRIDE_YAML = """# Temporary: remote admin for Linux test — remove with `restore`
services:
  app:
    environment:
      ADMIN_API_LOOPBACK_ONLY: 'false'
    build:
      args:
        VITE_ADMIN_ALLOW_REMOTE: 'true'
"""

ADMIN_AUTH_PATCH = r"""export function isLocalAdminHost(): boolean {
  if (import.meta.env.VITE_ADMIN_ALLOW_REMOTE === 'true') {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
"""

ADMIN_AUTH_ORIGINAL = r"""export function isLocalAdminHost(): boolean {
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
"""

DOCKERFILE_BUILD_ARG = """COPY apps/server apps/server
ENV VITE_ADMIN_AUTH_MODE=disabled
RUN pnpm exec prisma generate"""

DOCKERFILE_WITH_REMOTE = """COPY apps/server apps/server
ARG VITE_ADMIN_ALLOW_REMOTE=false
ENV VITE_ADMIN_AUTH_MODE=disabled
ENV VITE_ADMIN_ALLOW_REMOTE=${VITE_ADMIN_ALLOW_REMOTE}
RUN pnpm exec prisma generate"""


def remote_host_from_client(client: paramiko.SSHClient) -> str:
    transport = client.get_transport()
    if transport is None:
        return ""
    return transport.getpeername()[0]


def write_remote_file(sftp: paramiko.SFTPClient, path: str, content: str) -> None:
    with sftp.file(path, "w") as f:
        f.write(content)


def apply(client: paramiko.SSHClient, host: str) -> int:
    sftp = client.open_sftp()
    remote_root = f"/home/ubuntu/LAN_exam"

    write_remote_file(sftp, f"{remote_root}/{OVERRIDE_FILE}", OVERRIDE_YAML)

    auth_path = f"{remote_root}/apps/web/src/lib/admin-auth.ts"
    with sftp.file(auth_path, "r") as f:
        auth_src = f.read().decode("utf-8")
    if "VITE_ADMIN_ALLOW_REMOTE" not in auth_src:
        needle = "export function isLocalAdminHost(): boolean {"
        if needle not in auth_src:
            print("admin-auth.ts on server missing isLocalAdminHost; aborting.", file=sys.stderr)
            return 1
        auth_src = auth_src.replace(
            needle,
            "export function isLocalAdminHost(): boolean {\n"
            "  if (import.meta.env.VITE_ADMIN_ALLOW_REMOTE === 'true') {\n"
            "    return true;\n"
            "  }",
            1,
        )
        write_remote_file(sftp, auth_path, auth_src)

    dockerfile_path = f"{remote_root}/Dockerfile"
    with sftp.file(dockerfile_path, "r") as f:
        dockerfile = f.read().decode("utf-8")
    if "VITE_ADMIN_ALLOW_REMOTE" not in dockerfile:
        if DOCKERFILE_BUILD_ARG not in dockerfile:
            print("Dockerfile on server does not match expected shape; aborting.", file=sys.stderr)
            return 1
        dockerfile = dockerfile.replace(DOCKERFILE_BUILD_ARG, DOCKERFILE_WITH_REMOTE)
        write_remote_file(sftp, dockerfile_path, dockerfile)

    sftp.close()

    compose = f"{COMPOSE_BASE} -f {OVERRIDE_FILE}"
    code, _, _ = run(
        client,
        f"{compose} up -d --build",
        timeout=3600,
    )
    if code != 0:
        return code

    run(client, f"curl -s -o /dev/null -w 'admin_api:%{{http_code}}' http://{host}:{WEB_PORT}/api/admin/exams", timeout=60)
    print("\n==> Remote admin open applied.")
    print(f"    Admin UI: http://{host}:{WEB_PORT}/admin")
    print(f"    Restore:  python scripts/linux/remote_admin_open.py restore")
    return 0


def restore(client: paramiko.SSHClient) -> int:
    remote_root = "/home/ubuntu/LAN_exam"
    run(client, f"rm -f {remote_root}/{OVERRIDE_FILE}", timeout=60)

    sftp = client.open_sftp()
    auth_path = f"{remote_root}/apps/web/src/lib/admin-auth.ts"
    with sftp.file(auth_path, "r") as f:
        auth_src = f.read().decode("utf-8")
    remote_guard = "  if (import.meta.env.VITE_ADMIN_ALLOW_REMOTE === 'true') {\n    return true;\n  }\n"
    if remote_guard in auth_src:
        auth_src = auth_src.replace(remote_guard, "", 1)
        write_remote_file(sftp, auth_path, auth_src)

    dockerfile_path = f"{remote_root}/Dockerfile"
    with sftp.file(dockerfile_path, "r") as f:
        dockerfile = f.read().decode("utf-8")
    if DOCKERFILE_WITH_REMOTE in dockerfile:
        dockerfile = dockerfile.replace(DOCKERFILE_WITH_REMOTE, DOCKERFILE_BUILD_ARG)
        write_remote_file(sftp, dockerfile_path, dockerfile)
    sftp.close()

    code, _, _ = run(client, f"{COMPOSE_BASE} up -d --build", timeout=3600)
    print("\n==> Restored loopback-only admin (Linux test default).")
    return code


def status(client: paramiko.SSHClient, host: str) -> int:
    run(client, f"test -f ~/LAN_exam/{OVERRIDE_FILE} && echo override:yes || echo override:no", timeout=60)
    run(client, f"grep -n VITE_ADMIN_ALLOW_REMOTE ~/LAN_exam/apps/web/src/lib/admin-auth.ts || true", timeout=60)
    run(client, f"curl -s -o /dev/null -w 'admin_api:%{{http_code}}' http://{host}:{WEB_PORT}/api/admin/exams", timeout=60)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("apply", help="open admin to remote IP (rebuild app)")
    sub.add_parser("restore", help="restore loopback-only admin")
    sub.add_parser("status")
    args = parser.parse_args()

    host, user, password = load_config()
    client = connect(host, user, password)
    try:
        peer = remote_host_from_client(client) or host
        if args.command == "apply":
            return apply(client, peer)
        if args.command == "restore":
            return restore(client)
        if args.command == "status":
            return status(client, peer)
    finally:
        client.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
