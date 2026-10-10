@echo off
REM AgentCraft 本地演示包启动脚本（Windows）
REM 内置离线运行依赖，无需现场 npm 下载。
cd /d "%~dp0"
echo 正在启动 AgentCraft 本地演示服务...
echo 打开浏览器访问： http://localhost:8787
node server\index.js
