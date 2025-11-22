'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { statsService, healthService, auditService } from '@/services/api';
import { useAdmin } from '@/contexts/AdminContext';

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, username, loading: authLoading, logout } = useAdmin();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof statsService.getStats>> | null>(null);
  const [recentActivity, setRecentActivity] = useState<Awaited<ReturnType<typeof auditService.getLogs>>['entries']>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof healthService.getHealth>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadData();
      // Refresh every 30 seconds
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [authLoading, isAuthenticated]);

  const loadData = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;

    try {
      const [statsData, healthData, auditData] = await Promise.all([
        statsService.getStats(),
        healthService.getHealth(),
        auditService.getLogs({ limit: 10 }),
      ]);

      setStats(statsData);
      setHealth(healthData);
      setRecentActivity(auditData.entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
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
        <div className="header">
          <div className="user-info">
            <span className="username">Logged in as: {username}</span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>
        {false && (
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
                recentActivity.map((entry) => (
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
          <div className="action-buttons">
            <button className="action-button" onClick={() => router.push('/requesters')}>
              <span className="action-icon">👥</span>
              <span>Manage Requesters</span>
            </button>
            <button className="action-button" onClick={() => router.push('/audit-logs')}>
              <span className="action-icon">📊</span>
              <span>View Full Audit Log</span>
            </button>
            <button className="action-button" onClick={() => router.push('/policies')}>
              <span className="action-icon">🔒</span>
              <span>Manage Policies</span>
            </button>
            <button className="action-button" onClick={() => router.push('/keys')}>
              <span className="action-icon">🔑</span>
              <span>View Master Key</span>
            </button>
            <button className="action-button" onClick={() => router.push('/statistics')}>
              <span className="action-icon">📈</span>
              <span>Export Statistics</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
