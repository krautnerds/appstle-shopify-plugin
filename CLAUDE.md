# CLAUDE.md — appstle-shopify-plugin

Claude Code plugin providing Appstle Subscription API access for Shopify stores via a thin MCP server + skill.

## Commands

```bash
cd server && npm install          # Install dependencies
cd server && npm run build        # Compile TypeScript (outputs to server/dist/)
cd server && npm start            # Start MCP server directly (needs APPSTLE_API_KEY)
bash server/start.sh              # Auto-bootstrap + start (how Claude Code launches it)
```

Query dump files (after an API response has been auto-dumped):
```bash
node server/dist/query.js /tmp/appstle_<slug>_<ts>.json "SELECT status, COUNT(*) as n FROM ? GROUP BY status"
```

Requires **Node >= 22**. No tests, no linter configured in this plugin.

## Architecture

**Two components, one tool:**

1. **MCP Server** (`server/`): Exposes a single `appstle_api` tool via stdio transport. Handles auth (X-API-Key header + `api_key` query param) and HTTP transport. All endpoint knowledge lives in the skill, not the server.

2. **Skill** (`skills/appstle-shopify/`): Loaded on demand by Claude Code when subscription topics are detected. Contains endpoint catalog, API quirks, safety rules, response shapes, and workflow playbooks. Zero token cost when not in use.

```
.claude-plugin/plugin.json     # Plugin manifest
.mcp.json                      # MCP server registration (no env block — dotenv handles env)
server/
  start.sh                     # Shell wrapper: auto-bootstrap only, then starts node
  src/index.ts                 # MCP server entry — dotenv loading, registers appstle_api tool, auto-dump logic
  src/client.ts                # AppstleApiClient class — generic HTTP client
  src/query.ts                 # Standalone CLI: SQL queries on dump files via alasql
  src/types.ts                 # AppstleErrorResponse type only
  dist/                        # Compiled JS (gitignored)
  .gitignore                   # Covers node_modules/ and dist/
skills/appstle-shopify/
  SKILL.md                     # Endpoint quick map, API quirks, safety rules
  references/endpoints.md      # Full parameter reference per endpoint
  references/response-shapes.md # Example JSON responses
  examples/workflows.md        # Step-by-step playbooks
```

## Key Files

| File | Purpose |
|------|---------|
| `.mcp.json` | Server registration — intentionally has NO `env` block (see Gotchas #1) |
| `server/start.sh` | Auto-bootstrap only (npm install + build if dist missing), then exec node |
| `server/src/index.ts` | Dotenv loading, single tool registration, stdio transport |
| `server/src/client.ts` | HTTP client with dual auth (header + query param) |
| `server/src/query.ts` | Standalone SQL query script for dump files (compiled to `dist/query.js`) |
| `skills/appstle-shopify/SKILL.md` | Primary skill — all endpoint docs and safety rules |

## Gotchas

1. **No `env` block in `.mcp.json`**: Claude Code validates MCP env vars before the server starts. Shell variable expansions like `${APPSTLE_API_KEY:-}` resolve to empty, causing "Missing environment variables" errors. All env loading is handled by `dotenv` in `index.ts` at runtime instead.

2. **Dual auth required**: The Appstle API requires BOTH `X-API-Key` header AND `api_key` query parameter. The client adds both automatically (`client.ts:44`). Removing either breaks certain endpoints (notably activity-logs).

3. **PUT endpoints use query params, not body**: Almost all PUT endpoints pass data as query parameters. Only three exceptions use request body: `add-line-items`, `remove-line-items`, `update-shipping-address`.

4. **stdout is reserved for JSON-RPC**: All logging MUST go to `stderr` via `console.error()`. Using `console.log()` corrupts the MCP stdio transport.

5. **Version in five places**: See Release Workflow section below. All must stay in sync.

6. **`.env` search paths in `index.ts`**: The `loadEnvFile()` function in `index.ts` searches CWD-relative paths first, then `CLAUDE_PLUGIN_ROOT`-relative, then script-dir-relative, then git root (via `execFileSync`), then `$HOME` fallbacks. Uses `dotenv.config()` on the first match containing `APPSTLE_API_KEY`.

7. **Auto-bootstrap in `start.sh`**: If `dist/index.js` is missing (e.g. plugin cache has no compiled JS), `start.sh` auto-runs `npm install && npm run build`. First launch takes ~5-10s extra. This is the only responsibility of `start.sh` — env loading is handled by Node.

8. **`APPSTLE_ENV_PATH` override**: Set `APPSTLE_ENV_PATH` to point at an `.env` file outside the normal search paths. It's checked first, before CWD-relative and other candidates. Contributors who keep their key in a non-standard location should `export APPSTLE_ENV_PATH=/path/to/.env`.

9. **Auto-dump for large responses**: API responses >4KB are written to `/tmp/appstle_{slug}_{timestamp}.json` and a compact summary is returned to Claude instead of the full JSON. This keeps Claude's context lean while preserving all data. Dump files older than 2 hours are cleaned up on server startup. Query dump files with: `node server/dist/query.js <file> "<SQL>"`.

10. **`alasql` is a runtime dependency**: The `query.js` script uses `alasql` (~1.5MB, pure JS) for SQL queries on dump files. It's bundled in `server/package.json` — no system-level dependencies required.

## Environment Variables

| Variable | Required | Default | Loaded by |
|----------|----------|---------|-----------|
| `APPSTLE_API_KEY` | Yes | — | `index.ts` via dotenv from `.env` or shell |
| `APPSTLE_BASE_URL` | No | `https://subscription-admin.appstle.com` | `index.ts` fallback |
| `APPSTLE_ENV_PATH` | No | — | Explicit path to `.env` file; checked first by `loadEnvFile()` |

## Release Workflow

When bumping the version for a release, follow this procedure exactly.

### 1. Determine version bump

Use [semver](https://semver.org/): `patch` for fixes, `minor` for features, `major` for breaking changes.

### 2. Update version in ALL five files

| File | What to change |
|------|----------------|
| `.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| `server/package.json` | `"version": "X.Y.Z"` |
| `server/src/index.ts` | `version: 'X.Y.Z'` in McpServer constructor |
| `README.md` | Badge on line 3: `version-X.Y.Z-blue` |
| `CHANGELOG.md` | Add new `## [X.Y.Z] - YYYY-MM-DD` section at top (below heading) |

Then run `cd server && npm install` to update `package-lock.json`.

### 3. Update CHANGELOG.md

Follow [Keep a Changelog](https://keepachangelog.com/) format. Add the new version section **above** existing entries. Use subsections: `### Added`, `### Changed`, `### Fixed`, `### Removed` — only include subsections that apply.

### 4. Commit and tag

```bash
git add .claude-plugin/plugin.json server/package.json server/package-lock.json server/src/index.ts README.md CHANGELOG.md
git commit -m "<type>: <description>"
git tag vX.Y.Z
```

Commit message prefix: `fix:` for patches, `feat:` for minor, `feat!:` or `breaking:` for major. Do NOT add any Co-Authored-By lines.

### 5. Verify

Confirm all five files show the same version and the tag exists: `git tag -l 'vX.Y.Z'`.

## Code Style

- Logging: `log()` helper → `console.error('[appstle]', ...)` — never `console.log` (see Gotcha #4)
- No `any` — use `unknown` with type assertions
- Custom `AppstleApiError` class wraps API error responses with status + detail
