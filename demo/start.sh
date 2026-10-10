#!/usr/bin/env sh
# AgentCraft 本地演示包启动脚本（macOS / Linux）
cd "$(dirname "$0")" || exit 1
echo "正在启动 AgentCraft 本地演示服务..."
echo "打开浏览器访问： http://localhost:8787"
node server/index.js
