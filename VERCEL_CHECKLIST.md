# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel with Neon PostgreSQL.

## Pre-Deployment Checklist

### Prerequisites
- [ ] GitHub/GitLab/Bitbucket account created
- [ ] Vercel account created ([vercel.com](https://vercel.com))
- [ ] Neon account created ([neon.tech](https://neon.tech))
- [ ] Git repository set up with this code
- [ ] Code committed and pushed to repository

### Local Setup Verification
- [ ] Run `./scripts/vercel-setup.sh` successfully
- [ ] All required files present:
  - [ ] `backend/vercel.json`
  - [ ] `backend/wsgi.py`
  - [ ] `backend/init_db.py`
  - [ ] `backend/requirements.txt`
  - [ ] `backend/schema.sql`
  - [ ] `frontend/vercel.json`
  - [ ] `frontend/.env.production`
- [ ] Images added to `backend/images/` directory (optional but recommended)
- [ ] Local development tested and working

## Database Setup (Neon)

### Create Neon Database
- [ ] Logged into Neon dashboard
- [ ] Created new project
- [ ] Project name set (e.g., `cognit`)
- [ ] PostgreSQL version selected (15+)
- [ ] Region selected (closest to target users)
- [ ] Database created successfully

### Save Connection Strings
- [ ] Connection string copied and saved securely
- [ ] Pooling URL copied (recommended for serverless)
- [ ] Connection details noted:
  - Host: ________________
  - Database: ________________
  - User: ________________
  - Password: ________________ (saved securely)

## Backend Deployment (Vercel)

### Deploy Backend
- [ ] Logged into Vercel dashboard
- [ ] Clicked "Add New" → "Project"
- [ ] Repository imported and connected
- [ ] Project settings configured:
  - [ ] Project name: `cognit-backend` (or custom)
  - [ ] Framework Preset: "Other"
  - [ ] **Root Directory: `backend`** ⚠️ CRITICAL
  - [ ] Build Command: (leave empty)
  - [ ] Output Directory: (leave default)
  - [ ] Install Command: `pip install -r requirements.txt`
- [ ] Initial deployment completed
- [ ] Backend URL noted: ________________

### Configure Backend Environment Variables
- [ ] Navigated to Project → Settings → Environment Variables
- [ ] Added `DATABASE_URL`:
  - Value: Your Neon connection string
  - Applied to: Production, Preview, Development
- [ ] Added `SECRET_KEY`:
  - Value: Generated with `openssl rand -hex 32`
  - Applied to: Production, Preview, Development
- [ ] Added `CORS_ORIGINS`:
  - Value: (will update after frontend deployment)
  - Applied to: Production, Preview, Development
- [ ] Added `MIN_WORD_COUNT`:
  - Value: `60`
  - Applied to: Production, Preview, Development
- [ ] Added `TOO_FAST_SECONDS`:
  - Value: `5`
  - Applied to: Production, Preview, Development
- [ ] Added `IP_HASH_SALT`:
  - Value: Generated with `openssl rand -hex 16`
  - Applied to: Production, Preview, Development
- [ ] Added `FLASK_DEBUG`:
  - Value: `0`
  - Applied to: Production, Preview, Development
- [ ] All environment variables saved
- [ ] Backend redeployed after adding variables

### Verify Backend Deployment
- [ ] Visited backend URL (e.g., `https://cognit-backend.vercel.app`)
- [ ] API documentation page loads
- [ ] Visited `/api/health` endpoint
- [ ] Health check returns successful response
- [ ] No errors in Vercel function logs

## Frontend Deployment (Vercel)

### Update Frontend Configuration
- [ ] Edited `frontend/.env.production`
- [ ] Set `VITE_API_BASE` to backend URL
- [ ] Changes committed and pushed to repository

### Deploy Frontend
- [ ] Logged into Vercel dashboard
- [ ] Clicked "Add New" → "Project"
- [ ] Same repository imported
- [ ] Project settings configured:
  - [ ] Project name: `cognit-frontend` (or custom)
  - [ ] Framework Preset: "Vite" (auto-detected)
  - [ ] **Root Directory: `frontend`** ⚠️ CRITICAL
  - [ ] Build Command: `npm run build` (auto-detected)
  - [ ] Output Directory: `dist` (auto-detected)
  - [ ] Install Command: `npm install` (auto-detected)
- [ ] Initial deployment completed
- [ ] Frontend URL noted: ________________

### Verify Frontend Deployment
- [ ] Visited frontend URL (e.g., `https://cognit-frontend.vercel.app`)
- [ ] Application loads without errors
- [ ] No console errors in browser
- [ ] Can navigate to `/survey` route

## Database Initialization

### Initialize Database Schema
- [ ] Local environment set up:
  - [ ] Python 3.9+ installed
  - [ ] Virtual environment created: `cd backend && python -m venv .venv`
  - [ ] Virtual environment activated: `source .venv/bin/activate`
  - [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Database initialization script run:
  - [ ] Command: `python init_db.py "your-database-url"`
  - [ ] Script completed successfully
  - [ ] All tables created
  - [ ] Verification passed

### Verify Database Initialization
- [ ] Logged into Neon dashboard
- [ ] Navigated to SQL Editor
- [ ] Verified tables exist:
  - [ ] `participants`
  - [ ] `consent_records`
  - [ ] `submissions`
  - [ ] `images`
  - [ ] `audit_log`
  - [ ] `performance_metrics`
- [ ] Verified views exist:
  - [ ] `vw_participant_summary`
  - [ ] `vw_submission_stats`
  - [ ] `vw_image_coverage`
  - [ ] `vw_submission_quality`

## CORS Configuration

### Update Backend CORS Settings
- [ ] Navigated to Vercel → Backend project → Settings → Environment Variables
- [ ] Updated `CORS_ORIGINS` with frontend URL
  - Example: `https://cognit-frontend.vercel.app`
- [ ] Saved changes
- [ ] Backend redeployed
- [ ] Redeployment completed successfully

## Final Verification

### End-to-End Testing
- [ ] Visited frontend URL in browser
- [ ] Opened browser console (F12)
- [ ] No CORS errors in console
- [ ] Navigated to `/survey` route
- [ ] Consent form loads
- [ ] Can submit consent form
- [ ] User details form loads
- [ ] Can create participant
- [ ] Survey images load
- [ ] Can submit image description
- [ ] Can complete full study flow
- [ ] No errors in browser console
- [ ] No errors in Vercel function logs

### Performance Check
- [ ] Backend health endpoint responds quickly
- [ ] Frontend loads in reasonable time
- [ ] Images load without significant delay
- [ ] No timeout errors

### Security Check
- [ ] HTTPS enabled on both frontend and backend (automatic on Vercel)
- [ ] CORS restricted to specific origins (not `*`)
- [ ] Environment variables not exposed in client
- [ ] No secrets committed to Git repository
- [ ] Database connection uses SSL (automatic with Neon)

## Post-Deployment Tasks

### Documentation
- [ ] Backend URL documented
- [ ] Frontend URL documented
- [ ] Environment variables documented (without values)
- [ ] Database connection details saved securely
- [ ] Deployment date recorded
- [ ] Any custom configuration documented

### Monitoring Setup
- [ ] Vercel email notifications enabled
- [ ] Neon database alerts configured (optional)
- [ ] Uptime monitoring set up (optional, e.g., UptimeRobot)
- [ ] Error tracking configured (optional)

### Team Communication
- [ ] Team notified of deployment
- [ ] URLs shared with stakeholders
- [ ] Access credentials shared securely (if needed)
- [ ] Documentation shared with team

## Optional Enhancements

### Custom Domains
- [ ] Custom domain purchased (optional)
- [ ] Backend custom domain:
  - [ ] Domain added in Vercel (e.g., `api.yourdomain.com`)
  - [ ] DNS configured
  - [ ] SSL certificate issued
- [ ] Frontend custom domain:
  - [ ] Domain added in Vercel (e.g., `app.yourdomain.com`)
  - [ ] DNS configured
  - [ ] SSL certificate issued
- [ ] CORS updated with custom domain
- [ ] Frontend `.env.production` updated with custom backend domain

### Advanced Monitoring
- [ ] Vercel Analytics enabled
- [ ] Neon metrics dashboard reviewed
- [ ] Custom logging implemented
- [ ] Error tracking service integrated (e.g., Sentry)
- [ ] Performance monitoring set up

## Troubleshooting Reference

If any step fails, refer to:
- [ ] `VERCEL_DEPLOYMENT.md` - Comprehensive troubleshooting guide
- [ ] Vercel function logs (Dashboard → Project → Logs)
- [ ] Neon database logs (Dashboard → Project → Logs)
- [ ] Browser console for frontend errors

## Rollback Plan

In case of critical issues:
- [ ] Previous deployment URL noted: ________________
- [ ] Rollback procedure documented:
  1. Go to Vercel → Project → Deployments
  2. Find previous working deployment
  3. Click "..." → "Promote to Production"
- [ ] Database backup procedure documented:
  - `pg_dump "your-database-url" > backup.sql`
- [ ] Rollback tested (optional)

## Sign-off

- [ ] All critical features tested and working
- [ ] Performance acceptable
- [ ] No security concerns
- [ ] Documentation complete
- [ ] Team notified

**Deployment completed by**: ________________  
**Date**: ________________  
**Backend URL**: ________________  
**Frontend URL**: ________________  

---

**Need Help?**  
See `VERCEL_DEPLOYMENT.md` for detailed troubleshooting and support information.
