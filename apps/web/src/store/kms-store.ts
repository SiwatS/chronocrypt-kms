/**
 * Zustand Store for KMS State Management
 *
 * Centralized state for system stats, audit logs, policies, and health
 */

import { create } from 'zustand';

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

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  eventType: string;
  actor: string;
  target?: string;
  timeRange?: {
    startTime: number;
    endTime: number;
  };
  success: boolean;
  details?: Record<string, unknown>;
}

export interface Health {
  status: string;
  timestamp: number;
  components: {
    keyHolder: string;
    auditLog: string;
    policyEngine: string;
  };
}

interface KMSState {
  // Data
  stats: SystemStats | null;
  recentActivity: AuditLogEntry[];
  health: Health | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  setStats: (stats: SystemStats) => void;
  setRecentActivity: (activity: AuditLogEntry[]) => void;
  setHealth: (health: Health) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Combined action
  loadDashboardData: () => Promise<void>;
}

export const useKMSStore = create<KMSState>((set, _get) => ({
  // Initial state
  stats: null,
  recentActivity: [],
  health: null,
  loading: true,
  error: null,

  // Setters
  setStats: (stats) => set({ stats }),
  setRecentActivity: (activity) => set({ recentActivity: activity }),
  setHealth: (health) => set({ health }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Load all dashboard data
  loadDashboardData: async () => {
    set({ loading: true, error: null });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const [statsRes, healthRes, auditRes] = await Promise.all([
        fetch(`${apiUrl}/api/stats`),
        fetch(`${apiUrl}/api/health`),
        fetch(`${apiUrl}/api/audit-logs?limit=10`)
      ]);

      if (!statsRes.ok || !healthRes.ok || !auditRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [statsData, healthData, auditData] = await Promise.all([
        statsRes.json(),
        healthRes.json(),
        auditRes.json()
      ]);

      set({
        stats: statsData,
        health: healthData,
        recentActivity: auditData.entries,
        loading: false,
        error: null
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load data',
        loading: false
      });
    }
  },
}));
