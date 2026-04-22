#!/bin/bash
set -e

echo "=== Breadcrumb 组件增强 - 复现脚本 ==="

# 1. 安装依赖
echo "[1/5] 安装依赖..."
pnpm install

# 2. 生成类型
echo "[2/5] 生成类型..."
pnpm run dev:prepare

# 3. 运行 Lint 检查
echo "[3/5] 运行 Lint 检查..."
pnpm run lint

# 4. 运行类型检查
echo "[4/5] 运行类型检查..."
pnpm run typecheck

# 5. 运行 Breadcrumb 单元测试
echo "[5/5] 运行 Breadcrumb 单元测试..."
pnpm run test -- --run test/components/Breadcrumb.spec.ts

echo ""
echo "=== 所有检查通过！==="
echo ""
echo "如需启动 Playground 验证交互效果，请运行："
echo "  pnpm run dev"
echo "然后访问 http://localhost:3000"
