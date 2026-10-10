AgentCraft 本地离线演示包
=========================

无需联网、无需 npm 下载即可运行六章 MVP。

运行方式
--------
Windows：双击 start.cmd
macOS/Linux：sh start.sh
或：node server/index.js

然后打开浏览器访问： http://localhost:8787

说明
----
- 默认端口 8787；可用环境变量 PORT 覆盖。
- 该演示包内置服务端与网页产物，以及运行所需依赖（node_modules 已包含）。
- 六章均在浏览器内的「模拟模式」运行，无需任何 API Key。
- 若需真实模型模式，请设置 MODEL_API_KEY（密钥仅在服务端），并确认网络可达。
- 运行记录保存在 data/ 目录（SQLite；不可用时降级为 JSON）。

目录
----
server/        构建后的服务端（同时托管网页与 API/SSE）
web/           构建后的网页静态资源
node_modules/  离线运行依赖
start.cmd / start.sh  启动脚本

版本
----
对应 AgentCraft 规划 v1.4（2026-10-09）。
