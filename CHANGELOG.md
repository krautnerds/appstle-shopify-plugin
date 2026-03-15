# Changelog

All notable changes to the appstle-shopify plugin will be documented in this file.

## [3.0.1] - 2026-03-15

### Fixed
- MCP server validation error ("Missing environment variables") by removing redundant `env` block from `.mcp.json`
- `.env` file discovery now uses `CLAUDE_PLUGIN_ROOT` for reliable path resolution regardless of working directory

### Changed
- `APPSTLE_BASE_URL` default fallback moved from `.mcp.json` to `start.sh`

## [3.0.0] - 2026-03-15

### Added
- Initial release: thin MCP server (1 tool: `appstle_api`) + skill with endpoint docs, safety rules, and workflow playbooks
- Shell wrapper (`start.sh`) for automatic `.env` loading
- Migrated from 22-tool MCP server v2.0.0 to skill-driven architecture
