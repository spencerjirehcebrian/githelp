#!/usr/bin/env bash
set -euo pipefail

# Navigate to repo frontend directory
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT/frontend"
npm run test
