# Quick Deployment Guide: Vercel + Railway

## Backend on Railway (5 minutes)

1. **Sign up**: https://railway.app (free $5/month credit)

2. **New Project** → "Deploy from GitHub repo" → Select your repo

3. **Add Service**:
   - Railway auto-detects `backend/` folder
   - Auto-detects Python
   - Sets start command automatically

4. **Environment Variables** (copy from Render):
   ```
   MONGO_URI=<your-mongo-uri>
   DB_NAME=guide2026
   JWT_SECRET=<same-or-generate-new>
   CORS_ORIGINS=https://guide2026.vercel.app,http://localhost:3000
   CLOUDINARY_CLOUD_NAME=<your-value>
   CLOUDINARY_API_KEY=<your-value>
   CLOUDINARY_API_SECRET=<your-value>
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=<your-smtp-user>
   SMTP_PASSWORD=<your-smtp-password>
   SMTP_FROM_EMAIL=noreply@guide2026.com
   SMTP_FROM_NAME=Guide2026
   FRONTEND_URL=https://guide2026.vercel.app
   ```

5. **Get Backend URL**: Railway → Settings → Domains → Copy URL

## Frontend on Vercel (5 minutes)

1. **Sign up**: https://vercel.com (free forever)

2. **Import Project**:
   - "Add New" → "Project"
   - Import from GitHub
   - Select your repository

3. **Configure**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci --legacy-peer-deps && npm run build`
   - **Output Directory**: `build`
   - **Framework**: Create React App (auto-detected)

4. **Environment Variables**:
   ```
   REACT_APP_API_URL=https://your-backend.up.railway.app
   ```
   (Use Railway backend URL from step above)

5. **Deploy**: Click "Deploy" → Done!

## Update CORS

After Vercel deploys, get your frontend URL and update Railway:

**Railway → Your Service → Variables**:
```
CORS_ORIGINS=https://guide2026.vercel.app,http://localhost:3000
FRONTEND_URL=https://guide2026.vercel.app
```

Railway will redeploy automatically.

## Done!

Your app is now live on:
- Frontend: `https://guide2026.vercel.app`
- Backend: `https://your-backend.up.railway.app`

Total time: ~10 minutes, completely free!
