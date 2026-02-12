import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ErrorPage({ error, resetError }) {
  const navigate = useNavigate();

  const handleReset = () => {
    if (resetError) {
      resetError();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="app">
      <div className="panel">
        <div className="page-hero">
          <h1 style={{ color: 'var(--warning)', fontSize: '48px', marginBottom: '16px' }}>Oops!</h1>
          <h2 style={{ marginBottom: '16px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '18px' }}>
            {error?.message || "An unexpected error occurred. Please try again."}
          </p>

          {error?.stack && import.meta.env.DEV && (
            <details style={{ marginBottom: '32px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '16px' }}>Error Details (Development)</summary>
              <pre style={{ 
                background: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '8px', 
                overflow: 'auto',
                fontSize: '12px',
                maxHeight: '300px'
              }}>
                {error.stack}
              </pre>
            </details>
          )}

          <div className="page-actions">
            <button className="primary" onClick={handleReset}>
              Try Again
            </button>
            <button className="ghost" onClick={() => navigate('/')}>
              Go Home
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--muted)', fontSize: '14px' }}>
            Created by Gaurav Kaloliya
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
            <strong>Gaurav Kaloliya</strong> - Innovating Cognitive Research Tools
          </div>
        </div>
      </div>
    </div>
  );
}