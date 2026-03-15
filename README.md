# Appstle Shopify Plugin for Claude Code

[![Version](https://img.shields.io/badge/version-3.0.6-blue.svg)](./server/package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg)](https://nodejs.org/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-7C3AED.svg)](https://docs.anthropic.com/en/docs/claude-code)

A Claude Code plugin for Appstle API integration with Shopify stores. Enables natural-language Shopify subscription management -- customer lookup, billing, cancellations, payment methods, selling plans, and variant swaps -- directly from your Claude Code session.

**Publisher**: krautnerds

## Quickstart

1. Add the krautnerds marketplace:
   ```
   /plugin marketplace add krautnerds/claude-marketplace
   ```

2. Install the plugin:
   ```
   /plugin install appstle-shopify@krautnerds
   ```

3. Add your Appstle API key to your project `.env`:
   ```
   APPSTLE_API_KEY=your-key-here
   ```

4. Restart Claude Code, then verify:
   ```
   /mcp
   ```
   You should see `appstle-shopify` with a green status.

5. Try it:
   > "Look up subscriptions for customer@example.com"

## What It Does

This Appstle plugin pairs a thin MCP server with an Appstle skill to give Claude full access to the Appstle Subscription API (v2). Instead of 22 rigid tools, the plugin exposes a single `appstle_api` tool for authenticated HTTP requests while the skill provides endpoint documentation, safety rules, and step-by-step workflow playbooks on demand.

The result: comprehensive Appstle Shopify subscription management with near-zero token overhead in conversations that do not involve subscriptions.

### Capabilities

| Domain | What you can do |
|--------|-----------------|
| **Customer lookup** | Search by email, validate active subscriptions, generate and send portal links |
| **Subscription management** | List, filter, pause, resume, and cancel contracts with optional feedback |
| **Billing and orders** | View past/upcoming orders, trigger billing, skip/unskip/reschedule, adjust intervals |
| **Line items** | Add, remove, update quantities, set custom pricing, manage one-time add-ons |
| **Pricing and discounts** | Update line prices, apply discount codes, add custom percentage discounts |
| **Shipping** | Update delivery address and shipping method |
| **Payment methods** | List and update payment methods on a contract |
| **Selling plans** | List subscription groups, change frequencies, swap selling plans per line item |
| **Variant swaps** | Replace product variants, view swap rules and available options |
| **Audit and analytics** | Search activity logs, retrieve revenue analytics per contract |

## Setup

### Option A: Project `.env` file (recommended)

Add to your project's `.env` file:

```
APPSTLE_API_KEY=your-appstle-api-key
```

The plugin automatically loads `APPSTLE_*` variables from `.env` files in your project directory.

### Option B: Shell environment

Export directly in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export APPSTLE_API_KEY=your-appstle-api-key
```

### Getting your API key

1. Open your Shopify admin → Apps → Appstle Subscriptions
2. Go to Settings → API
3. Copy your API key
4. Add it to your `.env` file or shell environment

### Configuration

| Variable | Required | Default |
|----------|----------|---------|
| `APPSTLE_API_KEY` | Yes | -- |
| `APPSTLE_BASE_URL` | No | `https://subscription-admin.appstle.com` |

### Verify it works

After setup, restart Claude Code and check the MCP status:

```
/mcp
```

You should see `appstle-shopify` listed with a green status.

## Architecture

```
appstle-shopify-plugin/
  .claude-plugin/
    plugin.json            # Plugin manifest (name, version, author)
  .mcp.json                # MCP server registration for Claude Code
  server/
    start.sh               # Shell wrapper — loads .env, starts server
    src/
      index.ts             # MCP server entry point (stdio transport)
      client.ts            # HTTP client with X-API-Key auth
      types.ts             # TypeScript response types
    dist/                  # Compiled output
  skills/
    appstle-shopify/
      SKILL.md             # Endpoint quick map, API quirks, safety rules
      references/
        endpoints.md       # Full parameter reference for every endpoint
        response-shapes.md # Example JSON response structures
      examples/
        workflows.md       # Step-by-step playbooks for common tasks
```

**MCP server** (`server/`): A single-tool MCP server that handles authentication and HTTP transport. The tool (`appstle_api`) accepts a method, path, optional query params, and optional body. It forwards the request to the Appstle API with proper `X-API-Key` headers. The `start.sh` wrapper loads environment variables from `.env` before starting the server.

**Skill** (`skills/appstle-shopify/`): Loaded by Claude Code on demand when subscription-related topics are detected. Contains the endpoint catalog, critical API quirks, safety rules for destructive operations, and workflow playbooks. This keeps context usage near zero until the skill is actually needed.

## Usage Examples

The skill activates automatically when you mention subscriptions, Appstle, billing, recurring orders, or customer subscription management. You can also invoke it directly:

```
/appstle customer@example.com
```

### Common tasks

**Look up a customer and their subscriptions:**
> "Find all subscriptions for customer@example.com"

**Pause a subscription:**
> "Pause subscription 12345"

**Skip the next billing cycle:**
> "Skip the next order for contract 12345"

**Change a product variant:**
> "Swap the variant on line item 67890 in contract 12345 to variant 11111"

**Apply a discount:**
> "Apply discount code SAVE10 to subscription 12345"

Claude will use the `appstle_api` tool with the correct endpoint, parameters, and safety checks -- all guided by the skill's documentation.

## Skill Reference

The skill contains three reference documents for detailed API work:

| Document | Path | Contents |
|----------|------|----------|
| **Endpoint quick map** | [`skills/appstle-shopify/SKILL.md`](./skills/appstle-shopify/SKILL.md) | All endpoints at a glance, API quirks, safety rules |
| **Full endpoint reference** | [`skills/appstle-shopify/references/endpoints.md`](./skills/appstle-shopify/references/endpoints.md) | Every parameter, type, and constraint per endpoint |
| **Response shapes** | [`skills/appstle-shopify/references/response-shapes.md`](./skills/appstle-shopify/references/response-shapes.md) | Example JSON responses for each endpoint |
| **Workflow playbooks** | [`skills/appstle-shopify/examples/workflows.md`](./skills/appstle-shopify/examples/workflows.md) | Step-by-step procedures for common operations |

### Safety rules

Destructive operations require user confirmation before execution:

| Operation | Risk level |
|-----------|------------|
| Cancel subscription | Irreversible |
| Trigger billing | Charges the customer |
| Send portal link email | Sends a real email |
| Change billing date to today/past | May trigger immediate charge |
| Remove last line item | May cancel the subscription |
| Remove discount | Increases next charge amount |
| Replace variant | Changes what customer receives |

The skill enforces a fetch-confirm-execute-verify pattern: always read current state before modifying, confirm with the user, apply the change, then verify the result.

## Troubleshooting

**`appstle-shopify` not showing in `/mcp`?**
- Restart Claude Code after installing the plugin.

**Status is red/error?**
- Check that `APPSTLE_API_KEY` is set in your project `.env` or shell environment.
- The plugin searches `.env` files up to 3 parent directories from the working directory.

**`appstle_api` tool not available?**
- Run `/mcp` to check server status.
- Verify the API key is valid by checking your Appstle dashboard.

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.

| Version | Highlights |
|---------|------------|
| **3.0.x** | Plugin architecture -- thin MCP server (1 tool) with skill for endpoint docs and workflows. Migrated from 22-tool MCP server. |
| **2.0.0** | 22 tools covering the full Appstle Subscription API |
| **1.0.0** | Initial release with 14 tools |

## License

MIT

---

Built by [krautnerds](https://github.com/krautnerds).
