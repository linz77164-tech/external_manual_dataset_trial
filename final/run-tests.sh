#!/bin/bash
set -e

echo "=== 运行 Breadcrumb 单元测试 ==="
pnpm run test -- --run test/components/Breadcrumb.spec.ts
