'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import kmsAPI, { type SystemStats, type AuditLogEntry } from '@/lib/api-client';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
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
      const [statsData, healthData, auditData, sessionData, setupData] = await Promise.all([
        kmsAPI.getStats(),
        kmsAPI.getHealth(),
        kmsAPI.getAuditLogs({ limit: 10 }),
        kmsAPI.checkSession(),
        kmsAPI.checkSetupRequired()
      ]);

      setStats(statsData);
      setHealth(healthData);
      setRecentActivity(auditData.entries);
      setUser(sessionData.user || null);
      setSetupWarning(setupData.setupRequired);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await kmsAPI.logout();
      router.push('/login');
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
                <span className="detail-label">Last 24h:</span>
                <span className="detail-value">{stats?.accessRequests.last24Hours || 0}</span>
              </div>
            </div>
            <div className="metric-footer">
              Grant Rate: {grantRate}%
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🔑</span>
              <h3>Key Derivation</h3>
            </div>
            <div className="metric-value">{stats?.keyManagement.totalKeysDerivied || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Avg per Request:</span>
                <span className="detail-value">{stats?.keyManagement.averageKeysPerRequest || 0}</span>
              </div>
            </div>
            <div className="metric-footer">
              Time-specific keys generated
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📝</span>
              <h3>Audit Log</h3>
            </div>
            <div className="metric-value">{stats?.auditLog.totalEntries || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Success Rate:</span>
                <span className="detail-value">{successRate}%</span>
              </div>
            </div>
            <div className="metric-footer">
              All operations tracked
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">⚙️</span>
              <h3>Policies</h3>
            </div>
            <div className="metric-value">{stats?.policies.total || 0}</div>
            <div className="metric-details">
              <div className="metric-detail">
                <span className="detail-label">Enabled:</span>
                <span className="detail-value">{stats?.policies.enabled || 0}</span>
              </div>
              <div className="metric-detail">
                <span className="detail-label">Disabled:</span>
                <span className="detail-value">{stats?.policies.disabled || 0}</span>
              </div>
            </div>
            <div className="metric-footer">
              Active access control
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <Link href="/access-requests" className="action-button">
              <span className="action-icon">🔐</span>
              <span className="action-label">Submit Access Request</span>
            </Link>
            <Link href="/audit-logs" className="action-button">
              <span className="action-icon">📊</span>
              <span className="action-label">View Audit Logs</span>
            </Link>
            <Link href="/policies" className="action-button">
              <span className="action-icon">⚙️</span>
              <span className="action-label">Manage Policies</span>
            </Link>
            <Link href="/keys" className="action-button">
              <span className="action-icon">🔑</span>
              <span className="action-label">Key Management</span>
            </Link>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="recent-activity">
          <h2>Recent Activity</h2>
          {recentActivity.length > 0 ? (
            <div className="activity-list">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="activity-item">
                  <div className="activity-icon">
                    {entry.eventType === 'ACCESS_REQUEST' && '📥'}
                    {entry.eventType === 'ACCESS_GRANTED' && '✅'}
                    {entry.eventType === 'ACCESS_DENIED' && '❌'}
                    {entry.eventType === 'KEY_GENERATION' && '🔑'}
                    {entry.eventType === 'KEY_DISTRIBUTION' && '📤'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{entry.eventType.replace(/_/g, ' ')}</div>
                    <div className="activity-meta">
                      Actor: {entry.actor}
                      {entry.target && ` → Target: ${entry.target}`}
                      <span className="activity-time">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={`activity-status ${entry.success ? 'status-success' : 'status-failure'}`}>
                    {entry.success ? '✓' : '✗'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No recent activity</p>
          )}
          <Link href="/audit-logs" className="view-all-link">
            View All Activity →
          </Link>
        </section>

        {/* System Status */}
        <section className="system-status">
          <h2>System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Key Holder:</span>
              <span className={`status-indicator ${health?.components.keyHolder === 'operational' ? 'indicator-healthy' : 'indicator-error'}`}>
                {health?.components.keyHolder || 'unknown'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Audit Log:</span>
              <span className={`status-indicator ${health?.components.auditLog === 'operational' ? 'indicator-healthy' : 'indicator-error'}`}>
                {health?.components.auditLog || 'unknown'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Policy Engine:</span>
              <span className={`status-indicator ${health?.components.policyEngine === 'operational' ? 'indicator-healthy' : 'indicator-error'}`}>
                {health?.components.policyEngine || 'unknown'}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
