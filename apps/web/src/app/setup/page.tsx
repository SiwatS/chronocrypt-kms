'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/lib/eden-client';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if setup is needed
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      // Try to create a setup (will fail if admins already exist)
      // We'll use a different approach - just try to login page
      // For now, assume setup is needed if we're on this page
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setSubmitting(true);

    try {
      const response = await client.api.admin.setup.post({
        username: formData.username,
        password: formData.password,
        email: formData.email || undefined
      });

      if (response.error) {
        if (response.status === 403) {
          setSetupComplete(true);
          setTimeout(() => router.push('/login'), 2000);
        } else {
          setError(response.error.message || 'Setup failed');
        }
      } else {
        // Setup successful, redirect to login
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (err) {
      setError('Failed to complete setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="setup-container">
        <div className="setup-card">
          <div className="setup-header">
            <h1>ChronoCrypt KMS</h1>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="setup-container">
        <div className="setup-card">
          <div className="setup-header">
            <h1>Setup Already Complete</h1>
            <p>Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <h1>Welcome to ChronoCrypt KMS</h1>
          <p>Create your admin account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="admin"
              required
              minLength={3}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@example.com"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={8}
              disabled={submitting}
            />
            <small>Minimum 8 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              required
              minLength={8}
              disabled={submitting}
            />
          </div>

          <button type="submit" className="setup-button" disabled={submitting}>
            {submitting ? 'Creating Account...' : 'Create Admin Account'}
          </button>
        </form>

        <div className="setup-info">
          <p>This account will have full access to manage:</p>
          <ul>
            <li>Requesters and API keys</li>
            <li>Access policies</li>
            <li>Audit logs</li>
            <li>System statistics</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .setup-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .setup-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
        }

        .setup-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .setup-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 8px;
        }

        .setup-header p {
          color: #718096;
          font-size: 16px;
        }

        .setup-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          color: #2d3748;
          font-size: 14px;
        }

        .form-group input {
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .form-group small {
          color: #718096;
          font-size: 13px;
        }

        .error-message {
          background-color: #fed7d7;
          color: #c53030;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          border: 1px solid #fc8181;
        }

        .setup-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          margin-top: 8px;
        }

        .setup-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .setup-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .setup-info {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 2px solid #e2e8f0;
        }

        .setup-info p {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 12px;
        }

        .setup-info ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .setup-info li {
          color: #718096;
          padding: 6px 0;
          padding-left: 24px;
          position: relative;
        }

        .setup-info li:before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #667eea;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}
