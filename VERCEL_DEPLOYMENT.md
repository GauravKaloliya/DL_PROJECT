# C.O.G.N.I.T. Vercel Deployment Guide

This guide provides step-by-step instructions for deploying the C.O.G.N.I.T. platform to Vercel with Neon PostgreSQL.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
  - [Step 1: Set Up Neon PostgreSQL Database](#step-1-set-up-neon-postgresql-database)
  - [Step 2: Deploy Backend to Vercel](#step-2-deploy-backend-to-vercel)
  - [Step 3: Deploy Frontend to Vercel](#step-3-deploy-frontend-to-vercel)
  - [Step 4: Initialize Database](#step-4-initialize-database)
  - [Step 5: Configure CORS](#step-5-configure-cors)
- [Environment Variables](#environment-variables)
- [Database Management](#database-management)
- [Troubleshooting](#troubleshooting)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

- GitHub account (or GitLab/Bitbucket)
- Vercel account (free tier available at [vercel.com](https://vercel.com))
- Neon account (free tier available at [neon.tech](https://neon.tech))
- Git repository with this codebase

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │  (Vercel Static Site)
│   (React SPA)   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│    Backend      │  (Vercel Serverless Functions)
│   (Flask API)   │
└────────┬────────┘
         │
         │ PostgreSQL (SSL)
         ▼
┌─────────────────┐
│   PostgreSQL    │  (Neon Serverless DB)
│   (Neon DB)     │
└─────────────────┘
```

## Quick Start

For experienced users, here's the TL;DR version:

```bash
# 1. Create Neon database and get connection string
# 2. Fork/clone this repository to GitHub
# 3. Deploy backend to Vercel
vercel --prod
# Set environment variables in Vercel dashboard
# 4. Deploy frontend to Vercel (separate project)
cd frontend && vercel --prod
# 5. Initialize database
python backend/init_db.py <your-database-url>
```

## Detailed Setup

### Step 1: Set Up Neon PostgreSQL Database

#### 1.1 Create Neon Account and Project

1. Go to [neon.tech](https://neon.tech) and sign up/sign in
2. Click **"Create a project"**
3. Configure your project:
   - **Project name**: `cognit` (or your preference)
   - **PostgreSQL version**: 15 or higher (recommended)
   - **Region**: Choose closest to your users
4. Click **"Create project"**

#### 1.2 Get Database Connection Strings

After project creation, you'll see multiple connection strings. Save these:

- **Connection string** (for general use): `postgresql://user:password@host/database`
- **Prisma URL** (if shown): For better compatibility
- **Pooling URL** (for serverless): Recommended for Vercel

Example:
```
POSTGRES_URL=postgresql://cognit_user:AbCdEfGh@ep-cool-cloud-123456.us-east-2.aws.neon.tech/cognit
```

**Important**: Keep these credentials secure!

#### 1.3 Configure Database

1. In the Neon dashboard, go to your database
2. Note the following details:
   - **Host**: Your database endpoint
   - **Database name**: Usually matches project name
   - **User**: Your database username
   - **Password**: Auto-generated password

### Step 2: Deploy Backend to Vercel

#### 2.1 Prepare Repository

1. Ensure your code is pushed to GitHub/GitLab/Bitbucket
2. Make sure the following files exist in your repository:
   - `/backend/vercel.json` ✓ (already configured)
   - `/backend/wsgi.py` ✓ (already configured)
   - `/backend/requirements.txt` ✓ (already configured)

#### 2.2 Deploy to Vercel

**Option A: Using Vercel Dashboard (Recommended for First-Time)**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your repository
4. Configure project:
   - **Project Name**: `cognit-backend` (or your preference)
   - **Framework Preset**: Other
   - **Root Directory**: `backend` ⚠️ **IMPORTANT**: Set this to `backend`
   - **Build Command**: Leave empty (not needed for Python)
   - **Output Directory**: Leave default
   - **Install Command**: `pip install -r requirements.txt`

5. Click **"Deploy"**

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy backend (from project root)
cd backend
vercel --prod

# Follow the prompts:
# - Set up and deploy: Y
# - Scope: Your account
# - Link to existing project: N (first time)
# - Project name: cognit-backend
# - Root directory: ./
```

#### 2.3 Configure Environment Variables

After deployment, configure environment variables:

1. Go to your project in Vercel dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. Add the following variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | PostgreSQL database URL |
| `SECRET_KEY` | Generate with: `openssl rand -hex 32` | Flask secret key |
| `CORS_ORIGINS` | Your frontend URL (add after frontend deployment) | Allowed CORS origins |
| `MIN_WORD_COUNT` | `60` | Minimum words for descriptions |
| `TOO_FAST_SECONDS` | `5` | Too-fast threshold |
| `IP_HASH_SALT` | Generate with: `openssl rand -hex 16` | Salt for IP hashing |
| `FLASK_DEBUG` | `0` | Debug mode (0=off, 1=on) |

**Important**: After adding environment variables, redeploy:
```bash
vercel --prod
```

Or click **"Redeploy"** in the Vercel dashboard.

#### 2.4 Note Backend URL

After deployment, note your backend URL:
```
https://cognit-backend.vercel.app
```

You'll need this for the frontend configuration.

### Step 3: Deploy Frontend to Vercel

#### 3.1 Update Frontend Environment Variables

Before deploying, update the frontend environment file:

1. Edit `frontend/.env.production`:
```env
VITE_API_BASE=https://your-backend-url.vercel.app
```

Replace `your-backend-url` with your actual backend URL from Step 2.4.

Commit this change:
```bash
git add frontend/.env.production
git commit -m "Update frontend API URL for Vercel deployment"
git push
```

#### 3.2 Deploy Frontend

**Option A: Using Vercel Dashboard**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import the same repository
4. Configure project:
   - **Project Name**: `cognit-frontend`
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` ⚠️ **IMPORTANT**
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

5. Click **"Deploy"**

**Option B: Using Vercel CLI**

```bash
# Deploy frontend (from project root)
cd frontend
vercel --prod

# Follow the prompts
```

#### 3.3 Note Frontend URL

After deployment, note your frontend URL:
```
https://cognit-frontend.vercel.app
```

### Step 4: Initialize Database

The database needs to be initialized with the schema. You have two options:

#### Option A: Using Local Script (Recommended)

1. Ensure you have Python 3.9+ and required packages:
```bash
cd backend
pip install -r requirements.txt
```

2. Run the initialization script:
```bash
python init_db.py "postgresql://user:password@host/database"
```

Or use environment variable:
```bash
export DATABASE_URL="postgresql://user:password@host/database"
python init_db.py
```

You should see output like:
```
============================================================
C.O.G.N.I.T. Database Initialization
============================================================

Connecting to database...
✓ Connected to: PostgreSQL 15.0
Reading schema.sql...
✓ Schema loaded (8631 characters)
Initializing database schema...
✓ CREATE TABLE IF NOT EXISTS participants...
✓ CREATE TABLE IF NOT EXISTS images...
...
✓ Database initialization completed successfully!
============================================================
```

#### Option B: Using Neon SQL Editor

1. Go to Neon dashboard → Your project → **SQL Editor**
2. Open `backend/schema.sql` in a text editor
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **"Run"**

### Step 5: Configure CORS

Now that both frontend and backend are deployed, configure CORS:

1. Go to Vercel dashboard → Backend project
2. **Settings** → **Environment Variables**
3. Update `CORS_ORIGINS`:
   ```
   https://cognit-frontend.vercel.app
   ```
   
   Or for multiple origins:
   ```
   https://cognit-frontend.vercel.app,https://your-custom-domain.com
   ```

4. **Redeploy** the backend for changes to take effect

### Step 6: Verify Deployment

#### 6.1 Test Backend

1. Visit your backend URL: `https://cognit-backend.vercel.app`
2. You should see the API documentation page
3. Test health endpoint: `https://cognit-backend.vercel.app/api/health`

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "images": "accessible"
  }
}
```

#### 6.2 Test Frontend

1. Visit your frontend URL: `https://cognit-frontend.vercel.app`
2. The application should load
3. Test the full flow:
   - Navigate to `/survey`
   - Fill consent form
   - Create participant
   - View a trial

#### 6.3 Test API Communication

Open browser console and check for:
- ✓ No CORS errors
- ✓ Successful API responses
- ✓ Images loading correctly

## Environment Variables

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✓ Yes | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `SECRET_KEY` | ✓ Yes | Flask session secret (32+ chars) | `openssl rand -hex 32` |
| `CORS_ORIGINS` | ✓ Yes | Allowed frontend URLs (comma-separated) | `https://app.vercel.app` |
| `MIN_WORD_COUNT` | No | Minimum words per description | `60` (default) |
| `TOO_FAST_SECONDS` | No | Too-fast threshold in seconds | `5` (default) |
| `IP_HASH_SALT` | No | Salt for privacy-preserving IP hashing | `openssl rand -hex 16` |
| `FLASK_DEBUG` | No | Debug mode (0 or 1) | `0` (production) |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE` | No | Backend API URL | `https://cognit-backend.vercel.app` |

**Note**: If `VITE_API_BASE` is not set, the frontend will use relative URLs (which won't work on Vercel since frontend and backend are separate deployments).

## Database Management

### Accessing the Database

#### Using Neon Dashboard

1. Go to Neon dashboard → Your project
2. Click **"SQL Editor"**
3. Run queries directly

#### Using psql (PostgreSQL CLI)

```bash
psql "postgresql://user:password@host/database?sslmode=require"
```

#### Using GUI Tools

Popular PostgreSQL GUI tools that work with Neon:
- **pgAdmin** ([pgadmin.org](https://www.pgadmin.org))
- **DBeaver** ([dbeaver.io](https://dbeaver.io))
- **TablePlus** ([tableplus.com](https://tableplus.com))

Connection details:
- **Host**: From your Neon connection string
- **Port**: 5432
- **Database**: Your database name
- **Username**: From connection string
- **Password**: From connection string
- **SSL Mode**: Require

### Database Backup

#### Automatic Backups (Neon)

Neon provides automatic backups:
- Point-in-time recovery
- Branch-based backups
- See Neon dashboard → Your project → **Backups**

#### Manual Backup

```bash
# Export database to SQL file
pg_dump "postgresql://user:pass@host/db" > backup.sql

# Restore from backup
psql "postgresql://user:pass@host/db" < backup.sql
```

### Database Migrations

When you update `schema.sql`:

1. Test locally first
2. Backup production database
3. Run migration script:
```bash
python init_db.py "your-production-database-url"
```

Or apply changes manually via Neon SQL Editor.

## Troubleshooting

### Backend Deployment Issues

#### Error: "Module not found"

**Symptom**: Function fails with "No module named 'X'"

**Solution**:
1. Ensure package is in `requirements.txt`
2. Check that root directory is set to `backend` in Vercel
3. Redeploy

#### Error: "DATABASE_URL not set"

**Symptom**: Database errors or health check fails

**Solution**:
1. Go to Vercel dashboard → Backend project → Settings → Environment Variables
2. Ensure `DATABASE_URL` is set correctly
3. Redeploy

#### Error: "CORS error" in browser console

**Symptom**: Browser shows "blocked by CORS policy"

**Solution**:
1. Check `CORS_ORIGINS` includes your frontend URL
2. Ensure no trailing slash in URLs
3. Redeploy backend after changing
4. Clear browser cache

### Frontend Deployment Issues

#### Error: "Failed to fetch" or "Network error"

**Symptom**: API calls fail

**Solution**:
1. Check `VITE_API_BASE` in `.env.production`
2. Verify backend is accessible: visit backend URL in browser
3. Check browser console for CORS errors
4. Rebuild and redeploy frontend

#### Blank page or 404 on routes

**Symptom**: Refreshing a page shows 404

**Solution**:
- Ensure `frontend/vercel.json` has the rewrite rule (already configured)
- Redeploy frontend

### Database Issues

#### Error: "Connection refused" or "Connection timeout"

**Symptom**: Cannot connect to database

**Solution**:
1. Check database is running in Neon dashboard
2. Verify connection string is correct
3. Ensure SSL mode is enabled: `?sslmode=require`
4. Check Neon service status

#### Error: "Too many connections"

**Symptom**: Database refuses connections

**Solution**:
- Neon free tier has connection limits
- Use connection pooling URL (from Neon dashboard)
- Reduce `pool_size` in `app.py` if needed

#### Error: "Relation does not exist"

**Symptom**: Tables not found

**Solution**:
1. Run database initialization:
```bash
python backend/init_db.py "your-database-url"
```
2. Verify tables exist in Neon SQL Editor

### Performance Issues

#### Slow cold starts

**Symptom**: First request after idle is very slow

**Solution**:
- This is normal for serverless functions
- Consider Vercel Pro for faster cold starts
- Keep functions warm with periodic health checks

#### Database query timeouts

**Symptom**: Queries take too long or timeout

**Solution**:
1. Check query performance in Neon dashboard
2. Ensure indexes are created (done by `init_db.py`)
3. Optimize slow queries
4. Consider upgrading Neon plan for better performance

## Monitoring and Maintenance

### Vercel Monitoring

1. **Logs**:
   - Go to Vercel dashboard → Project → **Logs**
   - View real-time function logs
   - Filter by function or time period

2. **Analytics**:
   - Vercel dashboard → Project → **Analytics**
   - View traffic, performance metrics
   - Monitor edge network performance

3. **Alerts**:
   - Set up custom alerts for errors
   - Monitor function execution times
   - Track deployment status

### Neon Monitoring

1. **Metrics**:
   - Neon dashboard → Project → **Metrics**
   - CPU, memory, storage usage
   - Connection counts
   - Query performance

2. **Query Monitoring**:
   - Neon dashboard → Project → **Queries**
   - Slow query log
   - Most frequent queries
   - Optimization suggestions

### Health Checks

Set up automated health checks:

```bash
# Create a cron job or use a service like UptimeRobot
curl https://cognit-backend.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "images": "accessible"
  }
}
```

### Regular Maintenance

**Weekly**:
- Check Vercel function logs for errors
- Review Neon database metrics
- Monitor storage usage

**Monthly**:
- Review and optimize slow queries
- Check for dependency updates
- Review error logs and fix issues
- Backup important data

**Quarterly**:
- Security audit
- Performance optimization review
- Update dependencies

## Custom Domains (Optional)

### Frontend Custom Domain

1. Go to Vercel dashboard → Frontend project → **Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (can take up to 48 hours)

### Backend Custom Domain

1. Go to Vercel dashboard → Backend project → **Settings** → **Domains**
2. Add your API subdomain (e.g., `api.yourdomain.com`)
3. Configure DNS records
4. Update `VITE_API_BASE` in frontend to use new domain
5. Update `CORS_ORIGINS` in backend to include new frontend domain

## Cost Considerations

### Vercel Free Tier Limits

- **Bandwidth**: 100 GB/month
- **Function Executions**: 100 GB-hours
- **Build Minutes**: 6,000 minutes/month
- **Deployments**: Unlimited

If you exceed limits, consider:
- Vercel Pro plan ($20/month)
- Optimize images and assets
- Implement caching strategies

### Neon Free Tier Limits

- **Storage**: 3 GB
- **Compute**: 192 hours/month (shared)
- **Projects**: 1 project (free tier)

If you exceed limits:
- Upgrade to Neon Pro
- Optimize database queries
- Clean up old data

## Security Best Practices

1. **Environment Variables**:
   - Never commit secrets to Git
   - Use strong, unique `SECRET_KEY`
   - Rotate credentials periodically

2. **Database**:
   - Always use SSL connections
   - Limit database user permissions
   - Regular security audits

3. **CORS**:
   - Only allow specific domains
   - Never use `CORS_ORIGINS=*` in production

4. **Rate Limiting**:
   - Flask-Limiter is configured
   - Monitor for abuse
   - Adjust limits as needed

5. **Updates**:
   - Keep dependencies updated
   - Monitor security advisories
   - Test updates before deploying

## Support and Resources

### Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Vite Documentation](https://vitejs.dev/)

### Community

- [Vercel Discord](https://vercel.com/discord)
- [Neon Discord](https://discord.gg/neon)
- [GitHub Issues](../../issues) (for this project)

### Need Help?

If you encounter issues not covered in this guide:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review Vercel function logs
3. Check Neon database metrics
4. Create a GitHub issue with:
   - Detailed error description
   - Steps to reproduce
   - Relevant logs/screenshots

## Next Steps

After successful deployment:

1. ✓ Test all application features
2. ✓ Set up monitoring and alerts
3. ✓ Configure custom domains (optional)
4. ✓ Set up automated backups
5. ✓ Document your specific configuration
6. ✓ Train your team on deployment process

**Congratulations! Your C.O.G.N.I.T. platform is now deployed on Vercel!** 🎉
