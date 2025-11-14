/**
 * KMS API Client
 *
 * Client-side API wrapper for communicating with the ChronoCrypt KMS backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  private baseURL: string;

  constructor(baseURL: string = API_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Access Requests
  async submitAccessRequest(request: AccessRequest): Promise<AccessResponse> {
    return this.request<AccessResponse>('/api/access-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getAccessRequests(params?: {
    requesterId?: string;
    startTime?: number;
    endTime?: number;
    status?: 'granted' | 'denied' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ requests: any[]; total: number; limit: number; offset: number }> {
    const queryParams = new URLSearchParams();
    if (params?.requesterId) queryParams.append('requesterId', params.requesterId);
    if (params?.startTime) queryParams.append('startTime', params.startTime.toString());
    if (params?.endTime) queryParams.append('endTime', params.endTime.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/access-requests${query ? `?${query}` : ''}`);
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
  }): Promise<{ entries: AuditLogEntry[]; total: number; limit: number; offset: number }> {
    const queryParams = new URLSearchParams();
    if (params?.eventType) queryParams.append('eventType', params.eventType);
    if (params?.actor) queryParams.append('actor', params.actor);
    if (params?.startTime) queryParams.append('startTime', params.startTime.toString());
    if (params?.endTime) queryParams.append('endTime', params.endTime.toString());
    if (params?.success !== undefined) queryParams.append('success', params.success.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/audit-logs${query ? `?${query}` : ''}`);
  }

  async getAuditLogStats(): Promise<any> {
    return this.request('/api/audit-logs/stats');
  }

  // Policies
  async getPolicies(): Promise<{ policies: Policy[] }> {
    return this.request('/api/policies');
  }

  async getPolicy(id: string): Promise<Policy> {
    return this.request(`/api/policies/${id}`);
  }

  async createPolicy(policy: Omit<Policy, 'id'>): Promise<Policy> {
    return this.request('/api/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }

  async deletePolicy(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/policies/${id}`, {
      method: 'DELETE',
    });
  }

  async enablePolicy(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/policies/${id}/enable`, {
      method: 'PUT',
    });
  }

  async disablePolicy(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/policies/${id}/disable`, {
      method: 'PUT',
    });
  }

  // Key Management
  async getMasterPublicKey(): Promise<any> {
    return this.request('/api/keys/master-public');
  }

  async getKeyStatus(): Promise<any> {
    return this.request('/api/keys/status');
  }

  // System
  async getHealth(): Promise<any> {
    return this.request('/api/health');
  }

  async getStats(): Promise<SystemStats> {
    return this.request('/api/stats');
  }

  async getApiInfo(): Promise<any> {
    return this.request('/');
  }
}

export const kmsAPI = new KMSAPIClient();
export default kmsAPI;
