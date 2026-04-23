#!/bin/bash
# ============================================================
# reproduce.sh — Install dependencies and start dev server
# ============================================================
set -e

echo "=== MorphingText Reproduce ==="
echo ""

# Navigate to final/apps/www directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/final/apps/www"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js >= 18."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies (from monorepo root)
echo "Installing dependencies..."
cd "$SCRIPT_DIR/final"
pnpm install 2>&1 | tail -5

echo ""

# Start dev server
echo "Starting Next.js dev server on http://localhost:3000 ..."
echo "Press Ctrl+C to stop."
echo ""
cd apps/www
pnpm dev
