#!/usr/bin/env bash
set -euo pipefail

# Locate repository root and Bazel test source directory
TEST_DIR="${TEST_SRCDIR:-$PWD}"
BIN_PATH=$(find "$TEST_DIR" -name "githelp" -type f -perm +111 2>/dev/null | grep -v "\.sh" | grep "backend/cmd/server" | head -n 1 || true)

mkdir -p bin
if [[ -n "$BIN_PATH" && -x "$BIN_PATH" ]]; then
  cp -f "$BIN_PATH" bin/githelp
elif [[ -x "./bin/githelp" ]]; then
  echo "Using existing ./bin/githelp"
fi

# Run Playwright
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"
NODE_PATH="${PWD}/frontend/node_modules" ./frontend/node_modules/.bin/playwright test --config=e2e/playwright.config.ts
