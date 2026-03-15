/**
 * Appstle Plugin Server - HTTP Client
 *
 * Generic HTTP client for the Appstle Subscription API.
 * Uses X-API-Key header authentication.
 * Logs to stderr (stdout reserved for JSON-RPC in MCP).
 */

import type { AppstleErrorResponse } from './types.js';

function log(...args: unknown[]): void {
  console.error('[appstle]', ...args);
}

export class AppstleApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Make an authenticated request to the Appstle API.
   */
  async request<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    body?: unknown
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Some endpoints (e.g. activity-logs) require api_key as query param in addition to header
    url.searchParams.set('api_key', this.apiKey);

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    log(`${method} ${url.pathname}${url.search}`);

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new AppstleApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      return { message: 'Success' } as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const error = data as AppstleErrorResponse;
      throw new AppstleApiError(
        error.detail || error.title || `HTTP ${response.status}`,
        response.status,
        error
      );
    }

    return data as T;
  }
}

export class AppstleApiError extends Error {
  status: number;
  apiError?: AppstleErrorResponse;

  constructor(message: string, status: number, apiError?: AppstleErrorResponse) {
    super(message);
    this.name = 'AppstleApiError';
    this.status = status;
    this.apiError = apiError;
  }
}
