# Changelog

All notable changes to the appstle-shopify plugin will be documented in this file.

## [3.1.0] - 2026-03-15

### Added
- Auto-dump large API responses (>4KB) to `/tmp/appstle_*.json` with compact summaries returned to Claude
- Standalone SQL query script (`query.js`) powered by `alasql` for filtering, aggregating, and searching dump files
- Bulk data extraction workflow in skill playbooks
- `alasql` dependency (~1.5MB, pure JS) for SQL support

### Changed
- Page size guidance increased from max 10 to max 50 (dump files keep context lean)
- Replaced 80K-char truncation with threshold-based dump-to-file at 4KB
- Old dump files (>2h) automatically cleaned up on server startup

### Removed
- `MAX_RESPONSE_CHARS` constant and truncation logic

## [3.0.6] - 2026-03-15

### Fixed
- Oversized API responses (370K+ chars) no longer break tool results — server truncates at 80K chars with helpful message
- Added max page size guidance (`size` ≤ 10, default 5) to prevent unreadable responses

## [3.0.5] - 2026-03-15

### Changed
- Moved `.env` loading from shell (`start.sh`) to Node via `dotenv` in `index.ts` — more portable and easier to debug
- `start.sh` stripped to bootstrap-only (~18 lines, down from 54)
- Added `dotenv` dependency to `server/package.json`

## [3.0.4] - 2026-03-15

### Removed
- Dev-only release checklist hook (`hooks/hooks.json`) — caused duplicate hook errors and is redundant with CLAUDE.md release workflow
- `hooks` key from `plugin.json`

### Changed
- README version history now links to CHANGELOG.md for full release details

## [3.0.3] - 2026-03-15

### Fixed
- MCP server fails when launched from plugin cache (`dist/` and `node_modules/` not present) — `start.sh` now auto-bootstraps with `npm install && npm run build` on first run
- `.env` unreachable from cache directory — added git-root detection and `$HOME` fallback paths to `.env` search

### Changed
- `CLAUDE.md` updated with auto-bootstrap gotcha and revised key files table

## [3.0.2] - 2026-03-15

### Fixed
- `.env` discovery when launched by Claude Code from unknown CWD — added `SCRIPT_DIR`-relative search paths to `start.sh`
- Stop hook not firing — moved `hooks.json` from `.claude-plugin/` to `hooks/`, fixed format to event-keyed structure, added `hooks` reference in `plugin.json`

## [3.0.1] - 2026-03-15

### Fixed
- MCP server validation error ("Missing environment variables") by removing redundant `env` block from `.mcp.json`
- `.env` file discovery now uses `CLAUDE_PLUGIN_ROOT` for reliable path resolution regardless of working directory

### Added
- `CLAUDE.md` with plugin-specific development instructions and release workflow
- Stop hook (`.claude-plugin/hooks.json`) to enforce version sync and changelog on every session

### Changed
- `APPSTLE_BASE_URL` default fallback moved from `.mcp.json` to `start.sh`
- Version synced across all five locations (was missing in `index.ts` and `README.md` badge)

## [3.0.0] - 2026-03-15

### Added
- Initial release: thin MCP server (1 tool: `appstle_api`) + skill with endpoint docs, safety rules, and workflow playbooks
- Shell wrapper (`start.sh`) for automatic `.env` loading
- Migrated from 22-tool MCP server v2.0.0 to skill-driven architecture
