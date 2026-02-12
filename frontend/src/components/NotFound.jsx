import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="panel">
        <div className="page-hero">
          <div className="not-found-dog">
            <svg viewBox="0 0 200 200" role="img" aria-label="Cute dog illustration">
              <defs>
                <linearGradient id="dogFace" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f9d6a5" />
                  <stop offset="100%" stopColor="#f4b183" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="70" fill="url(#dogFace)" />
              <circle cx="55" cy="70" r="30" fill="#e59b6f" />
              <circle cx="145" cy="70" r="30" fill="#e59b6f" />
              <circle cx="80" cy="95" r="12" fill="#ffffff" />
              <circle cx="120" cy="95" r="12" fill="#ffffff" />
              <circle cx="80" cy="95" r="6" fill="#3b2f2f" />
              <circle cx="120" cy="95" r="6" fill="#3b2f2f" />
              <circle cx="100" cy="120" r="10" fill="#3b2f2f" />
              <path d="M85 135c10 10 20 10 30 0" stroke="#3b2f2f" strokeWidth="6" strokeLinecap="round" fill="none" />
              <path d="M70 55c-12 -18 -35 -25 -45 -10" stroke="#f4b183" strokeWidth="18" strokeLinecap="round" />
              <path d="M130 55c12 -18 35 -25 45 -10" stroke="#f4b183" strokeWidth="18" strokeLinecap="round" />
              <circle cx="70" cy="118" r="8" fill="#f7b0a1" opacity="0.7" />
              <circle cx="130" cy="118" r="8" fill="#f7b0a1" opacity="0.7" />
            </svg>
          </div>
          <h1 style={{ color: 'var(--primary)', fontSize: '48px', marginBottom: '16px' }}>404</h1>
          <h2 style={{ marginBottom: '16px' }}>Page Not Found</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '18px' }}>
            Oops! The page you're looking for doesn't exist.
          </p>
          <div className="page-actions">
            <button className="primary" onClick={() => navigate('/')}>
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