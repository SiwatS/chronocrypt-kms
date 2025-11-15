'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [setupWarning, setSetupWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, healthRes, auditRes, sessionRes, setupRes] = await Promise.all([
        api.api.stats.get(),
        api.api.health.get(),
        api.api['audit-logs'].get({ query: { limit: '10' } }),
        api.api.auth.session.get(),
        api.api.auth['setup-required'].get()
      ]);

      if (statsRes.error) throw new Error('Failed to load stats');
      if (healthRes.error) throw new Error('Failed to load health');
      if (auditRes.error) throw new Error('Failed to load audit logs');

      setStats(statsRes.data);
      setHealth(healthRes.data);
      setRecentActivity(auditRes.data?.entries || []);
      setUser(sessionRes.data?.user || null);
      setSetupWarning(setupRes.data?.setupRequired || false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await api.api.auth.logout.post();
      if (!error) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading KMS Dashboard...</h2>
          <p>⏳ Fetching system statistics</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h2>⚠️ Connection Error</h2>
          <p>{error}</p>
          <p>Make sure the backend server is running on port 3001</p>
          <button onClick={loadData} className="button">Retry</button>
        </div>
      </div>
    );
  }

  const successRate = stats ? (stats.auditLog.successRate * 100).toFixed(1) : '0';
  const grantRate = stats && stats.accessRequests.total > 0
    ? ((stats.accessRequests.granted / stats.accessRequests.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="container">
      <main className="dashboard">
        {setupWarning && (
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ color: '#92400e', margin: '0 0 0.5rem 0' }}>⚠️ Setup Required</h3>
            <p style={{ color: '#92400e', margin: 0 }}>
              You are using the default admin password. Please set a strong password via the ADMIN_PASSWORD environment variable.
            </p>
          </div>
        )}

        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">ChronoCrypt KMS</h1>
            <p className="dashboard-subtitle">Key Management System Dashboard</p>
          </div>
          <div className="dashboard-status" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {user && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Logged in as <strong>{user.username}</strong>
              </span>
            )}
            <span className={`status-badge ${health?.status === 'healthy' ? 'status-healthy' : 'status-error'}`}>
              {health?.status === 'healthy' ? '✓ Operational' : '⚠ Issues Detected'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Key Metrics */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📊</span>
              <h3>Access Requests</h3>
            </div>
            <div className="metric-value">{stats?.accessRequests.total || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Granted:</span>
                <span className="detail-value">{stats?.accessRequests.granted || 0}</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Denied:</span>
                <span className="detail-value">{stats?.accessRequests.denied || 0}</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Success Rate:</span>
                <span className="detail-value">{grantRate}%</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Last 24h:</span>
                <span className="detail-value">{stats?.accessRequests.last24Hours || 0}</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📜</span>
              <h3>Audit Log</h3>
            </div>
            <div className="metric-value">{stats?.auditLog.totalEntries || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Success Rate:</span>
                <span className="detail-value">{successRate}%</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Recent Events:</span>
                <span className="detail-value">{recentActivity.length}</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🔒</span>
              <h3>Policies</h3>
            </div>
            <div className="metric-value">{stats?.policies.total || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Enabled:</span>
                <span className="detail-value status-healthy">{stats?.policies.enabled || 0}</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Disabled:</span>
                <span className="detail-value">{stats?.policies.disabled || 0}</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🔑</span>
              <h3>Key Management</h3>
            </div>
            <div className="metric-value">{stats?.keyManagement.totalKeysDerivied || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Avg Keys/Request:</span>
                <span className="detail-value">{stats?.keyManagement.averageKeysPerRequest || 0}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-table">
            <div className="table-header">
              <div className="table-row">
                <div className="table-cell">Event</div>
                <div className="table-cell">Actor</div>
                <div className="table-cell">Time</div>
                <div className="table-cell">Status</div>
              </div>
            </div>
            <div className="table-body">
              {recentActivity.length === 0 ? (
                <div className="empty-state">No recent activity</div>
              ) : (
                recentActivity.map((entry: any) => (
                  <div key={entry.id} className="table-row">
                    <div className="table-cell">
                      <span className="event-type">{entry.eventType}</span>
                    </div>
                    <div className="table-cell">{entry.actor}</div>
                    <div className="table-cell">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div className="table-cell">
                      <span className={`status-badge ${entry.success ? 'status-healthy' : 'status-error'}`}>
                        {entry.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* System Components */}
        <section className="components-section">
          <h2>System Components</h2>
          <div className="components-grid">
            <div className="component-card">
              <h3>🔐 Key Holder</h3>
              <p className="status-healthy">{health?.components.keyHolder}</p>
            </div>
            <div className="component-card">
              <h3>📝 Audit Log</h3>
              <p className="status-healthy">{health?.components.auditLog}</p>
            </div>
            <div className="component-card">
              <h3>🛡️ Policy Engine</h3>
              <p className="status-healthy">{health?.components.policyEngine}</p>
            </div>
            <div className="component-card">
              <h3>🔓 Authentication</h3>
              <p className="status-healthy">{health?.components.authentication}</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="actions-section">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <button className="action-button">
              <span className="action-icon">📊</span>
              <span>View Full Audit Log</span>
            </button>
            <button className="action-button">
              <span className="action-icon">🔒</span>
              <span>Manage Policies</span>
            </button>
            <button className="action-button">
              <span className="action-icon">🔑</span>
              <span>View Master Key</span>
            </button>
            <button className="action-button">
              <span className="action-icon">📈</span>
              <span>Export Statistics</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
