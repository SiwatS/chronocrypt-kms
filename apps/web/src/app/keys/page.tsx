'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import fetch, { getErrorMessage } from '@/lib/eden-client';

type KeyStatus = any; // Will be inferred from edenFetch response

export default function KeysPage() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string>('');
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeyData();
  }, []);

  const loadKeyData = async () => {
    try {
      setLoading(true);
      const [publicKeyRes, statusRes] = await Promise.all([
        fetch('/api/keys/master-public', {
          method: 'GET'
        }),
        fetch('/api/keys/status', {
          method: 'GET'
        }),
      ]);

      if (publicKeyRes.error) {
        if (publicKeyRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(getErrorMessage(publicKeyRes.error) || 'Failed to load public key');
      }

      if (statusRes.error) {
        throw new Error(getErrorMessage(statusRes.error) || 'Failed to load key status');
      }

      if (publicKeyRes.data && 'publicKey' in publicKeyRes.data) {
        // Convert JWK to JSON string for display
        const jwk = publicKeyRes.data.publicKey;
        const keyString = typeof jwk === 'string' ? jwk : JSON.stringify(jwk, null, 2);
        setPublicKey(keyString);
      }
      setKeyStatus(statusRes.data);
      setError(null);
    } catch (_err: unknown) {
      setError(_err instanceof Error ? _err.message : 'Failed to load key data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err: unknown) {
      alert('Failed to copy to clipboard');
    }
  };

  const downloadKey = () => {
    const blob = new Blob([publicKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chronocrypt-master-public-key.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading Master Key...</h2>
          <p>⏳ Fetching key information</p>
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
          <button onClick={loadKeyData} className="button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Master Public Key</h1>
            <p className="dashboard-subtitle">Distribute this key to DataSources for encryption</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="button"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            ← Back to Dashboard
          </button>
        </header>

        {/* Key Status Overview */}
        <section className="metrics-grid" style={{ marginBottom: '2rem' }}>
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🔐</span>
              <h3>Key Status</h3>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#3498db', marginBottom: '0.5rem' }}>
              {keyStatus?.masterKeyStatus || 'Unknown'}
            </div>
            <div className="metric-footer">
              Algorithm: {keyStatus?.algorithm || 'N/A'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📅</span>
              <h3>Created</h3>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#2c3e50' }}>
              {keyStatus?.createdAt
                ? new Date(keyStatus.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Unknown'}
            </div>
            <div className="metric-footer">
              {keyStatus?.createdAt
                ? new Date(keyStatus.createdAt).toLocaleTimeString()
                : ''}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🔑</span>
              <h3>Key Type</h3>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#2c3e50' }}>
              ECDH P-256
            </div>
            <div className="metric-footer">
              Elliptic Curve Diffie-Hellman
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📏</span>
              <h3>Key Length</h3>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#2c3e50' }}>
              {publicKey.length} chars
            </div>
            <div className="metric-footer">
              Base64 encoded
            </div>
          </div>
        </section>

        {/* Public Key Display */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Public Key</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: copied ? '#10b981' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={downloadKey}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                💾 Download
              </button>
            </div>
          </div>

          <div style={{
            background: '#1f2937',
            color: '#f3f4f6',
            padding: '1.5rem',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            wordBreak: 'break-all',
            lineHeight: '1.8',
            border: '2px solid #374151'
          }}>
            {publicKey}
          </div>
        </section>

        {/* Distribution Instructions */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Distribution Instructions</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#3498db' }}>
                1. For DataSources (Encryption)
              </h3>
              <p style={{ color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
                Distribute this public key to all DataSources that need to encrypt data. They will use this key
                to perform ECDH key exchange and derive encryption keys for time-locked data.
              </p>
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }}>
                # Example: Set as environment variable<br />
                export CHRONOCRYPT_MASTER_PUBLIC_KEY='{publicKey ? publicKey.replace(/\n/g, '') : ''}'
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#3498db' }}>
                2. Security Considerations
              </h3>
              <ul style={{ color: '#6b7280', lineHeight: '1.6', margin: 0, paddingLeft: '1.5rem' }}>
                <li>This is a PUBLIC key - safe to distribute freely</li>
                <li>The private key never leaves the KMS server</li>
                <li>Verify key integrity using secure channels</li>
                <li>Keep a backup of this key for recovery purposes</li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#3498db' }}>
                3. Integration Methods
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📋</div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Copy & Paste</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Copy key directly into your configuration
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💾</div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Download File</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Download as text file and import
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔗</div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>API Endpoint</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Fetch via GET /api/keys/master-public
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Warning Banner */}
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          gap: '1rem',
          alignItems: 'start'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <h3 style={{ color: '#92400e', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              Keep Private Key Secure
            </h3>
            <p style={{ color: '#92400e', margin: 0, fontSize: '0.875rem' }}>
              While the public key shown here can be distributed freely, the master private key must remain
              secure on the KMS server. Never expose the private key or the master seed.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
