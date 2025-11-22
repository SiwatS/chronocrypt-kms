/**
 * API Service Layer
 *
 * Provides typed, clean service methods for all API calls using edenFetch.
 * Types are inferred directly from the backend - no manual type definitions.
 */

import { fetch as edenFetch, getErrorMessage } from '@/lib/eden-client';

// Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
  return sessionId ? { Authorization: `Bearer ${sessionId}` } : {};
}

// Helper to handle API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Admin Authentication Service
 */
export const adminService = {
  async checkSetup() {
    const response = await edenFetch('/api/admin/setup', {
      method: 'GET',
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async setup(data: { username: string; password: string }) {
    const response = await edenFetch('/api/admin/setup', {
      method: 'POST',
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async login(data: { username: string; password: string }) {
    const response = await edenFetch('/api/admin/login', {
      method: 'POST',
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async logout() {
    const response = await edenFetch('/api/admin/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * Requester Management Service
 */
export const requesterService = {
  async getAll() {
    const response = await edenFetch('/api/requesters', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    if (response.data && 'requesters' in response.data) {
      return response.data.requesters;
    }

    throw new ApiError('Invalid response format');
  },

  async getById(id: string) {
    const requesters = await this.getAll();
    const requester = requesters.find((r) => r.id === id);

    if (!requester) {
      throw new ApiError('Requester not found', 404);
    }

    return requester;
  },

  async create(data: { name: string; description?: string; metadata?: Record<string, unknown> }) {
    const response = await edenFetch('/api/requesters', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async update(id: string, data: { name?: string; description?: string; enabled?: boolean; metadata?: Record<string, unknown> }) {
    const response = await edenFetch('/api/requesters/:id', {
      method: 'PUT',
      params: { id },
      headers: getAuthHeaders(),
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async delete(id: string) {
    const response = await edenFetch('/api/requesters/:id', {
      method: 'DELETE',
      params: { id },
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * API Key Management Service
 */
export const apiKeyService = {
  async getAll() {
    const response = await edenFetch('/api/api-keys', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    if (response.data && 'apiKeys' in response.data) {
      return response.data.apiKeys;
    }

    throw new ApiError('Invalid response format');
  },

  async generate(data: { requesterId: string; name: string; expiresAt?: string }) {
    const response = await edenFetch('/api/api-keys/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async update(keyId: string, data: { enabled?: boolean; name?: string }) {
    const response = await edenFetch('/api/api-keys/:keyId', {
      method: 'PUT',
      params: { keyId },
      headers: getAuthHeaders(),
      body: data,
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },

  async delete(keyId: string) {
    const response = await edenFetch('/api/api-keys/:keyId', {
      method: 'DELETE',
      params: { keyId },
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * Audit Log Service
 */
export const auditService = {
  async getLogs(params?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    actor?: string;
    success?: string;
  }) {
    const queryParams: Record<string, string> = {};
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    if (params?.offset !== undefined) queryParams.offset = params.offset.toString();
    if (params?.eventType) queryParams.eventType = params.eventType;
    if (params?.actor) queryParams.actor = params.actor;
    if (params?.success) queryParams.success = params.success;

    const queryString = new URLSearchParams(queryParams).toString();
    const url = queryString ? `/api/audit-logs?${queryString}` : '/api/audit-logs';

    const response = await edenFetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    if (response.data && 'entries' in response.data) {
      return {
        entries: response.data.entries,
        total: 'total' in response.data ? response.data.total : 0,
      };
    }

    throw new ApiError('Invalid response format');
  },

  async getStats() {
    const response = await edenFetch('/api/audit-logs/stats', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * Statistics Service
 */
export const statsService = {
  async getStats() {
    const response = await edenFetch('/api/stats', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * Health Check Service
 */
export const healthService = {
  async getHealth() {
    const response = await edenFetch('/api/health', {
      method: 'GET',
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    return response.data;
  },
};

/**
 * Policy Management Service
 */
export const policyService = {
  async getAll() {
    const response = await edenFetch('/api/policies', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.error) {
      throw new ApiError(getErrorMessage(response.error), response.status);
    }

    if (response.data && 'policies' in response.data) {
      return response.data.policies;
    }

    throw new ApiError('Invalid response format');
  },
};

// Export all services as a single object for convenience
export const api = {
  admin: adminService,
  requesters: requesterService,
  apiKeys: apiKeyService,
  audit: auditService,
  stats: statsService,
  health: healthService,
  policies: policyService,
};

export default api;
