'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface Stats {
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

interface AuditStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueActors: number;
  eventTypes: Record<string, number>;
  timeRanges?: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

export default function StatisticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsRes, auditStatsRes] = await Promise.all([
        api.api.stats.get(),
        api.api['audit-logs'].stats.get(),
      ]);

      if (statsRes.error) {
        if (statsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load statistics');
      }

      if (auditStatsRes.error) {
        throw new Error('Failed to load audit statistics');
      }

      setStats(statsRes.data as Stats);
      setAuditStats(auditStatsRes.data as AuditStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const exportAsJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      systemStats: stats,
      auditStats: auditStats,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronocrypt-stats-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    if (!stats || !auditStats) return;

    const csvLines = [
      'Category,Metric,Value',
      `Access Requests,Total,${stats.accessRequests.total}`,
      `Access Requests,Granted,${stats.accessRequests.granted}`,
      `Access Requests,Denied,${stats.accessRequests.denied}`,
      `Access Requests,Last 24 Hours,${stats.accessRequests.last24Hours}`,
      `Policies,Total,${stats.policies.total}`,
      `Policies,Enabled,${stats.policies.enabled}`,
      `Policies,Disabled,${stats.policies.disabled}`,
      `Audit Log,Total Entries,${stats.auditLog.totalEntries}`,
      `Audit Log,Success Rate,${(stats.auditLog.successRate * 100).toFixed(2)}%`,
      `Key Management,Total Keys Derived,${stats.keyManagement.totalKeysDerivied}`,
      `Key Management,Avg Keys Per Request,${stats.keyManagement.averageKeysPerRequest}`,
      `Audit Events,Total Events,${auditStats.totalEvents}`,
      `Audit Events,Successful,${auditStats.successfulEvents}`,
      `Audit Events,Failed,${auditStats.failedEvents}`,
      `Audit Events,Unique Actors,${auditStats.uniqueActors}`,
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronocrypt-stats-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading Statistics...</h2>
          <p>⏳ Gathering metrics</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button onClick={loadStats} className="button">Retry</button>
        </div>
      </div>
    );
  }

  const accessGrantRate = stats && stats.accessRequests.total > 0
    ? ((stats.accessRequests.granted / stats.accessRequests.total) * 100).toFixed(1)
    : '0';

  const auditSuccessRate = stats
    ? (stats.auditLog.successRate * 100).toFixed(1)
    : '0';

  return (
    <div className="container">
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">System Statistics</h1>
            <p className="dashboard-subtitle">Comprehensive metrics and analytics</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={exportAsJSON}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📥 Export JSON
            </button>
            <button
              onClick={exportAsCSV}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => router.push('/')}
              className="button"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#6b7280' }}
            >
              ← Back
            </button>
          </div>
        </header>

        {/* Access Request Metrics */}
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Access Requests</h2>
          <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">📊</span>
                <h3>Total Requests</h3>
              </div>
              <div className="metric-value">{stats?.accessRequests.total || 0}</div>
              <div className="metric-footer">All-time count</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">✅</span>
                <h3>Granted</h3>
              </div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                {stats?.accessRequests.granted || 0}
              </div>
              <div className="metric-footer">Success rate: {accessGrantRate}%</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">❌</span>
                <h3>Denied</h3>
              </div>
              <div className="metric-value" style={{ color: '#ef4444' }}>
                {stats?.accessRequests.denied || 0}
              </div>
              <div className="metric-footer">Policy violations</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">⏰</span>
                <h3>Last 24 Hours</h3>
              </div>
              <div className="metric-value">{stats?.accessRequests.last24Hours || 0}</div>
              <div className="metric-footer">Recent activity</div>
            </div>
          </div>
        </section>

        {/* Policy Metrics */}
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Policies</h2>
          <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">🔒</span>
                <h3>Total Policies</h3>
              </div>
              <div className="metric-value">{stats?.policies.total || 0}</div>
              <div className="metric-footer">Configured rules</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">✓</span>
                <h3>Enabled</h3>
              </div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                {stats?.policies.enabled || 0}
              </div>
              <div className="metric-footer">Active policies</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">⊘</span>
                <h3>Disabled</h3>
              </div>
              <div className="metric-value" style={{ color: '#6b7280' }}>
                {stats?.policies.disabled || 0}
              </div>
              <div className="metric-footer">Inactive policies</div>
            </div>
          </div>
        </section>

        {/* Audit Log Metrics */}
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Audit Logs</h2>
          <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">📜</span>
                <h3>Total Events</h3>
              </div>
              <div className="metric-value">{auditStats?.totalEvents || 0}</div>
              <div className="metric-footer">Logged entries</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">✅</span>
                <h3>Successful</h3>
              </div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                {auditStats?.successfulEvents || 0}
              </div>
              <div className="metric-footer">Success rate: {auditSuccessRate}%</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">❌</span>
                <h3>Failed</h3>
              </div>
              <div className="metric-value" style={{ color: '#ef4444' }}>
                {auditStats?.failedEvents || 0}
              </div>
              <div className="metric-footer">Error events</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">👥</span>
                <h3>Unique Actors</h3>
              </div>
              <div className="metric-value">{auditStats?.uniqueActors || 0}</div>
              <div className="metric-footer">Different users</div>
            </div>
          </div>
        </section>

        {/* Key Management Metrics */}
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Key Management</h2>
          <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">🔑</span>
                <h3>Total Keys Derived</h3>
              </div>
              <div className="metric-value">{stats?.keyManagement.totalKeysDerivied || 0}</div>
              <div className="metric-footer">All-time count</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">📊</span>
                <h3>Avg Keys Per Request</h3>
              </div>
              <div className="metric-value">
                {stats?.keyManagement.averageKeysPerRequest?.toFixed(2) || '0.00'}
              </div>
              <div className="metric-footer">Efficiency metric</div>
            </div>
          </div>
        </section>

        {/* Event Types Breakdown */}
        {auditStats?.eventTypes && Object.keys(auditStats.eventTypes).length > 0 && (
          <section style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{ marginBottom: '1rem' }}>Event Type Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(auditStats.eventTypes)
                .sort(([, a], [, b]) => b - a)
                .map(([eventType, count]) => {
                  const percentage = auditStats.totalEvents > 0
                    ? ((count / auditStats.totalEvents) * 100).toFixed(1)
                    : '0';
                  return (
                    <div
                      key={eventType}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: '#f9fafb',
                        borderRadius: '8px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '600', color: '#2c3e50' }}>{eventType}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '150px',
                          height: '8px',
                          background: '#e5e7eb',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: '#3498db',
                            borderRadius: '4px'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', minWidth: '80px', textAlign: 'right' }}>
                          {count} ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Export Information */}
        <section style={{
          background: '#e0f2fe',
          border: '1px solid #0ea5e9',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          gap: '1rem',
          alignItems: 'start'
        }}>
          <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
          <div>
            <h3 style={{ color: '#075985', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              Export Statistics
            </h3>
            <p style={{ color: '#075985', margin: 0, fontSize: '0.875rem' }}>
              Use the export buttons above to download statistics in JSON (for programmatic use) or CSV
              (for spreadsheet analysis). Exports include all metrics shown on this page with timestamp.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
