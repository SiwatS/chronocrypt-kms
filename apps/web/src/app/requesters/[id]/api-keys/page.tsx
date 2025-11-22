'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { client } from '@/lib/eden-client';
import { useAdmin } from '@/contexts/AdminContext';

interface ApiKey {
  id: string;
  keyId: string;
  name: string;
  enabled: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  createdBy: string;
}

interface Requester {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  apiKeys: ApiKey[];
}

export default function ApiKeysPage() {
  const router = useRouter();
  const params = useParams();
  const requesterId = params.id as string;
  const { isAuthenticated, username, loading: authLoading, logout } = useAdmin();

  const [requester, setRequester] = useState<Requester | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    expiresAt: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Generated key (shown only once)
  const [generatedKey, setGeneratedKey] = useState<{ keyId: string; keySecret: string; fullKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadRequester();
    }
  }, [authLoading, isAuthenticated, requesterId]);

  const loadRequester = async () => {
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
        throw new Error('Failed to load requester');
      }

      if (response.data && 'requesters' in response.data) {
        const found = response.data.requesters.find((r: Requester) => r.id === requesterId);
        if (found) {
          setRequester(found);
        } else {
          throw new Error('Requester not found');
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openGenerateModal = () => {
    setFormData({ name: '', expiresAt: '' });
    setFormError('');
    setShowGenerateModal(true);
  };

  const openDeleteModal = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey);
    setShowDeleteModal(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Key name is required');
      return;
    }

    setSubmitting(true);
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api.requesters[requesterId]['api-keys'].post({
        name: formData.name,
        expiresAt: formData.expiresAt || undefined
      }, {
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to generate API key');
      }

      if (response.data && 'keyId' in response.data && 'keySecret' in response.data) {
        const fullKey = `${response.data.keyId}.${response.data.keySecret}`;
        setGeneratedKey({
          keyId: response.data.keyId as string,
          keySecret: response.data.keySecret as string,
          fullKey
        });
        setShowGenerateModal(false);
        setShowSecretModal(true);
        await loadRequester();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate API key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApiKey) return;

    setSubmitting(true);
    const sessionId = localStorage.getItem('sessionId');

    try {
      const response = await client.api['api-keys'][selectedApiKey.id].delete({
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to delete API key');
      }

      setShowDeleteModal(false);
      await loadRequester();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleApiKey = async (apiKey: ApiKey) => {
    const sessionId = localStorage.getItem('sessionId');
    const endpoint = apiKey.enabled ? 'disable' : 'enable';

    try {
      const response = await client.api['api-keys'][apiKey.id][endpoint].put(undefined, {
        headers: { Authorization: `Bearer ${sessionId}` }
      });

      if (response.error) {
        throw new Error('Failed to update API key');
      }

      await loadRequester();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle API key');
    }
  };

  const toggleRequester = async () => {
    if (!requester) return;

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

      await loadRequester();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle requester');
    }
  };

  const copyToClipboard = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey.fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadKey = () => {
    if (!generatedKey) return;
    const content = `ChronoCrypt KMS API Key
========================

Key ID: ${generatedKey.keyId}
Full API Key: ${generatedKey.fullKey}

IMPORTANT: Keep this key secure! It provides access to request decryption keys.

Usage:
Authorization: ApiKey ${generatedKey.fullKey}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronocrypt-api-key-${generatedKey.keyId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (authLoading || loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading API Keys...</h2>
          <p>⏳ Fetching data</p>
        </div>
      </div>
    );
  }

  if (!requester) {
    return (
      <div className="container">
        <div className="error">
          <h2>Requester Not Found</h2>
          <p>{error || 'The requested requester could not be found'}</p>
          <button onClick={() => router.push('/requesters')} className="btn btn-primary">
            Back to Requesters
          </button>
        </div>
      </div>
    );
  }

  const activeKeys = requester.apiKeys.filter(k => k.enabled && !isExpired(k.expiresAt)).length;
  const expiredKeys = requester.apiKeys.filter(k => isExpired(k.expiresAt)).length;
  const lastUsed = requester.apiKeys
    .filter(k => k.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())[0];

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

        <a href="/requesters" className="back-button">
          ← Back to Requesters
        </a>

        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">API Keys for {requester.name}</h1>
            {requester.description && (
              <p className="dashboard-subtitle">{requester.description}</p>
            )}
          </div>
          <button onClick={openGenerateModal} className="btn btn-primary btn-lg">
            + Generate API Key
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

        {/* Requester Info */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Requester Information</h3>
            </div>
            <span className={`badge ${requester.enabled ? 'badge-success' : 'badge-error'}`}>
              {requester.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Created</div>
                <div style={{ fontWeight: 600 }}>{new Date(requester.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Updated</div>
                <div style={{ fontWeight: 600 }}>{new Date(requester.updatedAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Total API Keys</div>
                <div style={{ fontWeight: 600 }}>{requester.apiKeys.length}</div>
              </div>
            </div>
          </div>
          <div className="card-footer">
            <button
              onClick={toggleRequester}
              className={`btn btn-sm ${requester.enabled ? 'btn-secondary' : 'btn-success'}`}
            >
              {requester.enabled ? '⛔ Disable Requester' : '✅ Enable Requester'}
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">🔑</div>
            <div className="metric-content">
              <h3>Total Keys</h3>
              <p className="metric-value">{requester.apiKeys.length}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">✅</div>
            <div className="metric-content">
              <h3>Active Keys</h3>
              <p className="metric-value">{activeKeys}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">⏰</div>
            <div className="metric-content">
              <h3>Expired Keys</h3>
              <p className="metric-value">{expiredKeys}</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <h3>Last Used</h3>
              <p className="metric-value" style={{ fontSize: '1rem' }}>
                {lastUsed ? getRelativeTime(lastUsed.lastUsedAt!) : 'Never'}
              </p>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        {requester.apiKeys.length === 0 ? (
          <div className="empty-state">
            <h2>No API keys generated yet</h2>
            <p>API keys allow programmatic access to request decryption keys</p>
            <button onClick={openGenerateModal} className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generate First API Key
            </button>
          </div>
        ) : (
          <div className="data-grid" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1.5fr 2fr' }}>
            <div className="data-grid-header">
              <div>Key Name</div>
              <div>Key ID</div>
              <div>Status</div>
              <div>Created</div>
              <div>Last Used</div>
              <div>Actions</div>
            </div>
            {requester.apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="data-grid-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{apiKey.name}</div>
                  {apiKey.expiresAt && (
                    <div style={{ fontSize: '0.75rem', color: isExpired(apiKey.expiresAt) ? '#ef4444' : '#64748b', marginTop: '0.25rem' }}>
                      {isExpired(apiKey.expiresAt) ? 'Expired: ' : 'Expires: '}
                      {new Date(apiKey.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div>
                  <code className="code-inline">{apiKey.keyId}</code>
                </div>
                <div>
                  {isExpired(apiKey.expiresAt) ? (
                    <span className="badge badge-error">Expired</span>
                  ) : apiKey.enabled ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-gray">Disabled</span>
                  )}
                </div>
                <div>
                  <div>{new Date(apiKey.createdAt).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>by {apiKey.createdBy}</div>
                </div>
                <div>
                  {apiKey.lastUsedAt ? (
                    <div>{getRelativeTime(apiKey.lastUsedAt)}</div>
                  ) : (
                    <div style={{ color: '#9ca3af' }}>Never</div>
                  )}
                </div>
                <div>
                  <div className="action-buttons-row">
                    <button
                      onClick={() => toggleApiKey(apiKey)}
                      className={`btn btn-sm ${apiKey.enabled ? 'btn-secondary' : 'btn-success'}`}
                      disabled={isExpired(apiKey.expiresAt)}
                    >
                      {apiKey.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => openDeleteModal(apiKey)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate API Key Modal */}
        {showGenerateModal && (
          <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Generate New API Key</h2>
                <p>Create a new API key for {requester.name}</p>
              </div>
              <form onSubmit={handleGenerate}>
                <div className="modal-body">
                  {formError && (
                    <div className="danger-banner">
                      <p>{formError}</p>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="keyName">Key Name *</label>
                    <input
                      id="keyName"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Production Server"
                      required
                      disabled={submitting}
                    />
                    <small>A descriptive name to identify where this key is used</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="expiresAt">Expiration Date (Optional)</label>
                    <input
                      id="expiresAt"
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={submitting}
                    />
                    <small>Leave empty for no expiration</small>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="btn btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Generating...' : 'Generate API Key'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* API Key Secret Display Modal */}
        {showSecretModal && generatedKey && (
          <div className="modal-overlay" onClick={() => {}}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <div className="modal-header">
                <h2>API Key Generated Successfully!</h2>
              </div>
              <div className="modal-body">
                <div className="warning-banner">
                  <h3>⚠️ Important: Save This Key Now!</h3>
                  <p>
                    This is the only time you'll see the complete API key.
                    Make sure to copy it and store it securely before closing this window.
                  </p>
                </div>

                <div className="form-group">
                  <label>Your API Key</label>
                  <div className="code-display" style={{ fontSize: '1rem', padding: '1.5rem' }}>
                    {generatedKey.fullKey}
                  </div>
                </div>

                <div className="action-buttons-row" style={{ marginBottom: '1.5rem' }}>
                  <button
                    onClick={copyToClipboard}
                    className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                  >
                    {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
                  </button>
                  <button onClick={downloadKey} className="btn btn-secondary">
                    💾 Download as File
                  </button>
                </div>

                <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>Usage Instructions</h4>
                  <p style={{ marginBottom: '0.5rem' }}>Include this key in your API requests:</p>
                  <div className="code-display" style={{ marginTop: '0.5rem' }}>
                    Authorization: ApiKey {generatedKey.fullKey}
                  </div>
                  <p style={{ marginTop: '1rem', marginBottom: 0, color: '#64748b' }}>
                    <strong>Key ID:</strong> <code className="code-inline">{generatedKey.keyId}</code> (public, used for identification)
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowSecretModal(false);
                    setGeneratedKey(null);
                    setCopied(false);
                  }}
                  className="btn btn-primary btn-lg"
                >
                  I've Saved This Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedApiKey && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Delete API Key</h2>
                <p>This action cannot be undone</p>
              </div>
              <div className="modal-body">
                <div className="danger-banner">
                  <h3>⚠️ Warning</h3>
                  <p>
                    You are about to delete the API key <strong>{selectedApiKey.name}</strong> ({selectedApiKey.keyId}).
                    Any applications using this key will no longer be able to access the KMS.
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
                  {submitting ? 'Deleting...' : 'Delete API Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
