#!/bin/bash
set -e

echo "=== 运行 OTPInput 单元测试 ==="
pnpm run test -- --run test/components/OTPInput.spec.ts
