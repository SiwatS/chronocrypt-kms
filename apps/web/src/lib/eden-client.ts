/**
 * Elysia Eden API Client
 *
 * Type-safe API client using Eden Treaty for Elysia backend
 * Uses /api base path which is proxied by Next.js rewrites (dev) or nginx (production)
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '../../../backend/src/index';

// Use window.location.origin to get full base URL
// Next.js rewrites will proxy /api/* to backend
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const api = treaty<App>(getBaseUrl(), {
  fetch: {
    credentials: 'include',
  },
  headers: () => {
    // Dynamic headers - will be called on each request
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sessionToken');
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    return {};
  },
});

// Export for direct use
export default api;
