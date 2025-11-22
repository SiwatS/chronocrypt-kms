'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import fetch, { getErrorMessage } from '@/lib/eden-client';

type Policy = any; // Will be inferred from edenFetch response

export default function PoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('time-based');
  const [formPriority, setFormPriority] = useState(100);
  const [formConfig, setFormConfig] = useState('{}');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/policies', {
        method: 'GET'
      });

      if (response.error) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(getErrorMessage(response.error) || 'Failed to load policies');
      }

      if (response.data && Array.isArray(response.data)) {
        setPolicies(response.data.sort((a: any, b: any) => b.priority - a.priority));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = async () => {
    try {
      let configObj;
      try {
        configObj = JSON.parse(formConfig);
      } catch {
        alert('Invalid JSON configuration');
        return;
      }

      const response = await fetch('/api/policies', {
        method: 'POST',
        body: {
          name: formName,
          type: formType,
          priority: formPriority,
          config: configObj,
          description: formDescription || undefined,
        }
      });

      if (response.error) {
        throw new Error(getErrorMessage(response.error) || 'Failed to create policy');
      }

      // Reset form
      setFormName('');
      setFormType('time-based');
      setFormPriority(100);
      setFormConfig('{}');
      setFormDescription('');
      setShowCreateForm(false);

      // Reload policies
      await loadPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create policy');
    }
  };

  const handleTogglePolicy = async (policy: Policy) => {
    try {
      const endpoint = policy.enabled ? 'disable' : 'enable';

      const response = await fetch(`/api/policies/:id/${endpoint}`, {
        method: 'PUT',
        params: { id: policy.id }
      });

      if (response.error) {
        throw new Error(getErrorMessage(response.error) || `Failed to ${policy.enabled ? 'disable' : 'enable'} policy`);
      }

      await loadPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/policies/:id', {
        method: 'DELETE',
        params: { id: policyId }
      });

      const apiError = response.error;

      if (apiError) {
        throw new Error('Failed to delete policy');
      }

      await loadPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading Policies...</h2>
          <p>⏳ Fetching policy configurations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Policy Management</h1>
            <p className="dashboard-subtitle">Configure access control policies</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="button"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: showCreateForm ? '#6b7280' : '#3498db'
              }}
            >
              {showCreateForm ? 'Cancel' : '+ New Policy'}
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

        {error && (
          <div className="error" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
            <button onClick={loadPolicies} className="button">Retry</button>
          </div>
        )}

        {/* Create Policy Form */}
        {showCreateForm && (
          <section style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Create New Policy</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Business Hours Only"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e9ecef',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Type *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e9ecef',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="time-based">Time-Based</option>
                    <option value="role-based">Role-Based</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Priority *
                  </label>
                  <input
                    type="number"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    placeholder="100"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e9ecef',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Configuration (JSON) *
                </label>
                <textarea
                  value={formConfig}
                  onChange={(e) => setFormConfig(e.target.value)}
                  placeholder='{"allowedHours": [9, 17]}'
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e9ecef',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description of this policy"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e9ecef',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleCreatePolicy}
                  className="button"
                  disabled={!formName || !formConfig}
                  style={{
                    opacity: !formName || !formConfig ? 0.5 : 1,
                    cursor: !formName || !formConfig ? 'not-allowed' : 'pointer'
                  }}
                >
                  Create Policy
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Policies List */}
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Active Policies ({policies.length})</h2>

          {policies.length === 0 ? (
            <div className="empty-state" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <p style={{ fontSize: '1.1rem', color: '#6b7280' }}>
                No policies configured yet. Create your first policy to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    borderLeft: `4px solid ${policy.enabled ? '#3498db' : '#95a5a6'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                          {policy.name}
                        </h3>
                        <span className={`status-badge ${policy.enabled ? 'status-healthy' : 'status-error'}`}>
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f3f4f6',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          Priority: {policy.priority}
                        </span>
                      </div>
                      {policy.description && (
                        <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>{policy.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                        <span>Type: <strong>{policy.type}</strong></span>
                        <span>Created: {new Date(policy.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setSelectedPolicy(selectedPolicy?.id === policy.id ? null : policy)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          background: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedPolicy?.id === policy.id ? 'Hide' : 'View Config'}
                      </button>
                      <button
                        onClick={() => handleTogglePolicy(policy)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          background: policy.enabled ? '#f59e0b' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {policy.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {selectedPolicy?.id === policy.id && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Configuration:
                      </h4>
                      <pre style={{
                        background: '#1f2937',
                        color: '#f3f4f6',
                        padding: '1rem',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        margin: 0
                      }}>
                        {JSON.stringify(policy.config, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
