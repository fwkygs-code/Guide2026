# Complete WhatsApp Preview Setup for Render - Step by Step

## Your Setup
- **Frontend**: Static site on Render (`guide2026-frontend`)
- **Backend**: Python/FastAPI on Render (`guide2026-backend`)
- **Custom Domain**: `interguide.app` (or `www.interguide.app`)

## Problem
WhatsApp crawlers access `https://www.interguide.app/portal/timedox`, but your frontend static site serves `index.html` for all routes. Crawlers don't execute JavaScript, so they can't see the OG tags.

## Solution: Use Cloudflare Workers (Free) to Route Portal Requests

Since Render static sites can't proxy, we'll use Cloudflare Workers to route `/portal/*` requests to your backend.

---

## Step 1: Verify Backend Route is Working ✅

1. Go to https://dashboard.render.com
2. Click on **`guide2026-backend`** service
3. Copy the service URL (e.g., `https://guide2026-backend-xxxx.onrender.com`)
4. Test the backend route:
   ```bash
   curl -A "WhatsApp/2.0" https://YOUR-BACKEND-URL.onrender.com/portal/timedox
   ```
   Should return HTML with OG tags.

**✅ Backend route is already implemented and working!**

---

## Step 2: Set Up Cloudflare (Free Account)

### 2.1 Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up for a free account
3. Verify your email

### 2.2 Add Your Domain to Cloudflare
1. In Cloudflare dashboard, click **"Add a site"**
2. Enter `interguide.app` (or `www.interguide.app`)
3. Choose **Free** plan
4. Cloudflare will scan your DNS records
5. **Important**: Update your nameservers at your domain registrar to point to Cloudflare's nameservers
   - Cloudflare will show you the nameservers (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
   - Go to your domain registrar (where you bought `interguide.app`)
   - Update nameservers to Cloudflare's nameservers
   - Wait for DNS propagation (5-60 minutes)

### 2.3 Configure DNS Records
1. In Cloudflare dashboard → **DNS** → **Records**
2. Add/update these records:

   **For Frontend (Static Site):**
   ```
   Type: CNAME
   Name: www (or @ for root domain)
   Target: guide2026-frontend.onrender.com
   Proxy: ✅ Proxied (orange cloud)
   ```

   **For Backend API:**
   ```
   Type: CNAME
   Name: api
   Target: guide2026-backend-xxxx.onrender.com
   Proxy: ✅ Proxied (orange cloud)
   ```

---

## Step 3: Create Cloudflare Worker to Route Portal Requests

### 3.1 Create Worker
1. In Cloudflare dashboard, go to **Workers & Pages**
2. Click **"Create application"** → **"Create Worker"**
3. Name it: `portal-router` (or any name)
4. Click **"Deploy"**

### 3.2 Add Worker Code
Replace the default code with:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Check if it's a portal route
    if (path.startsWith('/portal/')) {
      // Extract slug from path
      const slug = path.split('/portal/')[1]?.split('/')[0];
      
      if (slug) {
        // Get backend URL from environment variable or hardcode it
        const backendUrl = env.BACKEND_URL || 'https://guide2026-backend-xxxx.onrender.com';
        
        // Forward request to backend
        const backendRequest = new Request(`${backendUrl}${path}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        
        return fetch(backendRequest);
      }
    }
    
    // For all other routes, forward to frontend
    const frontendUrl = env.FRONTEND_URL || 'https://guide2026-frontend.onrender.com';
    const frontendRequest = new Request(`${frontendUrl}${path}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return fetch(frontendRequest);
  }
}
```

**⚠️ Replace `guide2026-backend-xxxx.onrender.com` with your actual backend URL!**

### 3.3 Add Environment Variables
1. In Worker settings, go to **"Variables"** tab
2. Add environment variable:
   - **Variable**: `BACKEND_URL`
   - **Value**: `https://guide2026-backend-xxxx.onrender.com` (your backend URL)
3. Add another:
   - **Variable**: `FRONTEND_URL`
   - **Value**: `https://guide2026-frontend.onrender.com` (your frontend URL)

### 3.4 Configure Worker Route
1. Go to **"Triggers"** tab in Worker settings
2. Click **"Add route"**
3. Configure:
   - **Route**: `interguide.app/portal/*` (or `www.interguide.app/portal/*`)
   - **Zone**: Select your domain
4. Click **"Save"**

---

## Step 4: Update Render Configuration

### 4.1 Update Backend CORS
1. Go to Render dashboard → **`guide2026-backend`** → **Environment**
2. Update `CORS_ORIGINS` to include your custom domain:
   ```
   https://www.interguide.app,https://interguide.app,https://guide2026-frontend.onrender.com,http://localhost:3000
   ```

### 4.2 Update Frontend Environment Variables
1. Go to Render dashboard → **`guide2026-frontend`** → **Environment**
2. Verify `REACT_APP_API_URL` is set (should be auto-set from `render.yaml`)

---

## Step 5: Test the Setup

### 5.1 Test Backend Route Directly
```bash
curl -A "WhatsApp/2.0" https://YOUR-BACKEND-URL.onrender.com/portal/timedox
```
Should return HTML with OG tags.

### 5.2 Test Through Custom Domain
```bash
curl -A "WhatsApp/2.0" https://www.interguide.app/portal/timedox
```
Should also return HTML with OG tags (routed through Cloudflare Worker to backend).

### 5.3 Test in Browser
1. Open `https://www.interguide.app/portal/timedox` in browser
2. Should redirect to frontend and show portal page

### 5.4 Test WhatsApp Preview
1. Open WhatsApp
2. Share link: `https://www.interguide.app/portal/timedox`
3. Check preview:
   - ✅ Shows workspace logo (not InterGuide logo)
   - ✅ Shows "InterGuide – {Workspace Name}" as title
   - ✅ Shows workspace description

---

## Alternative: Simpler Solution (If Cloudflare is Too Complex)

If Cloudflare setup is too complex, use this simpler approach:

### Option A: Share Backend URL Directly
Update your sharing code to use backend URL for social media:

```javascript
// In your sharing component
const getShareUrl = (slug) => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 
                     process.env.REACT_APP_API_URL?.replace('/api', '') ||
                     'https://guide2026-backend-xxxx.onrender.com';
  
  // For social media (WhatsApp, etc.), use backend URL
  // Backend will redirect browsers to frontend
  return `${backendUrl}/portal/${slug}`;
};
```

Then share: `https://YOUR-BACKEND-URL.onrender.com/portal/timedox`

**Pros**: Simple, works immediately  
**Cons**: URL shows backend domain, not custom domain

### Option B: Use Render Service Mesh (If Available)
If Render supports service mesh/routing:
1. Configure custom domain in Render
2. Set up routing rules to send `/portal/*` to backend
3. All other routes go to frontend

---

## Troubleshooting

### Issue: Worker Not Routing Correctly
- Check Worker logs in Cloudflare dashboard
- Verify route is configured: `interguide.app/portal/*`
- Test Worker directly: `https://portal-router.YOUR-SUBDOMAIN.workers.dev/portal/timedox`

### Issue: CORS Errors
- Update backend `CORS_ORIGINS` to include `https://www.interguide.app`
- Redeploy backend after updating environment variables

### Issue: Preview Still Shows InterGuide Logo
- Check backend logs for `[share_portal]` entries
- Verify workspace has logo in database
- Test backend route directly with crawler User-Agent

### Issue: 404 Errors
- Verify backend route `/portal/{slug}` is deployed
- Check backend logs in Render dashboard
- Verify workspace slug exists in database

---

## Final Checklist

- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at domain registrar
- [ ] DNS records configured (CNAME for frontend)
- [ ] Cloudflare Worker created
- [ ] Worker code added with backend URL
- [ ] Worker route configured: `interguide.app/portal/*`
- [ ] Backend CORS updated to include custom domain
- [ ] Backend route tested directly
- [ ] Portal route tested through custom domain
- [ ] WhatsApp preview tested and working
- [ ] Workspace logo appears in preview
- [ ] Title shows "InterGuide – {Workspace Name}"

---

## Quick Reference

### Backend Route
- **URL**: `https://YOUR-BACKEND-URL.onrender.com/portal/{slug}`
- **Handles**: Crawlers (returns HTML) and browsers (redirects to frontend)

### Frontend Route
- **URL**: `https://www.interguide.app/portal/{slug}`
- **Handles**: Browsers (serves React app)

### Cloudflare Worker
- **Routes**: `/portal/*` → Backend
- **Routes**: Everything else → Frontend

---

## Need Help?

1. **Check Cloudflare Worker Logs**: Dashboard → Workers → Your Worker → Logs
2. **Check Backend Logs**: Render Dashboard → Backend Service → Logs
3. **Test Backend Directly**: Use curl with WhatsApp User-Agent
4. **Verify DNS**: Use `dig interguide.app` or `nslookup interguide.app`
