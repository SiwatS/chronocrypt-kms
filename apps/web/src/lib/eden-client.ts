/**
 * Elysia Eden API Client
 *
 * Type-safe API client using edenFetch for Elysia backend
 * Uses /api base path which is proxied by Next.js rewrites (dev) or nginx (production)
 */

import { edenFetch } from '@elysiajs/eden';
import type { App } from '../../../backend/src/index';

// Use window.location.origin to get full base URL
// Next.js rewrites will proxy /api/* to backend
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const fetch = edenFetch<App>(getBaseUrl());

// Helper to extract error message from Eden response
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.summary) return error.summary;
  if (error?.value) {
    if (typeof error.value === 'string') return error.value;
    if (error.value?.message) return error.value.message;
    if (error.value?.summary) return error.value.summary;
  }
  return 'An error occurred';
}

// Export as 'api' and 'client' for backwards compatibility
export const api = fetch;
export const client = fetch;

// Export for direct use
export default fetch;
