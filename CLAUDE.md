# CLAUDE.md — appstle-shopify-plugin

Claude Code plugin providing Appstle Subscription API access for Shopify stores via a thin MCP server + skill.

## Commands

```bash
cd server && npm install          # Install dependencies
cd server && npm run build        # Compile TypeScript (outputs to server/dist/)
cd server && npm start            # Start MCP server directly (needs APPSTLE_API_KEY)
bash server/start.sh              # Start with .env auto-loading (how Claude Code launches it)
```

No tests, no linter configured in this plugin.

## Architecture

**Two components, one tool:**

1. **MCP Server** (`server/`): Exposes a single `appstle_api` tool via stdio transport. Handles auth (X-API-Key header + `api_key` query param) and HTTP transport. All endpoint knowledge lives in the skill, not the server.

2. **Skill** (`skills/appstle-shopify/`): Loaded on demand by Claude Code when subscription topics are detected. Contains endpoint catalog, API quirks, safety rules, response shapes, and workflow playbooks. Zero token cost when not in use.

```
.claude-plugin/plugin.json     # Plugin manifest
.mcp.json                      # MCP server registration (no env block — start.sh handles env)
server/
  start.sh                     # Shell wrapper: loads .env, sets APPSTLE_BASE_URL default, starts node
  src/index.ts                 # MCP server entry — registers appstle_api tool
  src/client.ts                # AppstleApiClient class — generic HTTP client
  src/types.ts                 # AppstleErrorResponse type only
  dist/                        # Compiled JS (gitignored)
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
| `server/start.sh` | Env loading + `APPSTLE_BASE_URL` default + server start |
| `server/src/index.ts` | Single tool registration, stdio transport |
| `server/src/client.ts` | HTTP client with dual auth (header + query param) |
| `skills/appstle-shopify/SKILL.md` | Primary skill — all endpoint docs and safety rules |

## Gotchas

1. **No `env` block in `.mcp.json`**: Claude Code validates MCP env vars before the server starts. Shell variable expansions like `${APPSTLE_API_KEY:-}` resolve to empty, causing "Missing environment variables" errors. All env loading is handled by `start.sh` at runtime instead.

2. **Dual auth required**: The Appstle API requires BOTH `X-API-Key` header AND `api_key` query parameter. The client adds both automatically (`client.ts:44`). Removing either breaks certain endpoints (notably activity-logs).

3. **PUT endpoints use query params, not body**: Almost all PUT endpoints pass data as query parameters. Only three exceptions use request body: `add-line-items`, `remove-line-items`, `update-shipping-address`.

4. **stdout is reserved for JSON-RPC**: All logging MUST go to `stderr` via `console.error()`. Using `console.log()` corrupts the MCP stdio transport.

5. **Version in five places**: See Release Workflow section below. All must stay in sync.

6. **`.env` search paths in `start.sh`**: Searches CWD-relative paths first, then `CLAUDE_PLUGIN_ROOT`-relative paths. If the plugin is installed in a non-standard location, the `CLAUDE_PLUGIN_ROOT` paths ensure `.env` is still found.

## Environment Variables

| Variable | Required | Default | Loaded by |
|----------|----------|---------|-----------|
| `APPSTLE_API_KEY` | Yes | — | `start.sh` from `.env` or shell |
| `APPSTLE_BASE_URL` | No | `https://subscription-admin.appstle.com` | `start.sh` fallback |

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
