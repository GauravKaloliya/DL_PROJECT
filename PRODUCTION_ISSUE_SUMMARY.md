# Production Issue Summary - Quick Reference

## Problem
❌ **Backend is INACCESSIBLE** at production URL

## Current Status
- **Frontend:** ✅ Working at `https://cognit-weld.vercel.app`
- **Backend:** ❌ Not accessible (all `/api/*` routes return HTML instead of JSON)
- **Application:** ❌ Completely non-functional

## Test Results
```bash
# Should return JSON, but returns HTML:
curl https://cognit-weld.vercel.app/api/health
curl https://cognit-weld.vercel.app/api/docs
curl https://cognit-weld.vercel.app/api/images/random
# ... all /api/* endpoints fail
```

## Root Cause
The Vercel deployment configuration (`vercel.json`) attempts to deploy both frontend and backend in a single project, but:
1. Only frontend is deployed
2. Backend Flask app is not accessible
3. Routing rules not working
4. All requests served by frontend

## Configuration Mismatch

**Current Setup:**
- Root `vercel.json` → Single domain deployment (NOT working)
- Frontend `.env.production` → `VITE_API_BASE=` (empty, expects same-origin)
- Backend CORS → Allows `https://cognit-weld.vercel.app`

**Documentation Recommends:**
- Separate deployments for frontend and backend
- Frontend: `https://cognit-weld.vercel.app` ✅ (exists)
- Backend: `https://cognit-backend.vercel.app` ❌ (needs deployment)
- Frontend should point to backend URL

## Solution Options

### ✅ RECOMMENDED: Separate Deployments

**Steps:**
1. Deploy backend as new Vercel project
   - Import repository
   - Root directory: `backend`
   - Set environment variables (DATABASE_URL, SECRET_KEY, CORS_ORIGINS, etc.)
   - Get backend URL (e.g., `https://cognit-backend.vercel.app`)

2. Update frontend `.env.production`
   ```env
   VITE_API_BASE=https://cognit-backend.vercel.app
   ```

3. Commit and push changes
4. Vercel will auto-redeploy frontend
5. Test: `curl https://cognit-backend.vercel.app/api/health`

### Alternative: Fix Single-Domain Deployment

**Challenges:**
- Legacy Vercel configuration format
- Complex debugging
- May not work reliably
- Not recommended in documentation

## Files to Update

**`frontend/.env.production`:**
```env
# BEFORE (current, not working):
VITE_API_BASE=

# AFTER (fix):
VITE_API_BASE=https://your-backend-url.vercel.app
```

**Backend Environment Variables (in Vercel Dashboard):**
```
CORS_ORIGINS=https://cognit-weld.vercel.app
DATABASE_URL=your-neon-connection-string
SECRET_KEY=your-secret-key
... other required vars
```

## Verification Checklist

After deploying backend and updating frontend:

- [ ] Backend health works: `https://backend-url.vercel.app/api/health` → JSON response
- [ ] Frontend loads: `https://cognit-weld.vercel.app` → No console errors
- [ ] No CORS errors in browser
- [ ] Can create participant
- [ ] Can submit consent
- [ ] Can fetch images
- [ ] Can submit trials
- [ ] Full study flow works

## Documentation References

- **Detailed Report:** `PRODUCTION_URL_STATUS_REPORT.md` (comprehensive analysis)
- **Deployment Guide:** `VERCEL_DEPLOYMENT.md` (recommended approach)
- **Checklist:** `VERCEL_CHECKLIST.md` (step-by-step verification)

## Priority
🔴 **HIGH** - Application is completely non-functional in production

## Next Action
Deploy backend as separate Vercel project and update frontend configuration.
