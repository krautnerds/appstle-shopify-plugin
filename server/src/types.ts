/**
 * Appstle Plugin Server - Type Definitions
 *
 * Minimal types for the generic API tool. The full response shapes
 * are documented in the skill's references/response-shapes.md.
 */

export interface AppstleErrorResponse {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
}
