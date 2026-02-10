import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function ApiDocs() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

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

  return (
    <div className="app">
      <div className="panel">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary)' }}>C.O.G.N.I.T. API Reference</h1>
            <p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>
              Version 2.0.0 • API Documentation
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="ghost" onClick={() => navigate('/')}>
              ← Back to Survey
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '32px',
          borderBottom: '2px solid var(--border)',
          flexWrap: 'wrap'
        }}>
          {['overview', 'authentication', 'endpoints', 'examples', 'errors'].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              style={{
                padding: '12px 24px',
                background: activeSection === section ? 'rgba(24, 119, 242, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: activeSection === section ? '3px solid var(--primary)' : '3px solid transparent',
                color: activeSection === section ? 'var(--primary)' : 'var(--muted)',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                borderRadius: '8px 8px 0 0'
              }}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>Overview</h2>
            <p style={{ fontSize: '16px', lineHeight: '1.6' }}>
              The C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) API 
              provides programmatic access to the research platform. This RESTful API allows you to 
              integrate image description tasks into your applications, manage submissions, and 
              retrieve research data.
            </p>
            
            <h3 style={{ marginTop: '32px' }}>Base URL</h3>
            <div style={{ 
              background: 'var(--bg)', 
              padding: '16px', 
              borderRadius: '12px',
              border: '2px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              {window.location.origin}/api
            </div>

            <h3 style={{ marginTop: '32px' }}>Features</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li><strong>Image Management:</strong> Fetch random images for the study by type (normal, practice, attention)</li>
              <li><strong>Data Submission:</strong> Submit participant responses with descriptions and ratings</li>
              <li><strong>Demographic Collection:</strong> Capture participant information including username, age, gender, and language</li>
              <li><strong>Admin Dashboard:</strong> Access statistics, export data, and manage the platform</li>
              <li><strong>Security:</strong> Session-based authentication with rate limiting and CORS protection</li>
            </ul>

            <h3 style={{ marginTop: '32px' }}>Quick Start</h3>
            <ol style={{ lineHeight: '1.8' }}>
              <li>Login to the admin panel with your username and password</li>
              <li>Make your first request to <code>/api/images/random</code></li>
              <li>Submit participant data via <code>/api/submit</code></li>
              <li>Download results from the admin panel</li>
            </ol>
          </div>
        )}

        {/* Authentication Section */}
        {activeSection === 'authentication' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>Authentication</h2>
            <p>
              The API uses session-based authentication for admin endpoints. Login with your 
              username and password to obtain a session token. Public endpoints for image 
              retrieval and data submission do not require authentication.
            </p>

            <h3 style={{ marginTop: '24px' }}>Session Token Method</h3>
            <div style={{ marginTop: '16px' }}>
              <h4>Step 1: Login to get a session token</h4>
              <div style={{ 
                background: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '12px',
                border: '2px solid var(--border)',
                marginTop: '12px'
              }}>
                <code style={{ fontSize: '14px' }}>
                  POST /api/admin/login<br />
                  Body: {`{ "username": "your-username", "password": "your-password" }`}
                </code>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h4>Step 2: Use the session token in headers</h4>
              <div style={{ 
                background: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '12px',
                border: '2px solid var(--border)',
                marginTop: '12px'
              }}>
                <code style={{ fontSize: '14px' }}>
                  X-SESSION-TOKEN: your-session-token-here
                </code>
              </div>
            </div>

            <div style={{ 
              marginTop: '32px',
              padding: '20px',
              background: '#fff5e6',
              borderRadius: '12px',
              border: '2px solid #ffe0b3'
            }}>
              <h4 style={{ marginTop: 0, color: '#d97706' }}>⚠️ Security Notice</h4>
              <p style={{ marginBottom: 0 }}>
                Keep your session token secure and never expose it in client-side code. 
                Session tokens expire after 24 hours for security.
              </p>
            </div>
          </div>
        )}

        {/* Endpoints Section */}
        {activeSection === 'endpoints' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>API Endpoints</h2>
            
            {/* Public Endpoints */}
            <h3 style={{ marginTop: '24px' }}>Public Endpoints</h3>
            
            {/* Get Random Image */}
            <EndpointCard
              method="GET"
              path="/api/images/random"
              description="Retrieve a random image for the study"
              parameters={[
                { name: 'type', type: 'string', required: false, description: 'Image type: normal, practice, or attention', default: 'normal' }
              ]}
              response={{
                "image_id": "normal/image1.jpg",
                "image_url": "/api/images/normal/image1.jpg",
                "is_practice": false,
                "is_attention": false
              }}
            />

            {/* Submit Data */}
            <EndpointCard
              method="POST"
              path="/api/submit"
              description="Submit participant response data"
              requestBody={{
                "participant_id": "string (required)",
                "session_id": "string (required)",
                "image_id": "string (required)",
                "description": "string (required, min 30 words)",
                "rating": "integer (required, 1-10)",
                "feedback": "string (required, min 5 chars)",
                "time_spent_seconds": "number (required)",
                "is_practice": "boolean (required)",
                "is_attention": "boolean (required)",
                "attention_expected": "string (for attention checks)",
                "username": "string",
                "gender": "string",
                "age": "string",
                "place": "string",
                "native_language": "string",
                "prior_experience": "string"
              }}
              response={{
                "status": "ok",
                "word_count": 45,
                "attention_passed": true
              }}
            />

            {/* Get Image */}
            <EndpointCard
              method="GET"
              path="/api/images/{image_id}"
              description="Serve a specific image file"
              parameters={[
                { name: 'image_id', type: 'string', required: true, description: 'ID of the image to retrieve' }
              ]}
              response="Binary image data"
            />

            {/* Admin Endpoints */}
            <h3 style={{ marginTop: '40px' }}>Admin Endpoints (Authentication Required)</h3>

            <EndpointCard
              method="GET"
              path="/api/stats"
              description="Get platform statistics"
              auth={true}
              response={{
                "total_submissions": 150,
                "avg_word_count": 42.5,
                "attention_fail_rate": 0.05
              }}
            />

            <EndpointCard
              method="GET"
              path="/admin/download"
              description="Download all submissions as CSV file"
              auth={true}
              response="CSV file attachment"
            />

            <EndpointCard
              method="GET"
              path="/admin/csv-data"
              description="Get CSV data as JSON for admin panel"
              auth={true}
              response="[{...submission objects...}]"
            />

            <EndpointCard
              method="DELETE"
              path="/admin/settings/csv-delete"
              description="Delete all data from CSV file"
              auth={true}
              response={{
                "status": "success",
                "message": "All CSV data has been deleted successfully"
              }}
            />
          </div>
        )}

        {/* Examples Section */}
        {activeSection === 'examples' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>Code Examples</h2>

            <h3 style={{ marginTop: '24px' }}>JavaScript / Fetch</h3>
            <CodeBlock code={`// Get a random image
const response = await fetch('/api/images/random?type=normal');
const image = await response.json();
console.log(image.image_url);

// Submit participant data
const submission = {
  participant_id: 'user-123',
  session_id: 'session-456',
  image_id: 'normal/image1.jpg',
  description: 'The image shows a beautiful sunset over mountains...',
  rating: 8,
  feedback: 'Interesting image',
  time_spent_seconds: 45,
  is_practice: false,
  is_attention: false,
  username: 'john_doe',
  gender: 'male',
  age: '25',
  place: 'New York',
  native_language: 'English',
  prior_experience: 'Photography'
};

const submitResponse = await fetch('/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(submission)
});

const result = await submitResponse.json();
console.log(result.status); // 'ok'`} />

            <h3 style={{ marginTop: '32px' }}>Python / Requests</h3>
            <CodeBlock code={`import requests

# Get a random image
response = requests.get('http://localhost:5000/api/images/random?type=normal')
image = response.json()
print(image['image_url'])

# Submit participant data
submission = {
    'participant_id': 'user-123',
    'session_id': 'session-456',
    'image_id': 'normal/image1.jpg',
    'description': 'The image shows a beautiful sunset...',
    'rating': 8,
    'feedback': 'Interesting image',
    'time_spent_seconds': 45,
    'is_practice': False,
    'is_attention': False,
    'username': 'john_doe',
    'gender': 'male',
    'age': '25',
    'place': 'New York',
    'native_language': 'English',
    'prior_experience': 'Photography'
}

response = requests.post(
    'http://localhost:5000/api/submit',
    json=submission
)
result = response.json()
print(result['status'])  # 'ok'`} />

            <h3 style={{ marginTop: '32px' }}>cURL</h3>
            <CodeBlock code={`# Get a random image
curl -X GET "http://localhost:5000/api/images/random?type=normal"

# Submit participant data
curl -X POST "http://localhost:5000/api/submit" \\
  -H "Content-Type: application/json" \\
  -d '{
    "participant_id": "user-123",
    "session_id": "session-456",
    "image_id": "normal/image1.jpg",
    "description": "The image shows...",
    "rating": 8,
    "feedback": "Great image",
    "time_spent_seconds": 45,
    "is_practice": false,
    "is_attention": false,
    "username": "john_doe"
  }'

# Get admin stats (requires session token)
curl -X GET "http://localhost:5000/api/stats" \\
  -H "X-SESSION-TOKEN: YOUR_SESSION_TOKEN"`} />
          </div>
        )}

        {/* Errors Section */}
        {activeSection === 'errors' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>Error Handling</h2>
            <p>
              The API uses standard HTTP response codes to indicate the success or failure of requests.
            </p>

            <h3 style={{ marginTop: '24px' }}>HTTP Status Codes</h3>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              marginTop: '16px'
            }}>
              <thead>
                <tr style={{ background: 'var(--primary)', color: 'white' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Code</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Meaning</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}><code>200</code></td>
                  <td style={{ padding: '12px' }}>OK</td>
                  <td style={{ padding: '12px' }}>Request succeeded</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}><code>400</code></td>
                  <td style={{ padding: '12px' }}>Bad Request</td>
                  <td style={{ padding: '12px' }}>Invalid parameters or missing required fields</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}><code>401</code></td>
                  <td style={{ padding: '12px' }}>Unauthorized</td>
                  <td style={{ padding: '12px' }}>Invalid or missing session token</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}><code>404</code></td>
                  <td style={{ padding: '12px' }}>Not Found</td>
                  <td style={{ padding: '12px' }}>Resource not found</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}><code>429</code></td>
                  <td style={{ padding: '12px' }}>Too Many Requests</td>
                  <td style={{ padding: '12px' }}>Rate limit exceeded</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px' }}><code>500</code></td>
                  <td style={{ padding: '12px' }}>Internal Server Error</td>
                  <td style={{ padding: '12px' }}>Server-side error</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ marginTop: '32px' }}>Error Response Format</h3>
            <CodeBlock code={`{
  "error": "Description of what went wrong"
}`} />

            <h3 style={{ marginTop: '32px' }}>Common Errors</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li><code>Minimum 30 words required</code> - Description is too short</li>
              <li><code>rating must be an integer between 1-10</code> - Invalid rating value</li>
              <li><code>comments must be at least 5 characters</code> - Feedback is too short</li>
              <li><code>image_id is required</code> - Missing required field</li>
            </ul>
          </div>
        )}

        {/* Footer */}
        <div style={{ 
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '2px solid var(--border)',
          textAlign: 'center',
          color: 'var(--muted)'
        }}>
          <p>C.O.G.N.I.T. API Documentation • Created by Gaurav Kaloliya</p>
          <p style={{ fontSize: '14px' }}>
            For support, contact <strong>research@cognit.org</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function EndpointCard({ method, path, description, parameters, requestBody, response, auth }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const methodColors = {
    GET: '#42b72a',
    POST: '#1877f2',
    PUT: '#ffb347',
    DELETE: '#c9444a',
    PATCH: '#9966ff'
  };

  return (
    <div style={{ 
      border: '2px solid var(--border)', 
      borderRadius: '12px', 
      marginBottom: '16px',
      overflow: 'hidden'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '16px 20px',
          background: 'var(--bg)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <span style={{
          background: methodColors[method] || '#666',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {method}
        </span>
        <code style={{ fontSize: '14px', color: 'var(--text)' }}>{path}</code>
        {auth && (
          <span style={{
            background: '#fff5e6',
            color: '#d97706',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            🔒 Auth Required
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '20px' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '20px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>{description}</p>

          {parameters && parameters.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Parameters</h4>
              <table style={{ width: '100%', fontSize: '14px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px' }}>Name</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Required</th>
                    <th style={{ padding: '8px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map((param, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}><code>{param.name}</code></td>
                      <td style={{ padding: '8px' }}>{param.type}</td>
                      <td style={{ padding: '8px' }}>{param.required ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '8px' }}>{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {requestBody && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Request Body</h4>
              <CodeBlock code={JSON.stringify(requestBody, null, 2)} small />
            </div>
          )}

          {response && (
            <div>
              <h4 style={{ marginBottom: '8px' }}>Response</h4>
              <CodeBlock code={typeof response === 'string' ? response : JSON.stringify(response, null, 2)} small />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, small }) {
  return (
    <div style={{ 
      background: '#1e1e1e',
      color: '#d4d4d4',
      padding: small ? '12px' : '16px',
      borderRadius: '8px',
      overflow: 'auto',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: small ? '12px' : '14px',
      lineHeight: '1.5'
    }}>
      <pre style={{ margin: 0 }}>{code}</pre>
    </div>
  );
}
