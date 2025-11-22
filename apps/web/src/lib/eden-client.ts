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
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    if (typeof err.message === 'string') return err.message;
    if (typeof err.summary === 'string') return err.summary;

    if (err.value && typeof err.value === 'object') {
      const value = err.value as Record<string, unknown>;
      if (typeof value.message === 'string') return value.message;
      if (typeof value.summary === 'string') return value.summary;
    }

    if (typeof err.value === 'string') return err.value;
  }

  return 'An error occurred';
}

// Export as 'api' and 'client' for backwards compatibility
export const api = fetch;
export const client = fetch;

// Export for direct use
export default fetch;
