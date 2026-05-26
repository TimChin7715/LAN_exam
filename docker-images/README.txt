LAN Exam Docker 离线镜像包
版本: 1.6.3
生成时间: 2026-05-26

包含文件:
  postgres-16.tar      (约 158 MB)  -> 镜像 postgres:16
  lan-exam-1.6.3.tar   (约 277 MB)  -> 镜像 lan-exam:1.6.3 与 lan-exam:latest

目标机导入（PowerShell / bash）:
  docker load -i postgres-16.tar
  docker load -i lan-exam-1.6.3.tar

启动（需同时拷贝项目根目录的 docker-compose.yml、.env 等）:
  cd <LAN_exam 项目根目录>
  docker compose up -d

验证:
  curl http://127.0.0.1:5180/health

重新打包（有网构建机）:
  .\scripts\docker\package-images.ps1
