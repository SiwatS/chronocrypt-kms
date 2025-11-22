'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auditService, ApiError } from '@/services/api';

export default function AuditLogsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof auditService.getLogs>>['entries']>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof auditService.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [eventTypeFilter, actorFilter, successFilter, limit, offset]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = {
        limit,
        offset,
        ...(eventTypeFilter && { eventType: eventTypeFilter }),
        ...(actorFilter && { actor: actorFilter }),
        ...(successFilter !== 'all' && { success: successFilter }),
      };

      const [logsData, statsData] = await Promise.all([
        auditService.getLogs(params),
        auditService.getStats(),
      ]);

      setEntries(logsData.entries);
      setTotal(logsData.total);
      setStats(statsData);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const resetFilters = () => {
    setEventTypeFilter('');
    setActorFilter('');
    setSuccessFilter('all');
    setOffset(0);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading Audit Logs...</h2>
          <p>⏳ Fetching audit entries</p>
        </div>
      </div>
    );
  }

  const successfulEvents = stats ? Math.round(stats.totalEntries * stats.successRate) : 0;
  const failedEvents = stats ? Math.round(stats.totalEntries * (1 - stats.successRate)) : 0;
  const uniqueActors = stats ? Object.keys(stats.entriesByActor).length : 0;

  return (
    <div className="container">
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Audit Logs</h1>
            <p className="dashboard-subtitle">Complete audit trail of system events</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="button"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            ← Back to Dashboard
          </button>
        </header>

        {error && (
          <div className="error" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
            <button onClick={loadData} className="button">Retry</button>
          </div>
        )}

        {/* Statistics Summary */}
        {stats && (
          <section className="metrics-grid" style={{ marginBottom: '2rem' }}>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">📊</span>
                <h3>Total Events</h3>
              </div>
              <div className="metric-value">{stats.totalEntries}</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">✅</span>
                <h3>Successful Events</h3>
              </div>
              <div className="metric-value">{successfulEvents}</div>
              <div className="metric-footer">
                Success Rate: {(stats.successRate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">❌</span>
                <h3>Failed Events</h3>
              </div>
              <div className="metric-value">{failedEvents}</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">👥</span>
                <h3>Unique Actors</h3>
              </div>
              <div className="metric-value">{uniqueActors}</div>
            </div>
          </section>
        )}

        {/* Filters */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Filters</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Event Type
              </label>
              <input
                type="text"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                placeholder="e.g., ACCESS_REQUEST"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Actor
              </label>
              <input
                type="text"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                placeholder="e.g., admin"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Status
              </label>
              <select
                value={successFilter}
                onChange={(e) => setSuccessFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px'
                }}
              >
                <option value="all">All</option>
                <option value="true">Success Only</option>
                <option value="false">Failed Only</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Per Page
              </label>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px'
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={resetFilters} className="button" style={{ fontSize: '0.875rem' }}>
              Reset Filters
            </button>
            <button onClick={loadData} className="button" style={{ fontSize: '0.875rem' }}>
              🔄 Refresh
            </button>
          </div>
        </section>

        {/* Audit Log Table */}
        <section className="activity-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>
              Audit Entries ({total} total)
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
            </div>
          </div>

          <div className="activity-table">
            <div className="table-header">
              <div className="table-row" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr', gap: '1rem' }}>
                <div className="table-cell">Event Type</div>
                <div className="table-cell">Actor</div>
                <div className="table-cell">Status</div>
                <div className="table-cell">Timestamp</div>
                <div className="table-cell">Details</div>
              </div>
            </div>
            <div className="table-body">
              {entries.length === 0 ? (
                <div className="empty-state">No audit entries found</div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="table-row"
                    style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 1fr', gap: '1rem', alignItems: 'center' }}
                  >
                    <div className="table-cell">
                      <span className="event-type" style={{ fontWeight: '500' }}>{entry.eventType}</span>
                    </div>
                    <div className="table-cell">{entry.actor}</div>
                    <div className="table-cell">
                      <span className={`status-badge ${entry.success ? 'status-healthy' : 'status-error'}`}>
                        {entry.success ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="table-cell" style={{ fontSize: '0.875rem' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div className="table-cell">
                      {entry.metadata && (
                        <button
                          onClick={() => alert(JSON.stringify(entry.metadata, null, 2))}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            background: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'white',
              borderRadius: '8px'
            }}>
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="button"
                style={{
                  fontSize: '0.875rem',
                  opacity: offset === 0 ? 0.5 : 1,
                  cursor: offset === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>

              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
              </span>

              <button
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="button"
                style={{
                  fontSize: '0.875rem',
                  opacity: offset + limit >= total ? 0.5 : 1,
                  cursor: offset + limit >= total ? 'not-allowed' : 'pointer'
                }}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
