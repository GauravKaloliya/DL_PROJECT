import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function ApiDocs() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchApiDocs();
  }, []);

  const fetchApiDocs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/docs`);
      if (!response.ok) {
        throw new Error('Failed to fetch API documentation');
      }
      const data = await response.json();
      setDocs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  if (loading) {
    return (
      <div className="app">
        <div className="panel">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2>Loading API Documentation...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="panel">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2>Error Loading Documentation</h2>
            <p style={{ color: 'var(--muted)' }}>{error}</p>
            <button className="primary" onClick={fetchApiDocs}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!docs) {
    return (
      <div className="app">
        <div className="panel">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2>No Documentation Available</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary)' }}>API Documentation</h1>
            <p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>
              {docs.title} v{docs.version}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="ghost" onClick={() => navigate('/')}>
              Home
            </button>
            <button className="ghost" onClick={() => navigate('/admin')}>
              Admin
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2>Description</h2>
          <p style={{ color: 'var(--muted)', fontSize: '16px' }}>{docs.description}</p>
        </div>

        {docs.authentication && (
          <div style={{ marginBottom: '32px' }}>
            <h2>Authentication</h2>
            <p><strong>Type:</strong> {docs.authentication.type}</p>
            <p style={{ color: 'var(--muted)' }}>{docs.authentication.description}</p>
            <h4>Methods:</h4>
            <ul>
              {docs.authentication.methods.map((method, index) => (
                <li key={index}><code>{method}</code></li>
              ))}
            </ul>
          </div>
        )}

        {docs.endpoints && (
          <div>
            <h2>Endpoints</h2>
            
            {docs.endpoints.public && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ color: 'var(--primary)' }}>Public Endpoints</h3>
                <p style={{ color: 'var(--muted)' }}>{docs.endpoints.public.description}</p>
                
                {docs.endpoints.public.routes.map((route, index) => (
                  <div key={index} style={{ 
                    border: '1px solid var(--border)', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    marginBottom: '16px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ 
                        background: 'var(--success)', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '6px', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }}>
                        {route.method}
                      </span>
                      <code style={{ fontSize: '14px', color: 'var(--text)' }}>{route.path}</code>
                      <button 
                        className="ghost" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => copyToClipboard(route.path)}
                      >
                        Copy
                      </button>
                    </div>
                    
                    <p style={{ color: 'var(--muted)', marginBottom: '12px' }}>{route.description}</p>
                    
                    {route.parameters && route.parameters.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <h5>Parameters:</h5>
                        <ul>
                          {route.parameters.map((param, paramIndex) => (
                            <li key={paramIndex}>
                              <code>{param.name}</code> ({param.type}){param.required && ' - required'}
                              {param.description && <span style={{ color: 'var(--muted)' }}> - {param.description}</span>}
                              {param.default && <span style={{ color: 'var(--muted)' }}> (default: {param.default})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {route.request_body && (
                      <div style={{ marginBottom: '12px' }}>
                        <h5>Request Body:</h5>
                        <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '6px' }}>
                          <pre style={{ margin: 0, fontSize: '12px' }}>
                            {JSON.stringify(route.request_body, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {route.response && (
                      <div>
                        <h5>Response:</h5>
                        <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '6px' }}>
                          <pre style={{ margin: 0, fontSize: '12px' }}>
                            {JSON.stringify(route.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '32px', padding: '20px', background: 'var(--secondary)', borderRadius: '12px' }}>
          <h3>Usage Example</h3>
          <p>Base URL: <code>{window.location.origin}</code></p>
          <p>Full endpoint example:</p>
          <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '6px' }}>
            <pre style={{ margin: 0, fontSize: '14px' }}>
{`// Get a random image
fetch('${API_BASE}/api/images/random?type=normal', {
  headers: {
    'X-API-KEY': 'your-api-key-here'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
            </pre>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--muted)', fontSize: '14px' }}>
          Created by Gaurav Kaloliya
        </div>
      </div>
    </div>
  );
}