# Cloudflare Worker Setup - Exact Steps for interguide.app

## Goal
Route `interguide.app/portal/*` requests to backend so WhatsApp crawlers get OG HTML.

## Prerequisites
- Domain `interguide.app` registered
- Cloudflare account (free)

---

## Step 1: Add Domain to Cloudflare (5 minutes)

### 1.1 Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free account is fine)
3. Verify email

### 1.2 Add Your Domain
1. In Cloudflare dashboard, click **"Add a site"**
2. Enter: `interguide.app`
3. Choose **Free** plan
4. Click **"Continue"**

### 1.3 Update Nameservers
1. Cloudflare will show you **2 nameservers** (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
2. **Copy these nameservers**
3. Go to your domain registrar (where you bought `interguide.app`)
4. Find DNS/Nameserver settings
5. **Replace existing nameservers** with Cloudflare's nameservers
6. Save changes
7. **Wait 5-60 minutes** for DNS propagation

**Important:** Until nameservers are updated, Cloudflare won't work!

---

## Step 2: Configure DNS Records (5 minutes)

Once nameservers are updated:

1. In Cloudflare dashboard → **DNS** → **Records**

2. **Add/Update CNAME for www:**
   ```
   Type: CNAME
   Name: www
   Target: guide2026-frontend.onrender.com
   Proxy: ✅ Proxied (orange cloud icon)
   TTL: Auto
   ```

3. **Add/Update CNAME for root (@):**
   ```
   Type: CNAME
   Name: @
   Target: guide2026-frontend.onrender.com
   Proxy: ✅ Proxied (orange cloud icon)
   TTL: Auto
   ```

4. **Save all records**

---

## Step 3: Create Cloudflare Worker (10 minutes)

### 3.1 Create Worker
1. In Cloudflare dashboard, go to **Workers & Pages**
2. Click **"Create application"**
3. Click **"Create Worker"**
4. Name it: `portal-router` (or any name)
5. Click **"Deploy"**

### 3.2 Add Worker Code
1. In the Worker editor, **delete all existing code**
2. **Paste this code** (replace backend URL with yours):

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route /portal/* requests to backend
    if (path.startsWith('/portal/')) {
      // Extract slug from path
      const slug = path.split('/portal/')[1]?.split('/')[0];
      
      if (slug) {
        // Backend URL - REPLACE WITH YOUR ACTUAL BACKEND URL
        const backendUrl = 'https://guide2026-backend.onrender.com';
        
        // Forward entire request to backend (preserve query params, headers, etc.)
        const backendRequest = new Request(`${backendUrl}${path}${url.search}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        
        // Forward response from backend
        return fetch(backendRequest);
      }
    }
    
    // All other routes go to frontend
    const frontendUrl = 'https://guide2026-frontend.onrender.com';
    const frontendRequest = new Request(`${frontendUrl}${path}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return fetch(frontendRequest);
  }
}
```

**⚠️ IMPORTANT:** Replace `guide2026-backend.onrender.com` with your actual backend URL if different!

3. Click **"Save and deploy"**

### 3.3 Configure Worker Route
1. In Worker settings, go to **"Triggers"** tab
2. Click **"Add route"**
3. Configure:
   - **Route**: `interguide.app/portal/*`
   - **Zone**: Select `interguide.app` from dropdown
4. Click **"Save"**

**Important:** Also add route for `www.interguide.app/portal/*`:
- Click **"Add route"** again
- Route: `www.interguide.app/portal/*`
- Zone: `interguide.app`
- Save

---

## Step 4: Update Backend CORS (2 minutes)

1. Go to Render dashboard: https://dashboard.render.com
2. Click **`guide2026-backend`** service
3. Go to **"Environment"** tab
4. Find `CORS_ORIGINS` variable
5. Update it to include your custom domain:
   ```
   https://www.interguide.app,https://interguide.app,https://guide2026-frontend.onrender.com,http://localhost:3000
   ```
6. Save (auto-redeploys)

---

## Step 5: Test (5 minutes)

### Test 1: Check Worker Route
```powershell
curl.exe -k -A "WhatsApp/2.0" https://www.interguide.app/portal/timedox
```

Should return HTML with OG tags (same as backend test).

### Test 2: Check Browser Redirect
Open in browser: `https://www.interguide.app/portal/timedox`
- Should show portal page (not redirect)

### Test 3: Test WhatsApp Preview
1. Share link: `https://www.interguide.app/portal/timedox`
2. Preview should show:
   - ✅ Workspace logo
   - ✅ Title: "InterGuide – Timedox"

---

## Troubleshooting

### Issue: Worker not routing
- Check Worker logs: Cloudflare Dashboard → Workers → portal-router → Logs
- Verify route is: `interguide.app/portal/*`
- Test Worker directly: `https://portal-router.YOUR-SUBDOMAIN.workers.dev/portal/timedox`

### Issue: Still getting frontend HTML
- Check nameservers are updated (wait up to 60 minutes)
- Verify Worker route is active
- Check Worker logs for errors

### Issue: CORS errors
- Update backend `CORS_ORIGINS` to include `https://www.interguide.app`
- Redeploy backend

### Issue: 404 errors
- Verify backend route is deployed
- Check backend logs in Render dashboard
- Test backend directly first

---

## Quick Checklist

- [ ] Cloudflare account created
- [ ] Domain `interguide.app` added to Cloudflare
- [ ] Nameservers updated at domain registrar
- [ ] DNS records configured (CNAME for www and @)
- [ ] Cloudflare Worker created
- [ ] Worker code added with backend URL
- [ ] Worker routes configured: `interguide.app/portal/*` and `www.interguide.app/portal/*`
- [ ] Backend CORS updated to include custom domain
- [ ] Tested with curl (WhatsApp User-Agent)
- [ ] Tested in browser
- [ ] Tested WhatsApp preview

---

## Expected Flow

1. **WhatsApp crawler** accesses: `https://www.interguide.app/portal/timedox`
2. **Cloudflare Worker** intercepts `/portal/*` route
3. **Worker forwards** to: `https://guide2026-backend.onrender.com/portal/timedox`
4. **Backend** detects crawler → Returns HTML with OG tags ✅
5. **WhatsApp** displays preview with workspace logo and title ✅

6. **Browser user** accesses: `https://www.interguide.app/portal/timedox`
7. **Cloudflare Worker** intercepts `/portal/*` route
8. **Worker forwards** to: `https://guide2026-backend.onrender.com/portal/timedox`
9. **Backend** detects browser → Redirects to: `https://guide2026-frontend.onrender.com/portal/timedox`
10. **Frontend** serves React app ✅

---

## Need Help?

1. **Check Cloudflare Worker Logs**: Dashboard → Workers → portal-router → Logs
2. **Check Backend Logs**: Render Dashboard → Backend → Logs
3. **Test Backend Directly**: `curl -k -A "WhatsApp/2.0" https://BACKEND-URL/portal/timedox`
4. **Verify DNS**: Use `nslookup interguide.app` or `dig interguide.app`
