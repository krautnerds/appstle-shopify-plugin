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

import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AppstleApiClient } from './client.js';

const INLINE_THRESHOLD = 4096; // 4KB — responses larger than this get dumped to file
const DUMP_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

const scriptDir = dirname(fileURLToPath(import.meta.url));
const queryScriptPath = join(scriptDir, 'query.js');

function log(...args: unknown[]): void {
  console.error('[appstle]', ...args);
}

/**
 * Delete /tmp/appstle_*.json files older than DUMP_MAX_AGE_MS.
 */
function cleanupOldDumpFiles(): void {
  const tmp = tmpdir();
  const now = Date.now();
  let cleaned = 0;
  try {
    for (const name of readdirSync(tmp)) {
      if (!name.startsWith('appstle_') || !name.endsWith('.json')) continue;
      const filePath = join(tmp, name);
      try {
        const stat = statSync(filePath);
        if (now - stat.mtimeMs > DUMP_MAX_AGE_MS) {
          unlinkSync(filePath);
          cleaned++;
        }
      } catch {
        // file may have been removed between readdir and stat — ignore
      }
    }
  } catch {
    // tmpdir unreadable — ignore
  }
  if (cleaned > 0) log(`Cleaned up ${cleaned} old dump file(s)`);
}

/**
 * Extract a readable slug from an API path.
 * E.g. "/api/external/v2/subscription-contract-details" → "contract-details"
 */
function endpointSlug(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'response';
  // Strip common prefixes for shorter names
  return last
    .replace(/^subscription-/, '')
    .replace(/^subscription-contract-/, 'contract-')
    .replace(/^subscription-billing-/, 'billing-');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function truncateObj(obj: Record<string, unknown>, maxKeys: number): string {
  const keys = Object.keys(obj);
  const shown = keys.slice(0, maxKeys);
  const pairs = shown.map((k) => {
    const v = obj[k];
    if (v === null || v === undefined) return `${k}: null`;
    if (typeof v === 'string') return `${k}: "${v.length > 40 ? v.slice(0, 37) + '...' : v}"`;
    if (typeof v === 'number' || typeof v === 'boolean') return `${k}: ${v}`;
    if (Array.isArray(v)) return `${k}: [${v.length} items]`;
    if (typeof v === 'object') return `${k}: {...}`;
    return `${k}: ${String(v)}`;
  });
  const suffix = keys.length > maxKeys ? `, ... +${keys.length - maxKeys} more` : '';
  return `{${pairs.join(', ')}${suffix}}`;
}

/**
 * Dump data to a temp file and return a compact summary for Claude.
 */
function dumpAndSummarize(data: unknown, apiPath: string, requestedPageSize?: number): string {
  const slug = endpointSlug(apiPath);
  const timestamp = Date.now();

  // Include page number in filename for paginated responses
  let pageSegment = '';
  if (data && typeof data === 'object' && !Array.isArray(data) && 'content' in data) {
    const pg = data as Record<string, unknown>;
    const pageNum = pg.number ?? pg.page;
    if (typeof pageNum === 'number' && Number.isInteger(pageNum) && pageNum >= 0) {
      pageSegment = `_p${pageNum}`;
    }
  }

  const filePath = join(tmpdir(), `appstle_${slug}${pageSegment}_${timestamp}.json`);
  const json = JSON.stringify(data, null, 2);

  writeFileSync(filePath, json, 'utf-8');
  const fileSize = formatBytes(Buffer.byteLength(json, 'utf-8'));

  const lines: string[] = [];
  lines.push(`API Response: ${slug}`);

  // Detect paginated response
  if (data && typeof data === 'object' && !Array.isArray(data) && 'content' in data) {
    const pg = data as Record<string, unknown>;
    const content = pg.content as unknown[];
    const totalElements = pg.totalElements ?? '?';
    const totalPages = pg.totalPages ?? '?';
    const pageNumber = pg.number ?? pg.page ?? '?';
    const hasMore = pg.last === false ? 'yes' : pg.last === true ? 'no' : '?';

    lines.push(`Paginated: ${content.length} items on this page | ${totalElements} total | Page ${pageNumber} of ${totalPages} | Has more: ${hasMore}`);
    lines.push(`File: ${filePath} (${fileSize})`);

    if (content.length > 0 && content[0] && typeof content[0] === 'object') {
      const first = content[0] as Record<string, unknown>;
      const keys = Object.keys(first);
      lines.push('');
      lines.push(`Fields (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', ...' : ''}`);
      lines.push(`Sample: ${truncateObj(first, 6)}`);
    }
  } else if (Array.isArray(data)) {
    lines.push(`Array: ${data.length} items`);
    lines.push(`File: ${filePath} (${fileSize})`);

    if (data.length > 0 && data[0] && typeof data[0] === 'object') {
      const first = data[0] as Record<string, unknown>;
      const keys = Object.keys(first);
      lines.push('');
      lines.push(`Fields (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', ...' : ''}`);
      lines.push(`Sample: ${truncateObj(first, 6)}`);
    }

    // Pagination hint: when array length equals requested page size, more data likely exists
    if (requestedPageSize !== undefined && data.length === requestedPageSize) {
      lines.push('');
      lines.push(`(array length = requested page size — more data likely exists. Fetch next page with page={N+1}. Keep fetching until array length < page size.)`);
    }
  } else {
    lines.push(`Single object`);
    lines.push(`File: ${filePath} (${fileSize})`);
    if (data && typeof data === 'object') {
      const keys = Object.keys(data as Record<string, unknown>);
      lines.push('');
      lines.push(`Fields (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', ...' : ''}`);
    }
  }

  lines.push('');
  lines.push('Query with:');
  lines.push(`  node ${queryScriptPath} "${filePath}" "SELECT * FROM ? LIMIT 5"`);
  lines.push(`  node ${queryScriptPath} "${filePath}" "SELECT status, COUNT(*) as n FROM ? GROUP BY status"`);

  return lines.join('\n');
}

/**
 * Search for an .env file containing APPSTLE_API_KEY across candidate paths,
 * then load it via dotenv. Same search order as the old start.sh shell logic.
 */
function loadEnvFile(): void {
  if (process.env.APPSTLE_API_KEY) return; // already set in environment

  const cwd = process.cwd();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? '';
  const home = process.env.HOME ?? '';

  let gitRoot = '';
  try {
    gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // not in a git repo — ignore
  }

  const candidates: string[] = [
    // CWD-relative
    resolve(cwd, '.env'),
    resolve(cwd, '..', '.env'),
    resolve(cwd, '..', '..', '.env'),
    resolve(cwd, '..', '..', '..', '.env'),
    // CLAUDE_PLUGIN_ROOT-relative
    ...(pluginRoot
      ? [resolve(pluginRoot, '..', '.env'), resolve(pluginRoot, '..', '..', '.env')]
      : []),
    // Script-dir-relative (compiled dist/ → server/ → plugin/ → project/)
    resolve(scriptDir, '..', '.env'),
    resolve(scriptDir, '..', '..', '.env'),
    resolve(scriptDir, '..', '..', '..', '.env'),
    // Git root
    ...(gitRoot ? [resolve(gitRoot, '.env')] : []),
    // $HOME fallbacks
    ...(home
      ? [resolve(home, 'Work', 'eisenhorn', 'eisenhorn-astro', '.env'), resolve(home, '.env')]
      : []),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const content = readFileSync(candidate, 'utf-8');
      if (content.includes('APPSTLE_API_KEY')) {
        dotenvConfig({ path: candidate });
        log(`Loaded env from ${candidate}`);
        return;
      }
    } catch {
      // unreadable file — skip
    }
  }
}

async function main() {
  loadEnvFile();
  cleanupOldDumpFiles();

  const apiKey = process.env.APPSTLE_API_KEY;
  const baseUrl = process.env.APPSTLE_BASE_URL || 'https://subscription-admin.appstle.com';

  if (!apiKey) {
    log('FATAL: APPSTLE_API_KEY environment variable is not set.');
    log('Set it in your shell: export APPSTLE_API_KEY=your-key');
    log('Or add it to your project .env file: APPSTLE_API_KEY=your-key');
    process.exit(1);
  }

  const client = new AppstleApiClient(apiKey, baseUrl);

  const server = new McpServer({
    name: 'appstle-shopify',
    version: '3.2.0',
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
        if (text.length > INLINE_THRESHOLD) {
          const pageSize = params?.size !== undefined ? Number(params.size) : undefined;
          const validPageSize = pageSize !== undefined && Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined;
          const summary = dumpAndSummarize(data, path, validPageSize);
          return { content: [{ type: 'text' as const, text: summary }] };
        }
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
