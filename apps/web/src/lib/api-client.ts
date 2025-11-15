/**
 * KMS API Client
 *
 * Type-safe client using Elysia Eden Treaty for communicating with the ChronoCrypt KMS backend
 */

import { api } from './eden-client';

export interface TimeRange {
  startTime: number;
  endTime: number;
}

export interface AccessRequest {
  requesterId: string;
  timeRange: TimeRange;
  purpose?: string;
  metadata?: Record<string, unknown>;
}

export interface AccessResponse {
  granted: boolean;
  privateKeys?: Record<string, string>;
  denialReason?: string;
  metadata?: {
    keyCount: number;
    granularityMs: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  eventType: 'ACCESS_REQUEST' | 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'KEY_GENERATION' | 'KEY_DISTRIBUTION' | 'DECRYPTION_ATTEMPT';
  actor: string;
  target?: string;
  timeRange?: TimeRange;
  success: boolean;
  details?: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  type: string;
  priority?: number;
  enabled: boolean;
  description?: string;
  config?: Record<string, unknown>;
}

export interface SystemStats {
  accessRequests: {
    total: number;
    granted: number;
    denied: number;
    last24Hours: number;
  };
  policies: {
    total: number;
    enabled: number;
    disabled: number;
  };
  auditLog: {
    totalEntries: number;
    successRate: number;
  };
  keyManagement: {
    totalKeysDerivied: number;
    averageKeysPerRequest: number;
  };
}

class KMSAPIClient {
  // Authentication
  async login(username: string, password: string) {
    const { data, error } = await api.api.auth.login.post({ username, password });

    if (error) {
      throw new Error(error.value?.message || 'Login failed');
    }

    return data;
  }

  async logout() {
    const { data, error } = await api.api.auth.logout.post();

    if (error) {
      throw new Error(error.value?.message || 'Logout failed');
    }

    return data;
  }

  async checkSession() {
    const { data, error } = await api.api.auth.session.get();

    // 401 is expected when not authenticated
    if (error && error.status === 401) {
      return { authenticated: false, message: 'No active session' };
    }

    if (error) {
      throw new Error(error.value?.message || 'Session check failed');
    }

    return data;
  }

  async checkSetupRequired() {
    const { data, error } = await api.api.auth['setup-required'].get();

    if (error) {
      throw new Error(error.value?.message || 'Setup check failed');
    }

    return data;
  }

  // Access Requests
  async submitAccessRequest(request: AccessRequest): Promise<AccessResponse> {
    const { data, error } = await api.api['access-requests'].post(request);

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Access request failed');
    }

    return data as AccessResponse;
  }

  async getAccessRequests(params?: {
    requesterId?: string;
    startTime?: number;
    endTime?: number;
    status?: 'granted' | 'denied' | 'all';
    limit?: number;
    offset?: number;
  }) {
    const query: Record<string, string> = {};
    if (params?.requesterId) query.requesterId = params.requesterId;
    if (params?.startTime) query.startTime = params.startTime.toString();
    if (params?.endTime) query.endTime = params.endTime.toString();
    if (params?.status) query.status = params.status;
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.offset) query.offset = params.offset.toString();

    const { data, error } = await api.api['access-requests'].get({ query });

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get access requests');
    }

    return data;
  }

  // Audit Logs
  async getAuditLogs(params?: {
    eventType?: string;
    actor?: string;
    startTime?: number;
    endTime?: number;
    success?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const query: Record<string, string> = {};
    if (params?.eventType) query.eventType = params.eventType;
    if (params?.actor) query.actor = params.actor;
    if (params?.startTime) query.startTime = params.startTime.toString();
    if (params?.endTime) query.endTime = params.endTime.toString();
    if (params?.success !== undefined) query.success = params.success.toString();
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.offset) query.offset = params.offset.toString();

    const { data, error } = await api.api['audit-logs'].get({ query });

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get audit logs');
    }

    return data;
  }

  async getAuditLogStats() {
    const { data, error } = await api.api['audit-logs'].stats.get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get audit log stats');
    }

    return data;
  }

  // Policies
  async getPolicies() {
    const { data, error } = await api.api.policies.get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get policies');
    }

    return data;
  }

  async getPolicy(id: string) {
    const { data, error } = await api.api.policies[id].get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get policy');
    }

    return data;
  }

  async createPolicy(policy: Omit<Policy, 'id'>) {
    const { data, error } = await api.api.policies.post(policy);

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to create policy');
    }

    return data;
  }

  async deletePolicy(id: string) {
    const { data, error } = await api.api.policies[id].delete();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to delete policy');
    }

    return data;
  }

  async enablePolicy(id: string) {
    const { data, error } = await api.api.policies[id].enable.put();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to enable policy');
    }

    return data;
  }

  async disablePolicy(id: string) {
    const { data, error } = await api.api.policies[id].disable.put();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to disable policy');
    }

    return data;
  }

  // Key Management
  async getMasterPublicKey() {
    const { data, error } = await api.api.keys['master-public'].get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get master public key');
    }

    return data;
  }

  async getKeyStatus() {
    const { data, error } = await api.api.keys.status.get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get key status');
    }

    return data;
  }

  // System
  async getHealth() {
    const { data, error } = await api.api.health.get();

    if (error) {
      throw new Error(error.value?.message || 'Health check failed');
    }

    return data;
  }

  async getStats(): Promise<SystemStats> {
    const { data, error } = await api.api.stats.get();

    if (error) {
      if (error.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error(error.value?.message || 'Failed to get stats');
    }

    return data as SystemStats;
  }

  async getApiInfo() {
    const { data, error } = await api.get();

    if (error) {
      throw new Error(error.value?.message || 'Failed to get API info');
    }

    return data;
  }
}

export const kmsAPI = new KMSAPIClient();
export default kmsAPI;
