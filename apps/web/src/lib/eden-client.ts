/**
 * Elysia Eden API Client
 *
 * Type-safe API client using Eden Treaty for Elysia backend
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '../../../backend/src/index';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create typed Eden client
export const api = treaty<App>(apiUrl);

// Export for direct use
export default api;
