import React from 'react';
import { useNavigate } from 'react-router-dom';
import dogImage from '../assets/cute-dog.svg';

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
          <img
            src={dogImage}
            alt="Cute dog illustration"
            style={{ maxWidth: '280px', width: '100%', margin: '0 auto 24px', display: 'block' }}
          />
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
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