# Free Deployment Alternatives (Render Pipeline Minutes Exhausted)

## Quick Solutions

### Option 1: Wait for Render Reset (Easiest)
**Render pipeline minutes reset monthly.**
- Check when your billing cycle resets (Render Dashboard → Billing)
- Manual deployments don't use pipeline minutes (only auto-deploys on git push)
- **Solution**: Manually deploy via Render dashboard without git push

### Option 2: Vercel (Best for Frontend) + Railway (Backend)

#### Frontend on Vercel (FREE)
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import your repository
4. **Root Directory**: `frontend`
5. **Build Command**: `npm ci --legacy-peer-deps && npm run build`
6. **Output Directory**: `build`
7. **Environment Variables**:
   - `REACT_APP_API_URL` = your backend URL

#### Backend on Railway (FREE - $5 credit/month)
1. Go to https://railway.app
2. Sign up with GitHub
3. New Project → Deploy from GitHub repo
4. Select your repo → Add Service → Select `backend` folder
5. Railway auto-detects Python
6. **Environment Variables** (add all from Render):
   - `MONGO_URI`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `JWT_SECRET`
   - `CORS_ORIGINS` (update to include Vercel URL)
   - All SMTP variables
   - `FRONTEND_URL`

### Option 3: Fly.io (FREE - Both Services)

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up: `flyctl auth signup`
3. **Backend**:
   ```bash
   cd backend
   fly launch
   # Follow prompts
   # Scale: fly scale count 1 --vm-size shared-cpu-1x
   ```
4. **Frontend** (static):
   ```bash
   cd frontend
   fly launch --static
   ```

### Option 4: Leapcell (FREE - Scale to Zero)

1. Go to https://leapcell.io
2. Sign up → New Project
3. Connect GitHub → Select repo
4. **Backend**: Deploy from `backend/` directory
5. **Frontend**: Deploy from `frontend/` directory as static site

**Pros**: Free forever, scale-to-zero (no charges when idle)

## Recommended: Railway + Vercel Setup

### Step 1: Deploy Backend to Railway

1. **Create Railway Account**:
   - Visit https://railway.app
   - Sign up with GitHub
   - Get $5 free credit/month

2. **Deploy Backend**:
   - Click "New Project"
   - "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect `backend/` folder
   - Auto-detects Python

3. **Configure Environment Variables**:
   ```
   MONGO_URI=<your-mongo-uri>
   DB_NAME=guide2026
   JWT_SECRET=<generate-new-secret>
   CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
   CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
   CLOUDINARY_API_KEY=<your-api-key>
   CLOUDINARY_API_SECRET=<your-api-secret>
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=<your-smtp-user>
   SMTP_PASSWORD=<your-smtp-password>
   SMTP_FROM_EMAIL=noreply@guide2026.com
   SMTP_FROM_NAME=Guide2026
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Get Backend URL**:
   - Railway provides URL like: `https://your-app.up.railway.app`

### Step 2: Deploy Frontend to Vercel

1. **Create Vercel Account**:
   - Visit https://vercel.com
   - Sign up with GitHub (free forever)

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository

3. **Configure Project**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `npm ci --legacy-peer-deps && npm run build`
   - **Output Directory**: `build`

4. **Environment Variables**:
   ```
   REACT_APP_API_URL=https://your-app.up.railway.app
   ```

5. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Step 3: Update CORS_ORIGINS

Update your Railway backend environment variable:
```
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

## Alternative: Manual Deployment on Render (No Pipeline Minutes)

If you want to stay on Render but avoid pipeline minutes:

1. **Disable Auto-Deploy**:
   - Render Dashboard → Service → Settings
   - Disable "Auto-Deploy"

2. **Manual Deploy**:
   - Go to Service → Manual Deploy
   - Select branch → Deploy
   - **Manual deploys don't use pipeline minutes!**

## Cost Comparison

| Platform | Free Tier | Limitations |
|----------|-----------|-------------|
| **Vercel** | ✅ Unlimited | Frontend only, 100GB bandwidth/month |
| **Railway** | ✅ $5/month credit | ~500 hours runtime on free tier |
| **Fly.io** | ✅ 3 shared VMs | 160GB outbound/month |
| **Leapcell** | ✅ Free forever | Scale-to-zero, 20 projects |
| **Koyeb** | ✅ Free starter | 512MB RAM, scale-to-zero |

## Migration Checklist

- [ ] Export all environment variables from Render
- [ ] Deploy backend to new platform
- [ ] Deploy frontend to new platform
- [ ] Update `CORS_ORIGINS` with new frontend URL
- [ ] Update `REACT_APP_API_URL` in frontend
- [ ] Update `FRONTEND_URL` in backend
- [ ] Test authentication flow
- [ ] Test file uploads
- [ ] Test PayPal integration (update webhook URL if needed)
- [ ] Update any external services pointing to old URLs

## Best Option for You

**Recommended**: **Vercel (Frontend) + Railway (Backend)**

**Why:**
- ✅ Both have generous free tiers
- ✅ Vercel is best-in-class for React static sites
- ✅ Railway is simple and works well with Python/FastAPI
- ✅ No pipeline minutes to worry about
- ✅ Easy GitHub integration

**Setup Time**: ~15 minutes

Need help with a specific platform? Let me know!
