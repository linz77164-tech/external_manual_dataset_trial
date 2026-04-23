#!/bin/bash
# ============================================================
# reproduce.sh — Install dependencies and start dev server
# ============================================================
set -e

echo "=== MorphingText Reproduce ==="
echo ""

# Navigate to final/ directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/final"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js >= 18."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5

echo ""

# Start dev server
echo "Starting Next.js dev server on http://localhost:3001 ..."
echo "Press Ctrl+C to stop."
echo ""
npx next dev -p 3001
