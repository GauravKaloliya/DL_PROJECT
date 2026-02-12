# C.O.G.N.I.T. Deployment Guide

This guide provides step-by-step instructions for deploying the C.O.G.N.I.T. platform to Render.com with PostgreSQL.

## Prerequisites

- GitHub, GitLab, or Bitbucket account
- Render.com account (free tier available)

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │  (Static Site)
│   (React SPA)   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│    Backend      │  (Web Service)
│   (Flask API)   │
└────────┬────────┘
         │
         │ PostgreSQL
         ▼
┌─────────────────┐
│   PostgreSQL    │  (Database)
│   (Render DB)   │
└─────────────────┘
```

## Step 1: Prepare Your Repository

1. Fork or clone this repository to your Git provider
2. Push the code to your repository

```bash
git clone <your-repo-url>
cd <repo-name>
git push origin main
```

## Step 2: Create PostgreSQL Database on Render

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `cognit-db` (or your preference)
   - **Database Name**: `cognit`
   - **User**: `cognit` (or leave default)
4. Click "Create Database"
5. Wait for the database to be ready (2-3 minutes)
6. **Save the connection string** - you'll need it for the backend

## Step 3: Deploy Backend to Render

### Option A: Using render.yaml (Recommended)

1. In Render Dashboard, click "New +" → "Blueprint"
2. Connect your repository
3. Select the repository with the `render.yaml` file
4. Render will detect the blueprint and show you the services to create
5. Click "Apply"
6. Connect the PostgreSQL database:
   - Go to your backend service → Settings → Databases
   - Click "Create Database" → Select your existing PostgreSQL database
   - Click "Connect"
7. Configure environment variables:
   - Go to your backend service → Environment
   - Add the following variables:
     - `SECRET_KEY`: Generate with `openssl rand -hex 32`
     - `CORS_ORIGINS`: Your frontend URL (e.g., `https://cognit-frontend.onrender.com`)
     - `FLASK_DEBUG`: `0`
8. Deploy will automatically start

### Option B: Manual Setup

1. In Render Dashboard, click "New +" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `cognit-backend`
   - **Environment**: `Python 3`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && python app.py`
4. Click "Create Web Service"
5. Connect PostgreSQL database:
   - Go to Settings → Databases
   - Click "Create Database"
   - Select your existing PostgreSQL database
   - Click "Connect"
6. Configure environment variables:
   - Go to Environment tab
   - Add:
     - `SECRET_KEY`: Generate with `openssl rand -hex 32`
     - `CORS_ORIGINS`: Your frontend URL (will update after frontend deployment)
     - `FLASK_DEBUG`: `0`
     - `DATABASE_URL`: Will be auto-populated when you connect the database
7. Manual deploy if needed: Go to Deployments → Trigger deployment

## Step 4: Deploy Frontend to Render

1. In Render Dashboard, click "New +" → "Static Site"
2. Connect your repository
3. Configure:
   - **Name**: `cognit-frontend`
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
4. Click "Create Static Site"
5. Deploy will automatically start
6. After deployment, note your frontend URL (e.g., `https://cognit-frontend.onrender.com`)

## Step 5: Configure CORS

1. Go to your backend service on Render
2. Navigate to Environment tab
3. Update `CORS_ORIGINS`:
   - Old value: `http://localhost:5173`
   - New value: Your frontend URL (e.g., `https://cognit-frontend.onrender.com`)
4. Click "Save Changes"

## Step 6: Verify Deployment

### Test Backend Health

1. Visit your backend URL (e.g., `https://cognit-backend.onrender.com`)
2. Check API docs: `https://cognit-backend.onrender.com/`
3. Test health endpoint: `https://cognit-backend.onrender.com/api/health`
4. Expected response:
   ```json
   {
     "status": "healthy",
     "services": {
       "database": "connected",
       "images": "accessible"
     }
   }
   ```

### Test Frontend

1. Visit your frontend URL (e.g., `https://cognit-frontend.onrender.com`)
2. Check that the application loads
3. Try creating a participant
4. Verify API calls are working

## Step 7: Database Initialization

The database will be automatically initialized when the backend first starts. The schema includes:

- Tables: participants, consent_records, submissions, images, audit_log, performance_metrics
- Indexes: Optimized for common queries
- Views: participant_summary, submission_stats, image_coverage, submission_quality
- Triggers: Automatic audit logging

If you need to manually initialize:

```bash
# Access your backend service shell (via Terminal tab)
cd backend
python app.py --regenerate-db
```

## Environment Variables Reference

### Backend Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | Auto-set by Render |
| `SECRET_KEY` | Yes | Flask session secret | `openssl rand -hex 32` |
| `CORS_ORIGINS` | Yes | Allowed frontend URLs | `https://cognit-frontend.onrender.com` |
| `MIN_WORD_COUNT` | No | Min words per description | `60` |
| `TOO_FAST_SECONDS` | No | Too fast threshold | `5` |
| `IP_HASH_SALT` | No | IP hash salt | `your-salt-here` |
| `FLASK_DEBUG` | No | Flask debug mode | `0` |

### Frontend Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE` | No | Backend API URL | `https://cognit-backend.onrender.com/api` |

## Custom Domain (Optional)

1. **Backend**: 
   - Go to backend service → Settings → Custom Domains
   - Add your custom domain
   - Configure DNS records as shown

2. **Frontend**:
   - Go to frontend site → Settings → Custom Domains
   - Add your custom domain
   - Configure DNS records as shown

3. **Update CORS**:
   - Update `CORS_ORIGINS` in backend environment variables
   - Add your custom frontend domain

## Monitoring and Logs

### Backend Logs

1. Go to backend service → Deployments
2. Click on a deployment → View logs
3. Monitor for errors or issues

### Database Monitoring

1. Go to your PostgreSQL database → Metrics
2. Monitor:
   - CPU usage
   - Memory usage
   - Active connections
   - Storage usage

## Troubleshooting

### Backend Won't Start

**Check logs for:**
- Missing environment variables
- Database connection errors
- Port binding issues

**Solutions:**
- Verify all required environment variables are set
- Ensure PostgreSQL database is connected
- Check `startCommand` is correct

### Database Connection Failed

**Symptoms:**
- Health check shows database error
- API returns 500 errors

**Solutions:**
1. Verify PostgreSQL database is running
2. Check `DATABASE_URL` is set correctly
3. Ensure database exists and is accessible
4. Try restarting the backend service

### CORS Errors

**Symptoms:**
- Frontend can't reach backend
- Browser console shows CORS errors

**Solutions:**
1. Verify `CORS_ORIGINS` includes your frontend URL
2. Check for typos in URLs
3. Ensure both services are using HTTPS in production

### Frontend Build Fails

**Check logs for:**
- Node.js version issues
- Missing dependencies
- Build command errors

**Solutions:**
1. Ensure `package.json` exists in frontend directory
2. Verify build command is correct
3. Check all dependencies are listed in `package.json`

## Backup and Restore

### Database Backup

```bash
# From local machine (replace with your Render DB URL)
pg_dump "postgresql://user:pass@host:port/db" > backup.sql
```

### Database Restore

```bash
# Restore to Render database
psql "postgresql://user:pass@host:port/db" < backup.sql
```

## Security Best Practices

1. **Change default secrets**:
   - Generate strong `SECRET_KEY`
   - Use unique `IP_HASH_SALT`

2. **Limit database access**:
   - Use Render's built-in database
   - Don't expose database directly

3. **Enable HTTPS**:
   - Render provides HTTPS automatically
   - Ensure frontend uses HTTPS

4. **Monitor usage**:
   - Check Render dashboard for usage metrics
   - Set up alerts for high usage

5. **Regular updates**:
   - Keep dependencies updated
   - Monitor for security vulnerabilities

## Support

If you encounter issues:

1. Check this deployment guide
2. Review Render documentation
3. Check application logs
4. Contact support with specific error messages

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Project README](./README.md)