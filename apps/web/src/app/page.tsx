'use client';

import { useEffect, useState } from 'react';

interface ApiStatus {
  message?: string;
  version?: string;
  status?: string;
  error?: string;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/`)
      .then((res) => res.json())
      .then((data) => {
        setApiStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        setApiStatus({ error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <main className="main">
        <h1 className="title">ChronoCrypt KMS</h1>
        <p className="description">Key Management System</p>

        <div className="grid">
          <div className="card">
            <h2>Frontend Status</h2>
            <p>✅ Next.js Running</p>
            <p>Port: 3000</p>
          </div>

          <div className="card">
            <h2>Backend Status</h2>
            {loading ? (
              <p>⏳ Loading...</p>
            ) : apiStatus?.error ? (
              <p>❌ {apiStatus.error}</p>
            ) : (
              <>
                <p>✅ {apiStatus?.status || 'Connected'}</p>
                <p>Version: {apiStatus?.version}</p>
              </>
            )}
          </div>
        </div>

        <div className="features">
          <h2>Features</h2>
          <ul>
            <li>🔐 Key Generation & Management</li>
            <li>🔒 Encryption & Decryption</li>
            <li>📊 Key Lifecycle Management</li>
            <li>🔄 Key Rotation</li>
            <li>📝 Audit Logging</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
