import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="panel">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h1 style={{ color: 'var(--primary)', fontSize: '48px', marginBottom: '16px' }}>404</h1>
          <h2 style={{ marginBottom: '16px' }}>Page Not Found</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '18px' }}>
            Oops! The page you're looking for doesn't exist.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="primary" onClick={() => navigate('/')}>
              Go Home
            </button>
            <button className="ghost" onClick={() => navigate('/admin')}>
              Admin Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}