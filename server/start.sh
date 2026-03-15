#!/bin/bash
# Appstle Shopify Plugin — MCP Server Launcher
# Auto-bootstraps on first run, then starts the Node server.
# Env loading (dotenv) is handled in index.ts.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-bootstrap: install deps + compile if dist is missing (e.g. plugin cache)
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
  echo "[appstle-shopify] First run — installing dependencies and compiling..." >&2
  (cd "$SCRIPT_DIR" && npm install 2>&1 | tail -3 >&2 && npm run build 2>&1 | tail -3 >&2)
  if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo "[appstle-shopify] ERROR: Build failed — dist/index.js not found after compile." >&2
    exit 1
  fi
fi

exec node "$SCRIPT_DIR/dist/index.js"
