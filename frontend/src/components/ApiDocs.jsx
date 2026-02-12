import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getApiUrl } from "../utils/apiBase";

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
      const response = await fetch(getApiUrl('/api/docs'));
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

  const apiBaseUrl = API_BASE ? `${API_BASE}/api` : `${window.location.origin}/api`;

  // Render endpoint from fetched docs
  const renderEndpointFromDocs = (key, endpoint) => {
    if (!endpoint) return null;
    return (
      <EndpointCard
        key={key}
        method={endpoint.method}
        path={endpoint.path}
        description={endpoint.description}
        rateLimit={endpoint.rate_limit}
        authRequired={endpoint.auth_required}
        requestBody={endpoint.request_body}
        response={endpoint.response}
        validation={endpoint.validation}
        parameters={endpoint.query_params ? [{
          name: 'type',
          type: 'string',
          required: false,
          description: typeof endpoint.query_params === 'string' ? endpoint.query_params : endpoint.query_params.type || 'Query parameter'
        }] : endpoint.parameters}
      />
    );
  };

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
              Version 3.0.0
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
          {['overview', 'endpoints', 'examples', 'errors'].map((section) => (
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
              {docs?.description || 'The C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) API provides programmatic access to the research platform. This RESTful API allows you to integrate image description tasks into your applications and manage submissions.'}
            </p>

            <h3 style={{ marginTop: '32px' }}>Version</h3>
            <div style={{
              background: 'var(--bg)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: '14px',
              display: 'inline-block'
            }}>
              {docs?.version || '3.4.0'}
            </div>

            <h3 style={{ marginTop: '32px' }}>Base URL</h3>
            <div style={{
              background: 'var(--bg)',
              padding: '16px',
              borderRadius: '12px',
              border: '2px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              {docs?.base_url || apiBaseUrl}
            </div>

            {docs?.security && (
              <>
                <h3 style={{ marginTop: '32px' }}>Security</h3>
                <ul style={{ lineHeight: '1.8' }}>
                  <li><strong>Rate Limiting:</strong> {docs.security.rate_limiting}</li>
                  <li><strong>Authentication:</strong> {docs.security.authentication}</li>
                  <li><strong>Data Protection:</strong> {docs.security.data_protection}</li>
                </ul>
              </>
            )}

            <h3 style={{ marginTop: '32px' }}>Features</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li><strong>Image Management:</strong> Fetch random images for normal, survey, and attention tasks</li>
              <li><strong>Data Submission:</strong> Submit participant responses with descriptions, ratings, and feedback</li>
              <li><strong>Health Monitoring:</strong> Check system connectivity and service status</li>
              <li><strong>Security:</strong> Rate limiting and hardened security headers</li>
            </ul>

            <h3 style={{ marginTop: '32px' }}>Quick Start</h3>
            <ol style={{ lineHeight: '1.8' }}>
              <li>Make your first request to <code>/api/images/random</code></li>
              <li>Submit participant data via <code>/api/submit</code></li>
              <li>Retrieve submissions via <code>/api/submissions/&lt;participant_id&gt;</code></li>
            </ol>
          </div>
        )}

        {/* Endpoints Section */}
        {activeSection === 'endpoints' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>API Endpoints</h2>

            {docs?.endpoints ? (
              <>
                <h3 style={{ marginTop: '24px' }}>Available Endpoints</h3>
                {Object.entries(docs.endpoints).map(([key, endpoint]) =>
                  renderEndpointFromDocs(key, endpoint)
                )}
              </>
            ) : (
              <>
                <h3 style={{ marginTop: '24px' }}>Public Endpoints</h3>

                {/* Health Check */}
                <EndpointCard
                  method="GET"
                  path="/api/health"
                  description="Check system health and connectivity status"
                  response={{
                    "status": "healthy",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "services": {
                      "database": "connected",
                      "images": "accessible"
                    }
                  }}
                />

                {/* Participants */}
                <EndpointCard
                  method="POST"
                  path="/api/participants"
                  description="Create a new participant record with user details"
                  requestBody={{
                    "participant_id": "string (required)",
                    "session_id": "string (required)",
                    "username": "string (required)",
                    "email": "string (optional)",
                    "phone": "string (optional)",
                    "gender": "string (required)",
                    "age": "integer (required)",
                    "place": "string (required)",
                    "native_language": "string (required)",
                    "prior_experience": "string (required)"
                  }}
                  response={{
                    "status": "success",
                    "participant_id": "uuid-string",
                    "message": "Participant created successfully"
                  }}
                />

                <EndpointCard
                  method="GET"
                  path="/api/participants/{participant_id}"
                  description="Get participant details"
                  response={{
                    "participant_id": "uuid-string",
                    "username": "john_doe",
                    "email": "john@example.com",
                    "phone": "+1234567890",
                    "gender": "male",
                    "age": 25,
                    "place": "New York",
                    "native_language": "English",
                    "prior_experience": "Photography",
                    "consent_given": true,
                    "created_at": "2024-01-01T00:00:00Z"
                  }}
                />

                {/* Consent */}
                <EndpointCard
                  method="POST"
                  path="/api/consent"
                  description="Record participant consent"
                  requestBody={{
                    "participant_id": "string (required)",
                    "consent_given": "boolean (required)"
                  }}
                  response={{
                    "status": "success",
                    "message": "Consent recorded successfully",
                    "timestamp": "2024-01-01T00:00:00Z"
                  }}
                />

                <EndpointCard
                  method="GET"
                  path="/api/consent/{participant_id}"
                  description="Get consent status for a participant"
                  response={{
                    "participant_id": "uuid-string",
                    "consent_given": true,
                    "consent_timestamp": "2024-01-01T00:00:00Z"
                  }}
                />

                {/* Get Random Image */}
                <EndpointCard
                  method="GET"
                  path="/api/images/random"
                  description="Retrieve a random image for the study"
                  parameters={[
                    { name: 'type', type: 'string', required: false, description: 'Image type: normal, survey, or attention', default: 'normal' }
                  ]}
                  response={{
                    "image_id": "normal/aurora-lake.svg",
                    "image_url": "/api/images/normal/aurora-lake.svg",
                    "is_survey": false,
                    "is_attention": false
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

                {/* Submit Data */}
                <EndpointCard
                  method="POST"
                  path="/api/submit"
                  description="Submit participant response data (requires prior consent)"
                  requestBody={{
                    "participant_id": "string (required)",
                    "session_id": "string (required)",
                    "image_id": "string (required)",
                    "description": "string (required, min 60 words)",
                    "rating": "integer (required, 1-10)",
                    "feedback": "string (required, min 5 chars)",
                    "time_spent_seconds": "number (required)",
                    "is_survey": "boolean",
                    "is_attention": "boolean",
                    "attention_expected": "string (for attention checks)"
                  }}
                  response={{
                    "status": "ok",
                    "word_count": 45,
                    "attention_passed": true
                  }}
                />

                {/* Get Submissions */}
                <EndpointCard
                  method="GET"
                  path="/api/submissions/{participant_id}"
                  description="Get all submissions for a participant"
                  response="[{...submission objects...}]"
                />

                <EndpointCard
                  method="GET"
                  path="/api/security/info"
                  description="Get security configuration details"
                  response={{
                    "security": {
                      "rate_limits": "object",
                      "cors_allowed_origins": "array",
                      "security_headers": "array"
                    }
                  }}
                />

                <EndpointCard
                  method="GET"
                  path="/api/docs"
                  description="Retrieve the API documentation"
                  response="Documentation payload"
                />
              </>
            )}
          </div>
        )}

        {/* Examples Section */}
        {activeSection === 'examples' && (
          <div>
            <h2 style={{ color: 'var(--primary)' }}>Code Examples</h2>

            <h3 style={{ marginTop: '24px' }}>JavaScript / Fetch</h3>
            <CodeBlock code={`// Check system health
const healthResponse = await fetch('/api/health');
const health = await healthResponse.json();
console.log(health.status); // 'healthy' or 'degraded'

// Get a random image
const response = await fetch('/api/images/random?type=normal');
const image = await response.json();
console.log(image.image_url);

// Submit participant data
const submission = {
  participant_id: 'user-123',
  session_id: 'session-456',
  image_id: 'normal/aurora-lake.svg',
  description: 'The image shows a beautiful sunset over mountains...',
  rating: 8,
  feedback: 'Interesting image',
  time_spent_seconds: 45,
  is_survey: false,
  is_attention: false
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

# Check system health
health_response = requests.get('http://localhost:5000/api/health')
health = health_response.json()
print(health['status'])  # 'healthy' or 'degraded'

# Get a random image
response = requests.get('http://localhost:5000/api/images/random?type=normal')
image = response.json()
print(image['image_url'])

# Submit participant data
submission = {
    'participant_id': 'user-123',
    'session_id': 'session-456',
    'image_id': 'normal/aurora-lake.svg',
    'description': 'The image shows a beautiful sunset...',
    'rating': 8,
    'feedback': 'Interesting image',
    'time_spent_seconds': 45,
    'is_survey': False,
    'is_attention': False
}

response = requests.post(
    'http://localhost:5000/api/submit',
    json=submission
)
result = response.json()
print(result['status'])  # 'ok'`} />

            <h3 style={{ marginTop: '32px' }}>cURL</h3>
            <CodeBlock code={`# Check system health
curl -X GET "http://localhost:5000/api/health"

# Get a random image
curl -X GET "http://localhost:5000/api/images/random?type=normal"

# Submit participant data
curl -X POST "http://localhost:5000/api/submit" \\
  -H "Content-Type: application/json" \\
  -d '{
    "participant_id": "user-123",
    "session_id": "session-456",
    "image_id": "normal/aurora-lake.svg",
    "description": "The image shows...",
    "rating": 8,
    "feedback": "Great image",
    "time_spent_seconds": 45,
    "is_survey": false,
    "is_attention": false
  }'`} />
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
                {docs?.error_handling?.common_errors ? (
                  Object.entries(docs.error_handling.common_errors).map(([code, description]) => (
                    <tr key={code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}><code>{code}</code></td>
                      <td style={{ padding: '12px' }}>
                        {code === '200' && 'OK'}
                        {code === '400' && 'Bad Request'}
                        {code === '401' && 'Unauthorized'}
                        {code === '403' && 'Forbidden'}
                        {code === '404' && 'Not Found'}
                        {code === '409' && 'Conflict'}
                        {code === '415' && 'Unsupported Media Type'}
                        {code === '429' && 'Too Many Requests'}
                        {code === '500' && 'Internal Server Error'}
                      </td>
                      <td style={{ padding: '12px' }}>{description}</td>
                    </tr>
                  ))
                ) : (
                  <>
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
                      <td style={{ padding: '12px' }}>Authentication required</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}><code>404</code></td>
                      <td style={{ padding: '12px' }}>Not Found</td>
                      <td style={{ padding: '12px' }}>Resource not found</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}><code>415</code></td>
                      <td style={{ padding: '12px' }}>Unsupported Media Type</td>
                      <td style={{ padding: '12px' }}>Request must use application/json</td>
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
                  </>
                )}
              </tbody>
            </table>

            <h3 style={{ marginTop: '32px' }}>Error Response Format</h3>
            <CodeBlock code={docs?.error_handling?.error_format ? JSON.stringify(docs.error_handling.error_format, null, 2) : `{
  "error": "Description of what went wrong"
}`} />

            <h3 style={{ marginTop: '32px' }}>Common Errors</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li><code>Minimum 60 words required</code> - Description is too short</li>
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
        </div>
      </div>
    </div>
  );
}

// Helper Components
function EndpointCard({ method, path, description, parameters, requestBody, response, rateLimit, authRequired, validation }) {
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
        <span style={{ marginLeft: 'auto', fontSize: '20px' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '20px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>{description}</p>

          {rateLimit && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                <strong>Rate Limit:</strong> {rateLimit}
              </span>
            </div>
          )}

          {authRequired !== undefined && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: authRequired ? '#f59e0b' : '#42b72a' }}>
                <strong>Auth Required:</strong> {authRequired ? 'Yes' : 'No'}
              </span>
            </div>
          )}

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

          {validation && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Validation Rules</h4>
              <CodeBlock code={JSON.stringify(validation, null, 2)} small />
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
