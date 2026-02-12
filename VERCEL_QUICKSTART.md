# Vercel Deployment - Quick Start

This is a condensed guide for deploying C.O.G.N.I.T. to Vercel. For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

## Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- Neon PostgreSQL account ([neon.tech](https://neon.tech))
- Git repository with this code

## Quick Deployment Steps

### 1. Create Neon Database

1. Sign in to [neon.tech](https://neon.tech)
2. Create new project: `cognit`
3. Copy the **Connection String** (starts with `postgresql://...`)

### 2. Deploy Backend

#### Via Vercel Dashboard:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. **New Project** → Import your repository
3. Settings:
   - **Project name**: `cognit-backend`
   - **Root Directory**: `backend` ⚠️ IMPORTANT
   - Framework: Other
4. **Deploy**
5. After deployment, go to **Settings** → **Environment Variables** and add:

```
DATABASE_URL=postgresql://user:password@host/database
SECRET_KEY=<run: openssl rand -hex 32>
CORS_ORIGINS=<will-add-after-frontend-deploy>
MIN_WORD_COUNT=60
TOO_FAST_SECONDS=5
IP_HASH_SALT=<run: openssl rand -hex 16>
FLASK_DEBUG=0
```

6. **Redeploy** after adding variables
7. Save your backend URL: `https://cognit-backend.vercel.app`

### 3. Deploy Frontend

1. Update `frontend/.env.production`:
```
VITE_API_BASE=https://cognit-backend.vercel.app
```

2. Commit and push:
```bash
git add frontend/.env.production
git commit -m "Update API URL for Vercel"
git push
```

3. In Vercel dashboard: **New Project**
4. Settings:
   - **Project name**: `cognit-frontend`
   - **Root Directory**: `frontend` ⚠️ IMPORTANT
   - Framework: Vite (auto-detected)
5. **Deploy**
6. Save your frontend URL: `https://cognit-frontend.vercel.app`

### 4. Update CORS

1. Go to backend project in Vercel
2. **Settings** → **Environment Variables**
3. Update `CORS_ORIGINS`:
```
CORS_ORIGINS=https://cognit-frontend.vercel.app
```
4. **Redeploy** backend

### 5. Initialize Database

Run locally:
```bash
cd backend
pip install -r requirements.txt
python init_db.py "postgresql://user:password@host/database"
```

### 6. Verify

- Backend: Visit `https://cognit-backend.vercel.app` (should show API docs)
- Health: Visit `https://cognit-backend.vercel.app/api/health`
- Frontend: Visit `https://cognit-frontend.vercel.app`

## Environment Variables Reference

### Backend
```bash
DATABASE_URL=postgresql://...         # From Neon
SECRET_KEY=$(openssl rand -hex 32)    # Generate this
CORS_ORIGINS=https://your-frontend-url.vercel.app
MIN_WORD_COUNT=60
TOO_FAST_SECONDS=5
IP_HASH_SALT=$(openssl rand -hex 16)  # Generate this
FLASK_DEBUG=0
```

### Frontend
```bash
VITE_API_BASE=https://your-backend-url.vercel.app
```

## Common Issues

### CORS Errors
- Ensure `CORS_ORIGINS` in backend includes frontend URL (no trailing slash)
- Redeploy backend after changing

### "Failed to fetch" / Network errors
- Check `VITE_API_BASE` in `frontend/.env.production`
- Verify backend is accessible
- Check browser console for detailed errors

### Database Connection Failed
- Verify `DATABASE_URL` is correct
- Ensure database is running in Neon dashboard
- Check connection string includes `?sslmode=require`

### Tables Not Found
- Run database initialization: `python backend/init_db.py <database-url>`
- Verify in Neon SQL Editor that tables exist

## Helper Script

Run the setup verification script:

```bash
./scripts/vercel-setup.sh
```

This will:
- Check prerequisites
- Verify project structure
- Generate environment variables
- Provide next steps

## Next Steps

1. Test the application end-to-end
2. Set up custom domains (optional)
3. Configure monitoring and alerts
4. Review [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for advanced topics

## Need Help?

See the full deployment guide: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
