# Production URL Status Report

**Date:** February 12, 2026
**Report Type:** Production Connectivity Verification

---

## Executive Summary

After comprehensive analysis of the production deployment at `https://cognit-weld.vercel.app`, I have identified a **critical issue** preventing the application from functioning correctly.

### Status: ❌ NOT WORKING - Backend Inaccessible

---

## Production URLs Tested

| URL | Status | Response Type | Notes |
|-----|--------|---------------|-------|
| `https://cognit-weld.vercel.app` | ✅ WORKING | Frontend HTML | React SPA loads correctly |
| `https://cognit-weld.vercel.app/api/health` | ❌ FAILING | Frontend HTML | Should return JSON, returns HTML instead |
| `https://cognit-weld.vercel.app/api/docs` | ❌ FAILING | Frontend HTML | Should return API docs, returns HTML instead |
| All `/api/*` endpoints | ❌ FAILING | Frontend HTML | Backend not accessible |

---

## Detailed Findings

### 1. Frontend Status: ✅ WORKING

**URL:** `https://cognit-weld.vercel.app`

- ✅ Frontend loads successfully (HTTP 200)
- ✅ Returns valid HTML with React app
- ✅ Proper SSL/TLS certificate
- ✅ Vercel caching working (x-vercel-cache: HIT)
- ✅ Security headers present (HSTS, CSP, etc.)

**Sample Response Headers:**
```
HTTP/2 200
content-type: text/html; charset=utf-8
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-vercel-cache: HIT
```

---

### 2. Backend Status: ❌ NOT ACCESSIBLE

**Expected Behavior:** API endpoints at `/api/*` should return JSON responses from the Flask backend.

**Actual Behavior:** All `/api/*` requests return the frontend HTML instead of API responses.

**Test Results:**

#### Test 1: Health Check Endpoint
```bash
curl https://cognit-weld.vercel.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "images": "accessible"
  }
}
```

**Actual Response:** Returns `index.html` (1017 bytes of HTML)

#### Test 2: API Documentation Endpoint
```bash
curl https://cognit-weld.vercel.app/api/docs
```

**Expected Response:** API documentation JSON

**Actual Response:** Returns `index.html` (1017 bytes of HTML)

---

### 3. Frontend-Backend Communication: ❌ BROKEN

**Configuration Analysis:**

**Frontend (`frontend/.env.production`):**
```env
VITE_API_BASE=
```

**Backend CORS Configuration (`backend/app.py` lines 53-64):**
```python
def _get_cors_origins():
    env_origins = os.getenv("CORS_ORIGINS", "").strip()
    if env_origins:
        origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
        if "*" in origins:
            return "*"
        return origins
    # Default origins include localhost for development and production frontend
    return [
        "http://localhost:5173",
        "https://cognit-weld.vercel.app"
    ]
```

**Issue:** The frontend is configured to use relative URLs (empty `VITE_API_BASE`), expecting the backend to be on the same domain. However, the Vercel routing is not sending `/api/*` requests to the backend.

---

## Root Cause Analysis

### Vercel Deployment Configuration

**File:** `/home/engine/project/vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/app.py",
      "use": "@vercel/python",
      "config": {
        "maxLambdaSize": "50mb"
      }
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/app.py"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ],
  "outputDirectory": "frontend/dist",
  "framework": null
}
```

### Problem

The `vercel.json` configuration uses the **legacy Vercel platform configuration** with:
- Multiple builds (Python backend + Static frontend)
- Custom routing rules

**This configuration is NOT working correctly because:**

1. Only the frontend build is being deployed
2. The backend Python Flask app is not accessible
3. The routing rules are not being applied
4. All requests (including `/api/*`) are being served by the frontend

---

## Deployment Architecture Inconsistencies

### Found Multiple Deployment Approaches in Codebase:

1. **Root `vercel.json`** (Current - Not Working)
   - Single Vercel project with both frontend and backend
   - Uses legacy builds + routes configuration
   - Intended for same-domain deployment

2. **`frontend/vercel.json`** (Alternative)
   - Frontend-only deployment
   - SPA routing with catch-all to index.html
   - Expects backend on separate domain

3. **`backend/vercel.json`** (Alternative)
   - Backend-only deployment
   - Python Flask app deployment
   - Separate from frontend

4. **Documentation (`VERCEL_DEPLOYMENT.md`)**
   - Recommends **separate deployments** for frontend and backend
   - Frontend: `cognit-frontend.vercel.app`
   - Backend: `cognit-backend.vercel.app`
   - Frontend `.env.production` should have backend URL

---

## Impact

### User Impact
- ❌ Frontend loads but cannot communicate with backend
- ❌ Health check fails (frontend shows "Unable to connect to the server")
- ❌ Cannot create participants
- ❌ Cannot submit consent
- ❌ Cannot fetch images
- ❌ Cannot submit descriptions
- ❌ Cannot complete the study
- ❌ **Application is completely non-functional**

### System Impact
- ❌ API endpoints inaccessible
- ❌ Database operations not possible
- ❌ All study functionality broken
- ❌ Research data cannot be collected

---

## Recommended Solutions

### Solution 1: Fix Single-Domain Deployment (Quick Fix)

**Approach:** Update Vercel configuration to properly route `/api/*` to the backend.

**Issues:**
- Legacy Vercel configuration format is deprecated
- May require updating to modern Vercel configuration
- Complex debugging required
- May not work reliably on Vercel's current platform

**Effort:** High
**Reliability:** Uncertain

---

### Solution 2: Switch to Separate Deployments (Recommended) ✅

**Approach:** Deploy frontend and backend as separate Vercel projects.

**Steps Required:**

1. **Deploy Backend as Separate Project**
   - Create new Vercel project from `backend/` directory
   - Use `backend/vercel.json` configuration
   - Set environment variables:
     - `DATABASE_URL` (Neon PostgreSQL connection)
     - `SECRET_KEY`
     - `CORS_ORIGINS=https://cognit-weld.vercel.app`
     - Other required env vars
   - Note the backend URL (e.g., `https://cognit-backend.vercel.app`)

2. **Update Frontend Configuration**
   - Edit `frontend/.env.production`:
     ```env
     VITE_API_BASE=https://cognit-backend.vercel.app
     ```
   - Commit and push changes
   - Redeploy frontend (or let Vercel auto-deploy on push)

3. **Verify Configuration**
   - Test backend health endpoint: `https://cognit-backend.vercel.app/api/health`
   - Test frontend API calls in browser console
   - Verify CORS headers
   - Complete full study flow test

**Effort:** Medium
**Reliability:** High (matches documentation, proven approach)

---

### Solution 3: Use Modern Vercel Configuration (Alternative)

**Approach:** Update to modern Vercel project configuration using `vercel.json` with rewrites.

**Example Configuration:**
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ],
  "functions": {
    "backend/api/**/*.py": {
      "runtime": "python3.9"
    }
  }
}
```

**Note:** This would require restructuring the project to match Vercel's expected patterns.

**Effort:** High
**Reliability:** Medium

---

## Immediate Action Required

To restore functionality to `https://cognit-weld.vercel.app`, the following must be done:

### Option A: Quick Fix (Test Backend Deployment First)
1. Deploy backend as separate Vercel project
2. Update frontend `.env.production` with backend URL
3. Redeploy frontend

### Option B: Investigate Current Deployment
1. Check Vercel dashboard for `cognit-weld` project
2. Verify build configuration
3. Check deployment logs
4. Determine why backend is not deployed
5. Fix routing configuration

---

## Files That Need Updates

### For Separate Deployments (Recommended):

1. **`frontend/.env.production`**
   ```env
   # Change from:
   VITE_API_BASE=

   # To:
   VITE_API_BASE=https://your-backend-url.vercel.app
   ```

2. **Backend Environment Variables (in Vercel Dashboard)**
   - Set `CORS_ORIGINS=https://cognit-weld.vercel.app`
   - Ensure all other required env vars are set

---

## Testing Checklist

After implementing a fix, verify:

- [ ] Backend health endpoint returns JSON: `GET /api/health`
- [ ] Frontend loads without errors
- [ ] Browser console shows no CORS errors
- [ ] API calls succeed in network tab
- [ ] Can create participant
- [ ] Can submit consent
- [ ] Can fetch random images
- [ ] Can submit trial descriptions
- [ ] Can complete full study flow
- [ ] Database operations work correctly

---

## Conclusion

The production deployment at `https://cognit-weld.vercel.app` is **currently non-functional** due to backend inaccessibility. The Vercel routing configuration is not working as expected, causing all API requests to be handled by the frontend instead of the backend.

**Recommended Action:** Implement Solution 2 (Separate Deployments) as documented in `VERCEL_DEPLOYMENT.md`, which is the proven and recommended approach for deploying this application.

---

**Next Steps:**
1. Choose deployment approach (Solution 2 recommended)
2. Deploy backend as separate Vercel project
3. Update frontend configuration
4. Test all functionality
5. Update this report with verification results

---

**Report Generated:** February 12, 2026
**Status:** ⚠️ CRITICAL - Backend Inaccessible
**Priority:** HIGH - Immediate Action Required
