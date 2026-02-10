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
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '120px', marginBottom: '20px' }}>💔</div>
          <h1 style={{ color: 'var(--warning)', fontSize: '48px', marginBottom: '16px' }}>Oops!</h1>
          <h2 style={{ marginBottom: '16px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '18px' }}>
            {error?.message || "An unexpected error occurred. Please try again."}
          </p>
          
          {error?.stack && process.env.NODE_ENV === 'development' && (
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
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="primary" onClick={handleReset}>
              Try Again 🔄
            </button>
            <button className="ghost" onClick={() => navigate('/')}>
              Go Home 🏠
            </button>
            <button className="ghost" onClick={() => navigate('/admin')}>
              Admin Panel 🛠️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}