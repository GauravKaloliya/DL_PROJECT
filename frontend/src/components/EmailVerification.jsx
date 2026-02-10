import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Verifying your email...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing');
      setError('No verification token provided');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      setStatus('verifying');
      setMessage('Verifying your email...');
      
      const response = await fetch(`${API_BASE}/api/admin/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Email verified successfully! You can now log in to the admin panel.');
        
        // Auto-redirect to admin login after 3 seconds
        setTimeout(() => {
          navigate('/admin');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed');
        setError(data.error);
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error occurred during verification');
      setError(err.message);
    }
  };

  const handleGoToLogin = () => {
    navigate('/admin');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="app">
      <div className="panel">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          {status === 'verifying' && (
            <>
              <div style={{ fontSize: '120px', marginBottom: '20px' }}>🔄</div>
              <h1 style={{ color: 'var(--primary)', marginBottom: '16px' }}>Verifying Email</h1>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div style={{ fontSize: '120px', marginBottom: '20px' }}>✅</div>
              <h1 style={{ color: 'var(--success)', marginBottom: '16px' }}>Email Verified!</h1>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div style={{ fontSize: '120px', marginBottom: '20px' }}>❌</div>
              <h1 style={{ color: 'var(--warning)', marginBottom: '16px' }}>Verification Failed</h1>
            </>
          )}
          
          <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '18px' }}>
            {message}
          </p>
          
          {status === 'success' && (
            <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '14px' }}>
              Redirecting to admin login in 3 seconds...
            </p>
          )}
          
          {error && (
            <div style={{ 
              background: 'var(--secondary)', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '32px',
              color: 'var(--warning)',
              textAlign: 'left'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {status === 'success' && (
              <button className="primary" onClick={handleGoToLogin}>
                Go to Login 🔐
              </button>
            )}
            
            <button className="ghost" onClick={handleGoHome}>
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