# Configuration Checklist

This document verifies that all critical configurations are set up correctly.

## ✅ Backend Configuration

### 1. Health Endpoints
- ✅ `/health` endpoint exists (no auth required)
- ✅ `/api/health` endpoint exists (no auth required)
- ✅ Both return `{"status": "healthy", "timestamp": "...", "cloudinary_configured": bool}`

### 2. CORS Configuration
- ✅ CORS middleware is configured
- ✅ Handles `CORS_ORIGINS` environment variable (comma-separated)
- ✅ Falls back to `"*"` if not set
- ✅ Disables credentials when using `"*"` (security best practice)
- ✅ Allows all methods and headers

### 3. Cloudinary Integration
- ✅ Cloudinary configured if all 3 env vars are set:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- ✅ Falls back to local storage if Cloudinary not configured
- ✅ Upload endpoint (`/api/upload`) handles both Cloudinary and local storage
- ✅ Media serving endpoint (`/api/media/{filename}`) handles both

### 4. Database Configuration
- ✅ MongoDB connection via `MONGO_URI` or `MONGO_URL`
- ✅ Database name from `DB_NAME` (defaults to "guide2026")
- ✅ Proper error handling if MongoDB URI is missing

### 5. Authentication
- ✅ JWT configuration with `JWT_SECRET`
- ✅ JWT expiration: 720 hours (30 days)
- ✅ HTTPBearer security scheme

### 6. File Upload
- ✅ Upload endpoint requires authentication
- ✅ Supports images, videos, and documents
- ✅ Returns Cloudinary URL if configured, otherwise relative URL
- ✅ Proper error handling and fallback

## ✅ Frontend Configuration

### 1. API URL Configuration
- ✅ Uses `REACT_APP_API_URL` or `REACT_APP_BACKEND_URL`
- ✅ Falls back to `http://127.0.0.1:8000` for local development
- ✅ Handles both absolute URLs and hostnames (adds `https://` if needed)
- ✅ Consistent across all files:
  - `frontend/src/lib/api.js`
  - `frontend/src/contexts/AuthContext.js`
  - `frontend/src/lib/utils.js`
  - `frontend/src/pages/LoginPage.js`
  - `frontend/src/pages/SignupPage.js`

### 2. Health Check Implementation
- ✅ LoginPage checks backend health on mount
- ✅ SignupPage checks backend health on mount
- ✅ AuthContext checks backend health before login/signup
- ✅ All implementations try `/health` first, then `/api/health` as fallback
- ✅ Proper error handling (404, timeout, network errors)
- ✅ Shows user-friendly status indicators

### 3. Image URL Normalization
- ✅ `normalizeImageUrl()` function handles:
  - Double URLs (API_BASE + Cloudinary URL)
  - Absolute URLs (returns as-is)
  - Relative URLs (prepends API_BASE)
- ✅ `normalizeImageUrlsInObject()` recursively normalizes:
  - `icon_url`, `media_url`, `url`, `logo` fields
  - `block.data.url` in nested blocks arrays
- ✅ Applied in all relevant components

### 4. Upload Handlers
- ✅ All upload handlers check if URL is already absolute (Cloudinary)
- ✅ If absolute, uses directly; otherwise prepends API_BASE
- ✅ Implemented in:
  - `BlockComponent.js`
  - `LeftSidebar.js`
  - `RightInspector.js`
  - `WalkthroughBuilderPage.js`
  - `CategoriesPage.js`

### 5. Authentication Flow
- ✅ Login with retry logic (3 attempts, 5s delay)
- ✅ Signup with retry logic (3 attempts, 5s delay)
- ✅ Increased timeouts (45s for login/signup, 20s for fetchUser)
- ✅ Proper error handling for timeouts and network errors
- ✅ Skips fetchUser on public portal pages
- ✅ Skips fetchUser if user already exists

## ✅ Deployment Configuration (render.yaml)

### 1. Backend Service
- ✅ Type: web
- ✅ Environment: python
- ✅ Root directory: backend
- ✅ Build command: `pip install -r requirements.txt`
- ✅ Start command: `gunicorn -k uvicorn.workers.UvicornWorker server:app --bind 0.0.0.0:$PORT`
- ✅ Python version: 3.11.7

### 2. Environment Variables (Backend)
- ✅ `MONGO_URI` - Required, sync: false (set manually)
- ✅ `DB_NAME` - Default: "guide2026"
- ✅ `JWT_SECRET` - Auto-generated
- ✅ `CORS_ORIGINS` - Set to frontend URL + localhost
- ✅ `CLOUDINARY_CLOUD_NAME` - Optional, sync: false
- ✅ `CLOUDINARY_API_KEY` - Optional, sync: false
- ✅ `CLOUDINARY_API_SECRET` - Optional, sync: false

### 3. Frontend Service
- ✅ Type: web (static)
- ✅ Root directory: frontend
- ✅ Build command: `npm ci && npm run build`
- ✅ Static publish path: build
- ✅ SPA routing: rewrite `/*` to `/index.html`
- ✅ Node version: 18.20.4

### 4. Environment Variables (Frontend)
- ✅ `REACT_APP_API_URL` - Auto-set from backend service URL
- ✅ Uses `fromService.property: url` to get backend URL

## ✅ Dependencies

### Backend (requirements.txt)
- ✅ FastAPI, Uvicorn, Gunicorn
- ✅ Motor (MongoDB async driver)
- ✅ PyJWT, bcrypt (authentication)
- ✅ Cloudinary SDK
- ✅ All required dependencies listed

### Frontend (package.json)
- ✅ React 18.2.0
- ✅ React Router DOM 7.5.1
- ✅ Axios 1.8.4
- ✅ All UI components (Radix UI)
- ✅ TipTap (rich text editor)
- ✅ All required dependencies listed

## ⚠️ Manual Configuration Required

### On Render Dashboard:

1. **Backend Service - Environment Variables:**
   - Set `MONGO_URI` to your MongoDB connection string
   - (Optional) Set `CLOUDINARY_CLOUD_NAME`
   - (Optional) Set `CLOUDINARY_API_KEY`
   - (Optional) Set `CLOUDINARY_API_SECRET`

2. **Verify CORS_ORIGINS:**
   - Should include: `https://guide2026-frontend.onrender.com,http://localhost:3000`
   - Or set to `*` for development (less secure)

3. **Frontend Service:**
   - `REACT_APP_API_URL` is automatically set from backend service
   - No manual configuration needed

## 🔍 Verification Steps

1. **Health Check:**
   ```bash
   curl https://guide2026-backend.onrender.com/health
   # Should return: {"status":"healthy","timestamp":"...","cloudinary_configured":true/false}
   ```

2. **CORS:**
   - Open browser console on frontend
   - Check for CORS errors when making API calls
   - Should see no CORS errors

3. **Image Upload:**
   - Upload an image/icon
   - Check network tab for upload response
   - Verify image displays correctly (no broken images)

4. **Authentication:**
   - Try logging in
   - Check backend status indicator shows "Server ready"
   - Should work with retry logic if server is sleeping

## 📝 Notes

- All configurations are production-ready
- Fallbacks are in place for development
- Error handling is comprehensive
- Health checks work with Render free tier sleep behavior
- Image URLs are normalized consistently across the app
