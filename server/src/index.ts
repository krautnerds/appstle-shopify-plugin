/**
 * Appstle Plugin - MCP Server
 *
 * Thin MCP server with 1 generic tool for authenticated Appstle API requests.
 * Endpoint documentation, workflows, and safety rules live in the appstle skill.
 *
 * Environment variables:
 *   APPSTLE_API_KEY  - Required. X-API-Key for Appstle API authentication.
 *   APPSTLE_BASE_URL - Optional. Defaults to https://subscription-admin.appstle.com
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AppstleApiClient } from './client.js';

function log(...args: unknown[]): void {
  console.error('[appstle]', ...args);
}

async function main() {
  const apiKey = process.env.APPSTLE_API_KEY;
  const baseUrl = process.env.APPSTLE_BASE_URL || 'https://subscription-admin.appstle.com';

  if (!apiKey) {
    log('FATAL: APPSTLE_API_KEY environment variable is not set.');
    process.exit(1);
  }

  const client = new AppstleApiClient(apiKey, baseUrl);

  const server = new McpServer({
    name: 'appstle-shopify',
    version: '3.0.3',
  });

  server.tool(
    'appstle_api',
    'Execute an authenticated Appstle Subscription API request. Load the appstle skill first for endpoint docs, workflows, and safety rules.',
    {
      method: z.enum(['GET', 'PUT', 'POST', 'DELETE']).describe('HTTP method'),
      path: z.string().describe('API path starting with /api/external/v2/ (e.g. "/api/external/v2/subscription-customers/12345")'),
      params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Query parameters as key-value pairs'),
      body: z.record(z.unknown()).optional()
        .describe('JSON request body (only for POST and specific PUT endpoints that use body — most PUT endpoints use query params instead)'),
    },
    async ({ method, path, params, body }) => {
      try {
        const data = await client.request<unknown>(method, path, params, body);
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${method} ${path} failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('Server started. 1 tool registered (appstle_api).');
}

main().catch((error) => {
  log('Fatal error:', error);
  process.exit(1);
});
