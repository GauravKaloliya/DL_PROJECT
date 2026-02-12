# Frontend Routes Fix Summary

## Issues Identified and Fixed

### Problem
The frontend routing was incorrectly configured with:
- API Documentation page on root path `/`
- Main survey application on `/app`
- Navigation buttons pointing to wrong routes

This caused confusion as users would land on the API docs instead of the survey app.

### Changes Made

#### 1. MainApp.jsx - Route Configuration
**File**: `/frontend/src/MainApp.jsx`

**Before**:
```jsx
<Route path="/" element={<ApiDocs />} />
<Route path="/app" element={<App />} />
```

**After**:
```jsx
<Route path="/" element={<App />} />
<Route path="/docs" element={<ApiDocs />} />
```

**Rationale**: The main application (survey) should be at the root path for better UX.

#### 2. App.jsx - Navigation Button
**File**: `/frontend/src/App.jsx`

**Before**:
```jsx
<button className="ghost" onClick={() => navigate("/")}>
  API Docs
</button>
```

**After**:
```jsx
<button className="ghost" onClick={() => navigate("/docs")}>
  API Docs
</button>
```

**Rationale**: Updated navigation to point to the new API docs route.

#### 3. ApiDocs.jsx - Back Button
**File**: `/frontend/src/components/ApiDocs.jsx`

**Before**:
```jsx
<button className="ghost" onClick={() => navigate('/app')}>
  ← Back to Survey
</button>
```

**After**:
```jsx
<button className="ghost" onClick={() => navigate('/')}>
  ← Back to Survey
</button>
```

**Rationale**: Updated back button to return to the new root survey route.

## Route Structure

### Frontend Routes (Client-Side)
- `/` - Main survey application (consent, user details, payment, trials)
- `/docs` - API documentation viewer
- `*` - 404 Not Found page

### Backend Routes (API Endpoints)
All backend API routes remain unchanged and fully functional:

#### Core System
- `GET /` - API documentation HTML UI (backend root endpoint) - **Updated to serve HTML**
- `GET /api/docs` - API documentation (JSON)
- `GET /api/docs/ui` - API documentation HTML UI (alternative endpoint) - **New**
- `GET /api/health` - System health check
- `GET /api/security/info` - Security configuration info

#### Participant Management
- `POST /api/participants` - Create participant
- `GET /api/participants/{participant_id}` - Get participant details

#### Consent Management
- `POST /api/consent` - Record consent
- `GET /api/consent/{participant_id}` - Get consent status

#### Image Management
- `GET /api/images/random?type={normal|survey|attention}` - Get random image
- `GET /api/images/{image_id}` - Serve specific image file

#### Submission Management
- `POST /api/submit` - Submit image description
- `GET /api/submissions/{participant_id}` - Get all participant submissions

#### Reward System
- `GET /api/reward/{participant_id}` - Get reward eligibility status
- `POST /api/reward/select/{participant_id}` - Select reward winner

## Testing Results

All API routes tested and verified working:
- ✓ Health check endpoint
- ✓ API docs endpoint
- ✓ Random image endpoints (normal, survey, attention)
- ✓ Complete participant flow (create, get, consent, submit, retrieve)
- ✓ Security info endpoint
- ✓ Reward system endpoints

## Deployment Notes

### Vercel Configuration
The `vercel.json` is already correctly configured for SPA routing:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This ensures all frontend routes work correctly in production.

### Vite Proxy Configuration
Development proxy already configured in `vite.config.js`:
```javascript
proxy: {
  "/api": "http://localhost:5000",
  "/admin": "http://localhost:5000"
}
```

## User Flow

1. User visits `/` → Lands on consent page
2. User consents → Proceeds to user details
3. User fills details → Proceeds to payment page
4. User completes payment → Starts survey trials
5. User clicks "API Docs" button → Navigates to `/docs`
6. User clicks "← Back to Survey" → Returns to `/`

## API Integration

The frontend correctly integrates with the backend API through:
- `API_BASE` configuration from environment variables
- Vite proxy in development
- Direct API calls in production

All fetch calls use the pattern:
```javascript
fetch(`${API_BASE}/api/endpoint`, options)
```

Where `API_BASE` is automatically configured based on the environment.

## API Documentation UI Fix (Latest Update)

### Problem
The backend API documentation routes were only serving JSON responses. When users visited the backend's root endpoint (`/`) or `/api/docs`, they received raw JSON data instead of a user-friendly HTML interface for viewing the API documentation.

### Solution
Updated the backend to serve HTML UI for API documentation while maintaining JSON endpoints for API consumers:

#### 1. Updated Root Endpoint to Serve HTML
**File**: `/backend/app.py`

**Before**:
```python
@app.route("/")
@limiter.limit("30 per minute")
def api_docs_html():
    """API documentation at root endpoint"""
    return jsonify(_get_api_documentation())
```

**After**:
```python
@app.route("/")
@limiter.limit("30 per minute")
def api_docs_ui():
    """API documentation UI at root endpoint"""
    docs = _get_api_documentation()
    return render_template(
        "api_docs.html",
        version=docs.get("version", "3.4.0"),
        base_url=docs.get("base_url", "/api")
    )
```

#### 2. Added Alternative HTML UI Endpoint
**File**: `/backend/app.py`

**New Route Added**:
```python
@app.route("/api/docs/ui")
@limiter.limit("30 per minute")
def api_docs_ui_alt():
    """API documentation UI at /api/docs/ui endpoint"""
    docs = _get_api_documentation()
    return render_template(
        "api_docs.html",
        version=docs.get("version", "3.4.0"),
        base_url=docs.get("base_url", "/api")
    )
```

#### 3. Updated HTML Template
**File**: `/backend/templates/api_docs.html`

**Enhancements**:
- Added detailed reward endpoint documentation with example responses
- Removed duplicate endpoint listings
- Updated footer with links to both HTML UI and JSON versions

#### 4. Updated Startup Messages
**File**: `/backend/app.py`

**Updated Console Output**:
```python
print("API Documentation (HTML UI) available at: http://localhost:5000/")
print("API Documentation (HTML UI) also at: http://localhost:5000/api/docs/ui")
print("API Documentation (JSON) available at: http://localhost:5000/api/docs")
```

### New Route Structure

#### Backend Documentation Routes
- `GET /` - **HTML UI** for API documentation (main entry point)
- `GET /api/docs/ui` - **HTML UI** for API documentation (alternative)
- `GET /api/docs` - **JSON** API documentation (for programmatic access)

All three routes serve the same documentation data, but `/` and `/api/docs/ui` render it as a beautiful HTML interface, while `/api/docs` returns raw JSON for API consumers.

### Benefits
1. **User-Friendly**: Humans visiting the backend now see a nice HTML interface instead of raw JSON
2. **Backward Compatible**: API consumers can still fetch JSON from `/api/docs`
3. **Multiple Access Points**: Users can access docs via `/` or `/api/docs/ui`
4. **Complete Documentation**: HTML template now includes reward system endpoints
5. **Clear Separation**: HTML UI and JSON API have distinct endpoints

### Testing
To verify the fix works:

1. Visit `http://localhost:5000/` - Should show HTML documentation UI
2. Visit `http://localhost:5000/api/docs/ui` - Should show same HTML documentation UI
3. Visit `http://localhost:5000/api/docs` - Should return JSON documentation

All three endpoints should work correctly and provide complete API documentation.
