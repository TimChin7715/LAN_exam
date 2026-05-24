# Linux 服务器 Docker 测试部署

考场交付仍以 Windows `LAN-Exam-Setup.exe` 为准；本文档用于 **Ubuntu 等 Linux 上的 Docker 联调**（公网测试机、非考场离线包）。

## 1. 上传代码到服务器

在**本机**（项目根目录 `LAN_exam`）打包：

```powershell
cd E:\programs\LAN_exam
tar --exclude=node_modules --exclude=dist --exclude=.build --exclude=data -czf lan-exam-src.tgz .
```

### 方式 A：手动 SCP

```powershell
$env:SSH_HOST = "<服务器IP>"
$env:SSH_USER = "ubuntu"
scp lan-exam-src.tgz "${env:SSH_USER}@${env:SSH_HOST}:~/"
```

在 **SSH 会话**中解压：

```bash
mkdir -p ~/LAN_exam && tar -xzf ~/lan-exam-src.tgz -C ~/LAN_exam
cd ~/LAN_exam
```

### 方式 B：Python 一键远程部署（Windows 本机）

需 `pip install paramiko`，密码放在 gitignore 的 `.deploy-ssh-password`（见 `.deploy-ssh-password.example`）：

```powershell
$env:SSH_HOST = "<服务器IP>"
$env:SSH_USER = "ubuntu"
copy .deploy-ssh-password.example .deploy-ssh-password   # 编辑填入密码
python scripts/linux/remote_ssh.py deploy
```

仅重传 compose 与部署脚本并重新部署：

```powershell
python scripts/linux/remote_ssh.py finish
```

远程健康检查：

```powershell
python scripts/linux/remote_ssh.py diag
```

若使用 Git 远程仓库，也可在服务器上 `git clone` 后 `cd LAN_exam`，跳过 tarball。

## 2. 一键部署（默认宿主机端口 8001）

在**服务器**上（已解压到 `~/LAN_exam`）：

```bash
cd ~/LAN_exam
chmod +x scripts/linux/deploy-docker.sh
bash scripts/linux/deploy-docker.sh
```

脚本会：

- 宿主机 **Web/API 映射 `8001`**（可用 `WEB_HOST_PORT` 覆盖）
- Postgres 仅本机 `127.0.0.1:5434`
- 写入 **`.env.deploy`**（自动生成，已 gitignore，**不覆盖** 开发者本机 `.env`）
- 使用 `docker-compose.host-app.yml`（app 走 host 网络，SSH 隧道访问管理 API 才不被 loopback 拦截）
- `docker compose --env-file .env.deploy up -d --build`

可选自定义密钥：

```bash
export SESSION_SECRET='your-random-secret-at-least-16-chars'
bash scripts/linux/deploy-docker.sh
```

## 3. 访问方式

| 角色 | 方式 |
| --- | --- |
| 学员 | `http://<服务器公网IP>:<WEB端口>/exam/login` |
| 考官管理台 | 本机 `ssh -L 5180:127.0.0.1:<WEB端口> <SSH_USER>@<服务器IP>` 后打开 `http://127.0.0.1:5180/admin` |

默认对外端口为 **8001**（`http://<服务器IP>:8001/exam/login`）。

## 4. 防火墙与安全组

- **云厂商安全组**：放行 **TCP 8001**（或你设置的 `WEB_HOST_PORT`）
- **本机 ufw**：`deploy-docker.sh` 会自动执行 `ufw allow <端口>/tcp`；若仍不通，检查 `sudo ufw status`

学员端使用宿主机映射端口（默认 **8001**），不要用 5180（5180 仅用于你电脑 SSH 隧道访问管理台）。

## 5. 常用运维

```bash
cd ~/LAN_exam
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.host-app.yml logs -f app
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.host-app.yml ps
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.host-app.yml down
```

## 6. 与默认 compose 的差异

| 项 | 默认 `docker-compose.yml` | Linux 测试脚本 |
| --- | --- | --- |
| 宿主机 Web 端口 | `5180` | `8001`（`WEB_HOST_PORT`） |
| 环境文件 | `.env`（本地开发） | `.env.deploy`（服务器自动生成） |
| App 网络 | bridge + 端口映射 | `docker-compose.host-app.yml` → `network_mode: host` |
| 用途 | 开发 / 验收 | 公网联调 + SSH 隧道管理台 |

容器内应用仍监听 `5180`；host 模式下宿主机直接访问该端口。
