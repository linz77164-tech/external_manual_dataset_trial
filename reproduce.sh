#!/bin/bash
set -e

echo "=== OTPInput 组件 - 复现脚本 ==="

cd final
echo "[1/3] 安装依赖..."
pnpm install

echo "[2/3] 生成类型..."
pnpm run dev:prepare

echo "[3/3] 启动开发服务器..."
pnpm run dev
