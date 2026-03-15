#!/bin/bash
# Appstle Shopify Plugin — MCP Server Launcher
# Loads APPSTLE_* env vars from .env if not already set, then starts the server.

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

# Try to find project root via git (covers subdirectory CWD scenarios)
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

# If APPSTLE_API_KEY is not in environment, try loading from .env files
if [ -z "$APPSTLE_API_KEY" ]; then
  # Search order: CWD relatives → CLAUDE_PLUGIN_ROOT relatives → script-relative
  for candidate in \
    ".env" \
    "../.env" \
    "../../.env" \
    "../../../.env" \
    "$CLAUDE_PLUGIN_ROOT/../.env" \
    "$CLAUDE_PLUGIN_ROOT/../../.env" \
    "$SCRIPT_DIR/../.env" \
    "$SCRIPT_DIR/../../.env" \
    "$SCRIPT_DIR/../../../.env" \
    "${GIT_ROOT:+$GIT_ROOT/.env}" \
    "$HOME/Work/eisenhorn/eisenhorn-astro/.env" \
    "$HOME/.env"; do
    if [ -f "$candidate" ] && grep -q "APPSTLE_API_KEY" "$candidate" 2>/dev/null; then
      export $(grep -E '^APPSTLE_' "$candidate" | xargs)
      break
    fi
  done
fi

# Default APPSTLE_BASE_URL if not set (previously in .mcp.json env block)
APPSTLE_BASE_URL="${APPSTLE_BASE_URL:-https://subscription-admin.appstle.com}"
export APPSTLE_BASE_URL

if [ -z "$APPSTLE_API_KEY" ]; then
  echo "[appstle-shopify] ERROR: APPSTLE_API_KEY not found." >&2
  echo "[appstle-shopify] Set it in your shell: export APPSTLE_API_KEY=your-key" >&2
  echo "[appstle-shopify] Or add it to your project .env file: APPSTLE_API_KEY=your-key" >&2
  exit 1
fi

exec node "$SCRIPT_DIR/dist/index.js"
