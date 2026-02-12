# Production Fix Guide - Step-by-Step Instructions

## Issue Summary
❌ **Backend is INACCESSIBLE** - All API endpoints return HTML instead of JSON

**Current Status:**
- Frontend: ✅ Working at `https://cognit-weld.vercel.app`
- Backend: ❌ Not accessible
- Application: ❌ Non-functional

---

## Solution: Deploy Backend as Separate Vercel Project

This is the **RECOMMENDED** approach based on the project documentation.

---

## Step-by-Step Instructions

### Phase 1: Deploy Backend

#### Step 1.1: Create Backend Project in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your repository (same as frontend)
4. Configure project settings:
   - **Project Name**: `cognit-backend` (or your preference)
   - **Framework Preset**: Other
   - **Root Directory**: `backend` ⚠️ **IMPORTANT**
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave default)
   - **Install Command**: `pip install -r requirements.txt`
5. Click **"Deploy"**

#### Step 1.2: Configure Backend Environment Variables

After deployment, go to your backend project in Vercel:

1. Click **Settings** → **Environment Variables**
2. Add the following variables:

| Variable Name | Value | Environments |
|---------------|-------|--------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview, Development |
| `SECRET_KEY` | Generate: `openssl rand -hex 32` | Production, Preview, Development |
| `CORS_ORIGINS` | `https://cognit-weld.vercel.app` | Production, Preview, Development |
| `MIN_WORD_COUNT` | `60` | Production, Preview, Development |
| `TOO_FAST_SECONDS` | `5` | Production, Preview, Development |
| `IP_HASH_SALT` | Generate: `openssl rand -hex 16` | Production, Preview, Development |
| `FLASK_DEBUG` | `0` | Production, Preview, Development |

3. Click **Save**
4. Go to **Deployments** tab
5. Click the three dots (⋯) on the latest deployment
6. Click **Redeploy**

#### Step 1.3: Verify Backend Deployment

1. Note your backend URL (e.g., `https://cognit-backend.vercel.app`)
2. Test the health endpoint:
   ```bash
   curl https://cognit-backend.vercel.app/api/health
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

3. If you get JSON response, backend is working! ✅
4. If you get HTML, there's still an issue - check Vercel logs

---

### Phase 2: Update Frontend Configuration

#### Step 2.1: Update .env.production

1. Open `frontend/.env.production` in your editor
2. Change from:
   ```env
   VITE_API_BASE=
   ```
3. To:
   ```env
   VITE_API_BASE=https://cognit-backend.vercel.app
   ```
   (Replace `cognit-backend.vercel.app` with your actual backend URL)

#### Step 2.2: Commit and Push Changes

```bash
git add frontend/.env.production
git commit -m "Fix: Update API base URL for production backend"
git push
```

#### Step 2.3: Verify Frontend Redeployment

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Find your frontend project (`cognit-weld` or similar)
3. Vercel should auto-deploy on push
4. Wait for deployment to complete

---

### Phase 3: Verify Full Integration

#### Step 3.1: Test Backend API Endpoints

Run these commands to verify backend is working:

```bash
# Health check
curl https://cognit-backend.vercel.app/api/health

# API docs
curl https://cognit-backend.vercel.app/api/docs

# Security info
curl https://cognit-backend.vercel.app/api/security/info
```

All should return JSON responses.

#### Step 3.2: Test Frontend in Browser

1. Open `https://cognit-weld.vercel.app` in browser
2. Open browser console (F12 → Console tab)
3. Look for:
   - ✅ No CORS errors
   - ✅ No "Unable to connect to server" errors
   - ✅ Health check passes in network tab

#### Step 3.3: Test Full User Flow

1. Navigate to `/survey` or click to start
2. Consent page should load
3. Fill in user details
4. Submit consent
5. Try to create participant
6. Fetch images
7. Submit a trial

**All should work without errors!**

---

### Phase 4: Final Verification

#### Step 4.1: Run Test Script

```bash
cd /home/engine/project
./scripts/test-production-urls.sh
```

**Expected Output:**
```
Total Tests: 5
Passed: 5
Failed: 0
✓ ALL TESTS PASSED
```

#### Step 4.2: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Look for API calls:
   - `/api/health` → Should return JSON, status 200
   - `/api/participants` → Should return JSON on POST
   - `/api/images/random` → Should return JSON with image data

#### Step 4.3: Verify Database

1. Go to your Neon dashboard
2. Check if tables exist
3. If not, run database initialization:
   ```bash
   cd backend
   python init_db.py "your-database-url"
   ```

---

## Troubleshooting

### Issue: Backend returns HTML instead of JSON

**Cause:** Backend not properly deployed or routing issues

**Solution:**
1. Check Vercel dashboard → Backend project → Deployments
2. View deployment logs for errors
3. Verify root directory is set to `backend`
4. Redeploy backend

### Issue: CORS errors in browser

**Cause:** CORS_ORIGINS not set correctly

**Solution:**
1. Go to Vercel dashboard → Backend → Settings → Environment Variables
2. Check `CORS_ORIGINS` value
3. Should be: `https://cognit-weld.vercel.app` (no trailing slash)
4. Redeploy backend after changing

### Issue: Database connection errors

**Cause:** DATABASE_URL not set or incorrect

**Solution:**
1. Verify DATABASE_URL in Vercel environment variables
2. Test connection string with:
   ```bash
   psql "your-database-url"
   ```
3. Ensure SSL mode is enabled: `?sslmode=require`
4. Redeploy backend after fixing

### Issue: Frontend still can't connect

**Cause:** .env.production not updated or build cache

**Solution:**
1. Verify `frontend/.env.production` has correct backend URL
2. Check frontend build completed successfully
3. Clear browser cache
4. Try incognito/private browsing mode

---

## Environment Variables Reference

### Backend Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Security
SECRET_KEY=generated-with-openssl-rand-hex-32

# CORS
CORS_ORIGINS=https://cognit-weld.vercel.app

# Application Settings
MIN_WORD_COUNT=60
TOO_FAST_SECONDS=5
IP_HASH_SALT=generated-with-openssl-rand-hex-16
FLASK_DEBUG=0
```

### Frontend Required Variables

```bash
# API Backend URL
VITE_API_BASE=https://cognit-backend.vercel.app
```

---

## Success Criteria

Your production deployment is working when:

- ✅ Backend health check returns JSON: `https://backend-url/api/health`
- ✅ Frontend loads without console errors
- ✅ No CORS errors in browser
- ✅ Can create participant from frontend
- ✅ Can submit consent
- ✅ Can fetch and display images
- ✅ Can submit trial descriptions
- ✅ Can complete full study flow
- ✅ Data is saved to database
- ✅ Test script passes all checks

---

## Additional Resources

- **Detailed Report:** `PRODUCTION_URL_STATUS_REPORT.md`
- **Quick Summary:** `PRODUCTION_ISSUE_SUMMARY.md`
- **Deployment Guide:** `VERCEL_DEPLOYMENT.md`
- **Checklist:** `VERCEL_CHECKLIST.md`
- **Test Script:** `scripts/test-production-urls.sh`

---

## Need Help?

If you encounter issues not covered here:

1. Check Vercel deployment logs for errors
2. Review browser console for frontend errors
3. Check Neon database logs for database errors
4. Refer to troubleshooting sections in documentation files
5. Create a GitHub issue with detailed error messages and logs

---

**Last Updated:** February 12, 2026
**Status:** Ready for Implementation
**Priority:** HIGH - Application currently non-functional
