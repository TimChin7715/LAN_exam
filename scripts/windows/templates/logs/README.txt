LAN Exam — 安装与运行日志说明
================================

安装或修复后，请优先查看本目录下的 install.log（按时间顺序记录各安装步骤）。

文件说明
--------
install.log     — 安装全流程：write-env、install-db、verify-install、端口释放、迁移/种子等
initdb.log      — 首次 initdb 的完整输出（仅新装）
postgres.log    — Postgres 启动日志（pg_ctl）
seed.log        — prisma db seed 输出
app.log         — Node 应用 stdout（start-node / 托盘启动）
node-stderr.log — Node 进程 stderr
node-stdout.log — Node 进程 stdout（Fastify/pino 日志，启动失败时重点查看）
debug-57b789.log — 内部诊断 NDJSON（一般可忽略）

排查建议
--------
1. 安装失败：打开 install.log，搜索 [ERROR]、[FAIL]、FATAL。
2. 数据库问题：同时看 initdb.log、postgres.log、install.log 中 prisma migrate/seed 段落。
3. 管理台/学员端打不开：看 app.log、node-stderr.log；确认 5180 未被占用。
4. 名单导入等 API 500：看 app.log 中启动后错误；确认 install.log 含 “install completed”。

日志路径示例：C:\Program Files\LAN Exam\logs\install.log
