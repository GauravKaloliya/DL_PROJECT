# Vercel Deployment Files Summary

This document lists all files added or modified for Vercel deployment support.

## New Files Added

### Configuration Files

1. **`/vercel.json`**
   - Root-level Vercel configuration (monorepo support)
   - Routes traffic to backend and frontend appropriately

2. **`/backend/vercel.json`**
   - Backend-specific Vercel configuration
   - Configures Python serverless function
   - Sets up image serving as static files
   - Defines function memory and timeout limits

3. **`/frontend/vercel.json`** (already existed)
   - Frontend-specific Vercel configuration
   - Handles SPA routing rewrites

4. **`/backend/wsgi.py`**
   - WSGI entry point for Vercel's Python runtime
   - Required by Vercel to run Flask applications
   - Simply imports and exports the Flask app

5. **`/.vercelignore`**
   - Root-level ignore file
   - Excludes unnecessary files from deployment

6. **`/backend/.vercelignore`**
   - Backend-specific ignore file
   - Excludes Python cache, virtual environments, etc.

7. **`/frontend/.vercelignore`**
   - Frontend-specific ignore file
   - Excludes node_modules, test files, etc.

### Scripts and Utilities

8. **`/backend/init_db.py`**
   - Standalone database initialization script
   - Can be run locally to initialize Neon PostgreSQL database
   - Includes verification and error handling
   - Usage: `python init_db.py <database-url>`

9. **`/scripts/vercel-setup.sh`**
   - Pre-deployment verification script
   - Checks prerequisites (Git, Node.js, Python)
   - Verifies project structure
   - Generates environment variables
   - Provides deployment checklist

### Documentation

10. **`/VERCEL_DEPLOYMENT.md`**
    - Comprehensive deployment guide (18,000+ words)
    - Step-by-step instructions for Vercel + Neon setup
    - Troubleshooting section
    - Monitoring and maintenance guidelines
    - Security best practices

11. **`/VERCEL_QUICKSTART.md`**
    - Condensed quick-start guide
    - Essential steps only
    - Perfect for experienced users
    - References detailed guide for more info

12. **`/VERCEL_FILES_SUMMARY.md`** (this file)
    - Lists all Vercel-related files
    - Explains what each file does
    - Helps understand the deployment setup

## Modified Files

### Backend Modifications

1. **`/backend/app.py`**
   - Added serverless environment detection
   - Skips automatic DB initialization in Vercel (checks for `VERCEL=1` env var)
   - Prevents initialization on every cold start
   - Database must be initialized manually using `init_db.py`

   **Changes:**
   - Added check for `VERCEL` environment variable in `initialize_app()` function
   - Skips `migrate_database_schema()` and `init_db()` when running on Vercel

### Frontend Modifications

2. **`/frontend/.env.production`** (already existed)
   - Should be updated with actual Vercel backend URL after deployment
   - Current value is placeholder and needs to be changed

### Documentation Updates

3. **`/README.md`**
   - Updated "Tech Stack" section to mention Vercel + Neon
   - Replaced Render.com deployment section with:
     - Vercel + Neon PostgreSQL (Recommended)
     - Render.com (Alternative)
   - Added references to new deployment guides
   - Added helper script usage instructions

## File Structure Overview

```
cognit/
├── vercel.json                      # NEW: Root Vercel config
├── .vercelignore                    # NEW: Root ignore file
├── VERCEL_DEPLOYMENT.md             # NEW: Detailed deployment guide
├── VERCEL_QUICKSTART.md             # NEW: Quick start guide
├── VERCEL_FILES_SUMMARY.md          # NEW: This file
├── README.md                        # MODIFIED: Updated deployment section
│
├── backend/
│   ├── vercel.json                  # NEW: Backend Vercel config
│   ├── .vercelignore                # NEW: Backend ignore file
│   ├── wsgi.py                      # NEW: WSGI entry point
│   ├── init_db.py                   # NEW: Database initialization script
│   ├── app.py                       # MODIFIED: Added serverless detection
│   ├── requirements.txt             # (no changes)
│   ├── schema.sql                   # (no changes)
│   └── ...
│
├── frontend/
│   ├── vercel.json                  # (already existed)
│   ├── .vercelignore                # NEW: Frontend ignore file
│   ├── .env.production              # (update after backend deployment)
│   └── ...
│
└── scripts/
    └── vercel-setup.sh              # NEW: Setup verification script
```

## How These Files Work Together

### Deployment Flow

1. **Backend Deployment**:
   - `backend/vercel.json` tells Vercel how to build and deploy the backend
   - `backend/wsgi.py` serves as the entry point for the serverless function
   - `backend/app.py` detects Vercel environment and skips auto-initialization
   - Images in `backend/images/` are served as static files

2. **Frontend Deployment**:
   - `frontend/vercel.json` handles SPA routing
   - `frontend/.env.production` provides the backend API URL
   - Built files are served as static site

3. **Database Setup**:
   - User creates Neon PostgreSQL database separately
   - `backend/init_db.py` is run locally to initialize schema
   - Connection string stored in Vercel environment variables

### Environment Variables Flow

```
Neon Dashboard → Copy DATABASE_URL → Vercel Dashboard (Backend) → Environment Variables
                                  
Frontend URL → Vercel Dashboard (Backend) → CORS_ORIGINS → Redeploy

Backend URL → frontend/.env.production → VITE_API_BASE → Rebuild Frontend
```

## Usage Guide

### For First-Time Deployment

1. Run setup verification:
   ```bash
   ./scripts/vercel-setup.sh
   ```

2. Follow the guide:
   - Quick: `VERCEL_QUICKSTART.md`
   - Detailed: `VERCEL_DEPLOYMENT.md`

3. Deploy backend to Vercel (set root directory to `backend`)

4. Deploy frontend to Vercel (set root directory to `frontend`)

5. Initialize database:
   ```bash
   cd backend
   pip install -r requirements.txt
   python init_db.py "postgresql://user:pass@host/db"
   ```

### For Updates

**Backend updates:**
```bash
git push  # Vercel auto-deploys from main branch
```

**Frontend updates:**
```bash
# Update code
git push  # Vercel auto-deploys

# If API URL changed, update .env.production and redeploy
```

**Database schema updates:**
```bash
# Update schema.sql
python backend/init_db.py "your-database-url"
```

## Key Differences from Render.com

| Aspect | Vercel | Render.com |
|--------|--------|------------|
| **Backend** | Serverless functions | Traditional server |
| **Database Init** | Manual (`init_db.py`) | Automatic on start |
| **Cold Starts** | Yes (serverless) | No (always running) |
| **Scaling** | Automatic (per request) | Manual/auto scaling |
| **Cost Model** | Pay per execution | Pay per server uptime |
| **Database** | External (Neon) | Built-in or external |
| **Configuration** | `vercel.json` | `render.yaml` or dashboard |

## Environment Variables

### Backend (Vercel)

Must be set in Vercel dashboard under Project Settings → Environment Variables:

```bash
DATABASE_URL=postgresql://user:pass@host/db  # From Neon
SECRET_KEY=<32-char-hex>                     # Generate with: openssl rand -hex 32
CORS_ORIGINS=https://your-frontend.vercel.app
MIN_WORD_COUNT=60
TOO_FAST_SECONDS=5
IP_HASH_SALT=<16-char-hex>                   # Generate with: openssl rand -hex 16
FLASK_DEBUG=0
```

### Frontend (Vercel)

Set in `frontend/.env.production` file (committed to repo):

```bash
VITE_API_BASE=https://your-backend.vercel.app
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors**
   - Ensure `backend` is set as root directory in Vercel
   - Check `requirements.txt` includes all dependencies

2. **Database connection fails**
   - Verify `DATABASE_URL` is set in Vercel
   - Ensure Neon database is running
   - Check connection string format

3. **CORS errors**
   - Update `CORS_ORIGINS` with frontend URL
   - Redeploy backend
   - No trailing slash in URLs

4. **Images not loading**
   - Ensure images are in `backend/images/` directory
   - Check `backend/vercel.json` static build config

### Getting Help

1. Check troubleshooting in `VERCEL_DEPLOYMENT.md`
2. Review Vercel function logs in dashboard
3. Check Neon database metrics
4. Create GitHub issue with error details

## Security Notes

- Never commit `.env` files with real credentials
- Use `.env.production` for non-sensitive frontend config only
- Set secrets via Vercel dashboard environment variables
- Rotate `SECRET_KEY` and `IP_HASH_SALT` periodically
- Use strong, unique values for all secrets

## Maintenance

### Regular Tasks

**Weekly:**
- Review Vercel function logs
- Check Neon database usage

**Monthly:**
- Update dependencies
- Review and optimize database queries
- Check for security updates

**Quarterly:**
- Rotate secret keys
- Security audit
- Performance review

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Python Runtime](https://vercel.com/docs/runtimes#official-runtimes/python)
- [Neon Documentation](https://neon.tech/docs)
- [Flask on Vercel Guide](https://vercel.com/guides/using-flask-with-vercel)

## Support

For issues specific to this deployment setup:
1. Check the comprehensive guide: `VERCEL_DEPLOYMENT.md`
2. Review this file for understanding the structure
3. Run `./scripts/vercel-setup.sh` to verify setup
4. Create a GitHub issue if problem persists

---

**Last Updated**: February 2026
**Version**: 1.0
