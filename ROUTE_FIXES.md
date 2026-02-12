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
- `GET /api/health` - System health check
- `GET /api/docs` - API documentation (JSON)
- `GET /api/security/info` - Security configuration info
- `GET /` - API docs HTML (backend root endpoint)

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
