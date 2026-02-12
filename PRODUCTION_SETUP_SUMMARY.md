# C.O.G.N.I.T. Production Setup Summary

This document summarizes all the changes made to connect the frontend and backend in production environments.

## Changes Made

### 1. Root `vercel.json` (Combined Deployment)
**File**: `/vercel.json`

Updated to support combined deployment where both frontend and backend are served from the same Vercel project:

- Added explicit asset route for `/assets/(.*)` → `frontend/dist/assets/$1`
- Added favicon route for `/favicon.ico`
- Added `filesystem` handle before SPA fallback
- Updated catch-all route to serve `frontend/dist/index.html` for React Router

**Key Benefit**: Single project deployment with no CORS issues.

### 2. Backend CORS Configuration
**File**: `/backend/app.py`

Updated `_get_cors_origins()` function:

- Removed hardcoded production URL (`https://cognit-weld.vercel.app`)
- Updated comments to clarify deployment scenarios
- Defaults now only include localhost URLs for development
- For production, users should set `CORS_ORIGINS` environment variable

**Key Benefit**: More flexible CORS configuration for different deployment scenarios.

### 3. Backend Health Check Enhancement
**File**: `/backend/app.py`

Enhanced `/api/health` endpoint:

- Added version information (`3.5.0`)
- Added environment detection (production vs development)
- Added image count in the images directory
- Added CORS origins count for debugging

**Key Benefit**: Better debugging and monitoring capabilities.

### 4. Frontend Environment Configuration
**File**: `/frontend/.env.production`

Updated with comprehensive comments explaining:

- OPTION 1: Same-origin deployment (combined Vercel project)
- OPTION 2: Separate deployments (different domains)
- Clear instructions for each scenario

**Key Benefit**: Users understand how to configure based on their deployment choice.

### 5. Frontend Environment Example
**File**: `/frontend/.env.example`

Updated with:

- Clear explanation of both deployment options
- Local development proxy information
- Better structure and documentation

### 6. Backend Environment Example
**File**: `/backend/.env.example`

Updated with:

- Clearer descriptions of each variable
- Three CORS configuration options documented
- Security warnings and generation commands

### 7. Vercel Deployment Documentation
**File**: `/VERCEL_DEPLOYMENT.md`

Major updates:

- Added "Combined Deployment" quick start option
- Added detailed "Alternative Deployment: Combined Vercel Project" section
- Updated environment variables table with deployment-specific guidance
- Added "Combined Deployment Issues" troubleshooting section
- Added architecture diagrams for both deployment approaches

**Key Benefit**: Users can choose the simpler combined deployment approach.

## Deployment Options

### Option 1: Combined Deployment (Recommended)

Deploy both frontend and backend as a single Vercel project.

**Pros:**
- No CORS configuration needed
- Single URL for entire application
- Simpler environment variable management
- One project to monitor and maintain

**Configuration:**
- `VITE_API_BASE=` (empty in frontend/.env.production)
- `CORS_ORIGINS=` (empty or not set in backend)

### Option 2: Separate Deployments

Deploy frontend and backend as separate Vercel projects.

**Pros:**
- Independent scaling
- Separate concerns
- Can use different domains

**Configuration:**
- `VITE_API_BASE=https://your-backend.vercel.app` (in frontend)
- `CORS_ORIGINS=https://your-frontend.vercel.app` (in backend)

## Verification Checklist

### Pre-Deployment

- [ ] Database URL obtained from Neon/PostgreSQL provider
- [ ] `SECRET_KEY` generated (`openssl rand -hex 32`)
- [ ] `IP_HASH_SALT` generated (`openssl rand -hex 16`)
- [ ] Database initialized with `python backend/init_db.py <database-url>`

### Combined Deployment Verification

- [ ] Deploy from project root (not `backend/` or `frontend/`)
- [ ] Root `vercel.json` exists and is configured
- [ ] Environment variables set in Vercel dashboard:
  - [ ] `DATABASE_URL`
  - [ ] `SECRET_KEY`
  - [ ] `FLASK_DEBUG=0`
- [ ] Frontend `.env.production` has `VITE_API_BASE=` (empty)
- [ ] Deployed successfully without build errors

**Post-Deployment Tests:**
- [ ] Main URL loads React app: `https://your-app.vercel.app`
- [ ] API health check works: `https://your-app.vercel.app/api/health`
- [ ] API documentation loads: `https://your-app.vercel.app/`
- [ ] Can complete full participant flow (consent → details → payment → trials)
- [ ] No CORS errors in browser console
- [ ] Images load correctly
- [ ] Submissions save to database

### Separate Deployment Verification

**Backend:**
- [ ] Deploy from `backend/` directory
- [ ] Environment variables set:
  - [ ] `DATABASE_URL`
  - [ ] `SECRET_KEY`
  - [ ] `CORS_ORIGINS=https://your-frontend.vercel.app`
  - [ ] `FLASK_DEBUG=0`

**Frontend:**
- [ ] Deploy from `frontend/` directory  
- [ ] `.env.production` has `VITE_API_BASE=https://your-backend.vercel.app`

**Post-Deployment Tests:**
- [ ] Frontend loads: `https://your-frontend.vercel.app`
- [ ] Backend API docs: `https://your-backend.vercel.app/`
- [ ] API health check: `https://your-backend.vercel.app/api/health`
- [ ] No CORS errors in browser console
- [ ] Full participant flow works end-to-end

## Health Check Endpoint

After deployment, verify connectivity using the health check endpoint:

```bash
# Combined deployment
curl https://your-app.vercel.app/api/health

# Separate deployment
curl https://your-backend.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "3.5.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "images": "accessible",
    "image_count": 150,
    "cors_origins_count": 3
  }
}
```

## Troubleshooting Quick Reference

### Combined Deployment Issues

| Issue | Solution |
|-------|----------|
| 404 on API routes | Check route order in `vercel.json` - `/api/*` must be before `/(.*)` |
| Frontend 404 on refresh | Ensure SPA fallback route in `vercel.json` |
| Database errors | Verify `DATABASE_URL` environment variable |
| CORS errors (unexpected) | Shouldn't happen with combined deployment - check deployment directory |

### Separate Deployment Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Add frontend URL to backend `CORS_ORIGINS` env var |
| API not reachable | Check `VITE_API_BASE` in frontend environment |
| Database errors | Verify `DATABASE_URL` is set correctly |

## File Locations Summary

```
/home/engine/project/
├── vercel.json                    # Combined deployment config (ROOT LEVEL)
├── backend/
│   ├── app.py                     # Flask backend with CORS config
│   ├── vercel.json                # Separate backend deployment config
│   ├── wsgi.py                    # WSGI entry point
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # Backend env template
├── frontend/
│   ├── vite.config.js             # Vite build config
│   ├── vercel.json                # Separate frontend deployment config
│   ├── .env.production            # Production env config
│   ├── .env.example               # Frontend env template
│   └── src/
│       └── utils/
│           └── apiBase.js         # API URL handling
└── VERCEL_DEPLOYMENT.md           # Full deployment guide
```

## Next Steps

1. Choose your deployment approach (combined recommended)
2. Set up Neon PostgreSQL database
3. Configure environment variables
4. Deploy to Vercel
5. Run verification checklist
6. Test full participant flow

For detailed step-by-step instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).
