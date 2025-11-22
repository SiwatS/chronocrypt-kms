'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/lib/eden-client';
import { useAdmin } from '@/contexts/AdminContext';

interface Requester {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  apiKeys: Array<{
    id: string;
    keyId: string;
    name: string;
    enabled: boolean;
    expiresAt?: string;
    lastUsedAt?: string;
    createdAt: string;
  }>;
}

export default function RequestersPage() {
  const router = useRouter();
  const { isAuthenticated, username, loading: authLoading, logout } = useAdmin();
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [filteredRequesters, setFilteredRequesters] = useState<Requester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metadata: '',
    enabled: true
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadRequesters();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    filterRequesters();
  }, [requesters, searchTerm, statusFilter]);

  const loadRequesters = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await client.api.requesters.get({
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        if (response.status === 401) {
          logout();
          return;
        }
        throw new Error('Failed to load requesters');
      }

      if (response.data && 'requesters' in response.data) {
        setRequesters(response.data.requesters);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filterRequesters = () => {
    let filtered = [...requesters];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter === 'enabled') {
      filtered = filtered.filter(r => r.enabled);
    } else if (statusFilter === 'disabled') {
      filtered = filtered.filter(r => !r.enabled);
    }

    setFilteredRequesters(filtered);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const openCreateModal = () => {
    setFormData({ name: '', description: '', metadata: '', enabled: true });
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (requester: Requester) => {
    setSelectedRequester(requester);
    setFormData({
      name: requester.name,
      description: requester.description || '',
      metadata: requester.metadata ? JSON.stringify(requester.metadata, null, 2) : '',
      enabled: requester.enabled
    });
    setFormError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (requester: Requester) => {
    setSelectedRequester(requester);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    // Validate metadata JSON if provided
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try {
        metadata = JSON.parse(formData.metadata);
      } catch (err) {
        setFormError('Invalid JSON in metadata field');
        return;
      }
    }

    setSubmitting(true);
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api.requesters.post({
        name: formData.name,
        description: formData.description || undefined,
        metadata
      }, {
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to create requester');
      }

      setShowCreateModal(false);
      await loadRequesters();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create requester');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequester) return;

    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    // Validate metadata JSON if provided
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try {
        metadata = JSON.parse(formData.metadata);
      } catch (err) {
        setFormError('Invalid JSON in metadata field');
        return;
      }
    }

    setSubmitting(true);
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api.requesters[selectedRequester.id].put({
        name: formData.name,
        description: formData.description || undefined,
        enabled: formData.enabled,
        metadata
      }, {
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to update requester');
      }

      setShowEditModal(false);
      await loadRequesters();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update requester');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRequester) return;

    setSubmitting(true);
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api.requesters[selectedRequester.id].delete({
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to delete requester');
      }

      setShowDeleteModal(false);
      await loadRequesters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete requester');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (requester: Requester) => {
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api.requesters[requester.id].put({
        enabled: !requester.enabled
      }, {
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to update requester');
      }

      await loadRequesters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading Requesters...</h2>
          <p>⏳ Fetching data</p>
        </div>
      </div>
    );
  }

  const totalRequesters = requesters.length;
  const enabledRequesters = requesters.filter(r => r.enabled).length;
  const disabledRequesters = requesters.filter(r => !r.enabled).length;
  const totalApiKeys = requesters.reduce((sum, r) => sum + r.apiKeys.length, 0);

  return (
    <div className="container">
      <main className="dashboard">
        {/* Header */}
        <div className="header">
          <div className="user-info">
            <span className="username">Logged in as: {username}</span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>

        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Requester Management</h1>
            <p className="dashboard-subtitle">Manage who can request access to encrypted data</p>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary btn-lg">
            + Create New Requester
          </button>
        </div>

        {error && (
          <div className="danger-banner">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">👥</div>
            <div className="metric-content">
              <h3>Total Requesters</h3>
              <p className="metric-value">{totalRequesters}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">✅</div>
            <div className="metric-content">
              <h3>Active</h3>
              <p className="metric-value">{enabledRequesters}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">⛔</div>
            <div className="metric-content">
              <h3>Disabled</h3>
              <p className="metric-value">{disabledRequesters}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🔑</div>
            <div className="metric-content">
              <h3>Total API Keys</h3>
              <p className="metric-value">{totalApiKeys}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-section">
          <div className="filter-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">All</option>
                <option value="enabled">Enabled Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>
          <div className="action-buttons-row">
            <button onClick={resetFilters} className="btn btn-outline btn-sm">
              Reset Filters
            </button>
            <button onClick={loadRequesters} className="btn btn-secondary btn-sm">
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Requesters List */}
        {filteredRequesters.length === 0 ? (
          <div className="empty-state">
            <h2>No requesters found</h2>
            <p>{requesters.length === 0 ? 'Create your first requester to get started' : 'Try adjusting your filters'}</p>
            {requesters.length === 0 && (
              <button onClick={openCreateModal} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Create First Requester
              </button>
            )}
          </div>
        ) : (
          <div className="cards-grid">
            {filteredRequesters.map((requester) => (
              <div key={requester.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{requester.name}</h3>
                    {requester.description && (
                      <p className="card-subtitle">{requester.description}</p>
                    )}
                  </div>
                  <span className={`badge ${requester.enabled ? 'badge-success' : 'badge-error'}`}>
                    {requester.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>API Keys:</span>
                      <span className="badge badge-info">{requester.apiKeys.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Created:</span>
                      <span>{new Date(requester.createdAt).toLocaleDateString()}</span>
                    </div>
                    {requester.metadata && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <details>
                          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Metadata</summary>
                          <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', overflow: 'auto' }}>
                            {JSON.stringify(requester.metadata, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-footer">
                  <div className="action-buttons-row">
                    <button
                      onClick={() => router.push(`/requesters/${requester.id}/api-keys`)}
                      className="btn btn-primary btn-sm"
                    >
                      🔑 API Keys
                    </button>
                    <button onClick={() => openEditModal(requester)} className="btn btn-secondary btn-sm">
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => toggleEnabled(requester)}
                      className={`btn btn-sm ${requester.enabled ? 'btn-secondary' : 'btn-success'}`}
                    >
                      {requester.enabled ? '⛔ Disable' : '✅ Enable'}
                    </button>
                    <button onClick={() => openDeleteModal(requester)} className="btn btn-danger btn-sm">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Requester</h2>
                <p>Define a new entity that can request access to encrypted data</p>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  {formError && (
                    <div className="danger-banner">
                      <p>{formError}</p>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="name">Name *</label>
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Analytics Team"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Data analytics team with access to historical metrics"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="metadata">Metadata (JSON)</label>
                    <textarea
                      id="metadata"
                      value={formData.metadata}
                      onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                      placeholder='{"department": "analytics", "tier": "premium"}'
                      disabled={submitting}
                      style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <small>Optional JSON metadata for additional context</small>
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="enabled"
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      disabled={submitting}
                    />
                    <label htmlFor="enabled">Enable immediately</label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Requester'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedRequester && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Requester</h2>
                <p>Update requester information</p>
              </div>
              <form onSubmit={handleUpdate}>
                <div className="modal-body">
                  {formError && (
                    <div className="danger-banner">
                      <p>{formError}</p>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="edit-name">Name *</label>
                    <input
                      id="edit-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-description">Description</label>
                    <textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-metadata">Metadata (JSON)</label>
                    <textarea
                      id="edit-metadata"
                      value={formData.metadata}
                      onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                      disabled={submitting}
                      style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="edit-enabled"
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      disabled={submitting}
                    />
                    <label htmlFor="edit-enabled">Enabled</label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedRequester && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Delete Requester</h2>
                <p>This action cannot be undone</p>
              </div>
              <div className="modal-body">
                <div className="danger-banner">
                  <h3>⚠️ Warning</h3>
                  <p>
                    You are about to delete <strong>{selectedRequester.name}</strong>.
                    This will also delete <strong>{selectedRequester.apiKeys.length} API key(s)</strong> associated with this requester.
                  </p>
                </div>
                <p style={{ marginTop: '1rem' }}>Are you sure you want to continue?</p>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="btn btn-danger"
                  disabled={submitting}
                >
                  {submitting ? 'Deleting...' : 'Delete Requester'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
