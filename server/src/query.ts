#!/usr/bin/env node
/**
 * Standalone SQL query script for Appstle API dump files.
 *
 * Usage:
 *   node dist/query.js <json-file> "<sql-query>" [--compact] [--limit N]
 *
 * Examples:
 *   node dist/query.js /tmp/appstle_contracts_17105.json "SELECT status, COUNT(*) as n FROM ? GROUP BY status"
 *   node dist/query.js /tmp/appstle_contracts_17105.json "SELECT id, customerEmail FROM ? WHERE status = 'ACTIVE'" --limit 20
 *
 * Note: alasql reserves common words (total, count, name, order, key, value, number, status, type, table, select).
 * Use short aliases: as n, as cnt, as s, as v, as t.
 */

import { readFileSync } from 'node:fs';
import alasql from 'alasql';

function fatal(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { filePath: string; sql: string; compact: boolean; limit: number } {
  const args = argv.slice(2);
  let compact = false;
  let limit = 100;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--compact') {
      compact = true;
    } else if (args[i] === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit < 0) fatal('--limit must be a non-negative integer (0 = unlimited)');
      i++;
    } else {
      positional.push(args[i]);
    }
  }

  if (positional.length < 2) {
    fatal('Usage: node query.js <json-file> "<sql-query>" [--compact] [--limit N] (0 = unlimited)');
  }

  return { filePath: positional[0], sql: positional[1], compact, limit };
}

function loadData(filePath: string): unknown[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    fatal(`Cannot read file: ${filePath} — ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fatal(`Invalid JSON in ${filePath}`);
  }

  // Paginated response with .content array
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'content' in parsed) {
    const content = (parsed as Record<string, unknown>).content;
    if (Array.isArray(content)) return content;
  }

  // Bare array
  if (Array.isArray(parsed)) return parsed;

  // Single object — wrap in array
  if (parsed && typeof parsed === 'object') return [parsed];

  fatal('Unexpected JSON structure: expected object, array, or paginated response with .content');
}

function getColumnNames(data: unknown[]): string[] {
  if (data.length === 0) return [];
  const first = data[0];
  if (first && typeof first === 'object') return Object.keys(first as Record<string, unknown>);
  return [];
}

function main(): void {
  const { filePath, sql, compact, limit } = parseArgs(process.argv);
  const data = loadData(filePath);

  if (data.length === 0) {
    console.log('[]');
    return;
  }

  let result: unknown;
  try {
    result = alasql(sql, [data]);
  } catch (err) {
    const columns = getColumnNames(data);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`SQL Error: ${msg}`);
    if (/expecting.*literal/i.test(msg) || /got\s+'[A-Z]+'/i.test(msg)) {
      console.error(`\nHint: alasql reserves some words (e.g. total, count, name, order, key, value). Use short aliases: COUNT(*) as n, SUM(x) as s`);
    }
    console.error(`\nAvailable columns (${columns.length}): ${columns.join(', ')}`);
    console.error(`Row count: ${data.length}`);
    process.exit(1);
  }

  // Apply limit
  if (limit > 0 && Array.isArray(result) && result.length > limit) {
    const total = result.length;
    result = result.slice(0, limit);
    console.error(`[Showing ${limit} of ${total} rows. Use --limit N to adjust.]`);
  }

  const output = compact ? JSON.stringify(result) : JSON.stringify(result, null, 2);
  console.log(output);
}

main();
