# Changelog

All notable changes to the appstle-shopify plugin will be documented in this file.

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
