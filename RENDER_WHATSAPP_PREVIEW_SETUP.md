# WhatsApp Preview Setup for Render - Step-by-Step Guide

## Problem
WhatsApp crawlers access `/portal/{slug}` directly, but your frontend is a static site that serves `index.html` for all routes. We need crawlers to hit the backend route that returns HTML with Open Graph tags.

## Solution Overview
Since Render static sites can't proxy requests, we'll:
1. Create a serverless function in the frontend that detects crawlers
2. For crawlers: Fetch OG HTML from backend and return it
3. For browsers: Serve the normal React app

## Step-by-Step Implementation

### Step 1: Get Your Backend Service URL

1. Go to https://dashboard.render.com
2. Click on your **`guide2026-backend`** service
3. Copy the service URL (e.g., `https://guide2026-backend-xxxx.onrender.com`)
4. Save this URL - you'll need it in Step 3

### Step 2: Update Backend Route (Already Done ✅)

The backend route `/portal/{slug}` is already implemented and:
- Detects crawlers by User-Agent
- Returns HTML with OG tags for crawlers
- Redirects browsers to frontend

### Step 3: Create Serverless Function for Frontend

Since Render static sites can't proxy, we need to create a serverless function. However, Render's free tier doesn't support serverless functions for static sites.

**Alternative Solution: Use a Custom Domain with Reverse Proxy**

If you have a custom domain (like `interguide.app`), configure it to route `/portal/*` to backend.

### Step 4: Configure Frontend to Handle Portal Routes

We'll create a special HTML file that gets served for portal routes and redirects crawlers to backend.

#### Option A: Using _redirects (Recommended for Render)

Update `frontend/public/_redirects`:

```
# Redirect portal routes for crawlers to backend
/portal/*  https://YOUR-BACKEND-URL.onrender.com/portal/:splat  200

# SPA fallback for all other routes
/*    /index.html   200
```

**Replace `YOUR-BACKEND-URL.onrender.com` with your actual backend URL from Step 1.**

#### Option B: Create a Server-Side HTML File (If Option A doesn't work)

Create `frontend/public/portal.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <script>
        // Detect if crawler
        const userAgent = navigator.userAgent.toLowerCase();
        const isCrawler = /whatsapp|facebook|twitter|linkedin|slack|discord|telegram|crawler|spider|bot/i.test(userAgent);
        
        if (isCrawler) {
            // Redirect crawler to backend
            const slug = window.location.pathname.split('/portal/')[1];
            if (slug) {
                window.location.replace('https://YOUR-BACKEND-URL.onrender.com/portal/' + slug);
            }
        } else {
            // Redirect browser to SPA
            window.location.replace('/');
        }
    </script>
</head>
<body>
    <p>Loading...</p>
</body>
</html>
```

### Step 5: Update render.yaml

Add environment variable for backend URL:

```yaml
  # Service 2: Frontend (Static Site)
  - type: web
    name: guide2026-frontend
    runtime: static
    rootDir: frontend
    buildCommand: "npm ci --legacy-peer-deps && npm run build"
    staticPublishPath: build
    routes:
      # Portal routes - redirect to backend for OG tags
      - type: rewrite
        source: /portal/*
        destination: /portal.html
      # SPA fallback: allow deep-links
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: NODE_VERSION
        value: "18.20.4"
      - key: CI
        value: "false"
      - key: REACT_APP_API_URL
        fromService:
          name: guide2026-backend
          type: web
          property: url
      # Add backend URL for portal redirects
      - key: REACT_APP_BACKEND_URL
        fromService:
          name: guide2026-backend
          type: web
          property: url
```

### Step 6: Better Solution - Use Custom Domain with Nginx

If you have a custom domain (`interguide.app`), configure Nginx to route `/portal/*` to backend:

```nginx
location /portal/ {
    proxy_pass https://guide2026-backend-xxxx.onrender.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Step 7: Testing

1. **Test Backend Route Directly:**
   ```
   curl -A "WhatsApp/2.0" https://YOUR-BACKEND-URL.onrender.com/portal/timedox
   ```
   Should return HTML with OG tags.

2. **Test Frontend Route:**
   ```
   curl -A "WhatsApp/2.0" https://YOUR-FRONTEND-URL.onrender.com/portal/timedox
   ```
   Should redirect to backend or return OG HTML.

3. **Test in WhatsApp:**
   - Share link: `https://www.interguide.app/portal/timedox`
   - Check preview shows workspace logo and title

## Recommended Approach for Render

Since Render static sites have limitations, the **best solution** is:

1. **Use a custom domain** (`interguide.app`) with a reverse proxy (Cloudflare, Nginx, etc.)
2. **Configure the proxy** to route `/portal/*` to your backend service
3. **Keep frontend** serving the React app for all other routes

## Quick Fix (Temporary)

If you need it working immediately:

1. Share links using backend URL directly:
   ```
   https://YOUR-BACKEND-URL.onrender.com/portal/timedox
   ```
   This will work for WhatsApp previews, but redirects browsers to frontend.

2. Update your sharing code to use backend URL for social media:
   ```javascript
   const shareUrl = process.env.REACT_APP_BACKEND_URL 
     ? `${process.env.REACT_APP_BACKEND_URL}/portal/${slug}`
     : `${window.location.origin}/portal/${slug}`;
   ```

## Final Checklist

- [ ] Backend route `/portal/{slug}` is deployed and working
- [ ] Backend URL is accessible
- [ ] Frontend `_redirects` file updated (if using Option A)
- [ ] OR `portal.html` created (if using Option B)
- [ ] `render.yaml` updated with backend URL env var
- [ ] Tested backend route directly with crawler User-Agent
- [ ] Tested in WhatsApp link preview
- [ ] Verified workspace logo appears in preview
- [ ] Verified title shows "InterGuide – {Workspace Name}"

## Troubleshooting

### Issue: Preview still shows InterGuide logo
- Check backend logs for `[share_portal]` entries
- Verify workspace has logo in database
- Test backend route directly: `curl -A "WhatsApp/2.0" https://BACKEND-URL/portal/SLUG`

### Issue: Preview shows wrong title
- Check backend logs for workspace name
- Verify workspace slug is correct
- Test backend route directly

### Issue: Redirects don't work
- Check `_redirects` file syntax
- Verify backend URL is correct
- Check Render deployment logs

## Need Help?

If still not working:
1. Check backend logs in Render dashboard
2. Test backend route directly with crawler User-Agent
3. Verify workspace has logo uploaded
4. Check CORS settings if getting errors
