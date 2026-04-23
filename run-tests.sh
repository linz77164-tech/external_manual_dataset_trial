#!/bin/bash
set -e

echo "=== 运行 Breadcrumb 测试 ==="

cd final
pnpm run test -- --run test/components/Breadcrumb.spec.ts
