# WhatsApp Preview Fix - Exact Steps for Render

## Current Situation
- ✅ Backend route `/portal/{slug}` is implemented and working
- ✅ Backend detects crawlers and returns OG HTML
- ❌ Frontend static site can't proxy `/portal/*` to backend
- ❌ WhatsApp crawlers hit frontend, get `index.html` (no OG tags)

## Solution: Two Options

---

## OPTION 1: Quick Fix - Use Backend URL for Sharing (5 minutes)

**Best if:** You want it working immediately and don't mind backend URL in shared links.

### Steps:

1. **Get your backend URL:**
   - Go to https://dashboard.render.com
   - Click `guide2026-backend` service
   - Copy the URL (e.g., `https://guide2026-backend-xxxx.onrender.com`)

2. **Update sharing code** in `frontend/src/pages/PortalPage.js`:

   Find where share links are generated (around line 597) and update:

   ```javascript
   // OLD CODE (if exists):
   const walkthroughUrl = `${window.location.origin}/portal/${workspaceSlug}/${walkthrough.id}`;

   // NEW CODE:
   const getBackendUrl = () => {
     const apiUrl = process.env.REACT_APP_API_URL || 
                    process.env.REACT_APP_BACKEND_URL;
     if (apiUrl) {
       return apiUrl.replace(/\/api$/, ''); // Remove /api suffix
     }
     return 'https://guide2026-backend-xxxx.onrender.com'; // Replace with your backend URL
   };

   const walkthroughUrl = `${getBackendUrl()}/portal/${workspaceSlug}/${walkthrough.id}`;
   ```

3. **For portal sharing**, update any portal share buttons:

   ```javascript
   const portalShareUrl = `${getBackendUrl()}/portal/${slug}`;
   ```

4. **Deploy and test:**
   - Push changes
   - Share link in WhatsApp
   - Preview should show workspace logo and title ✅

**✅ Done!** Links will be: `https://BACKEND-URL/portal/timedox`

---

## OPTION 2: Custom Domain Setup with Cloudflare (30 minutes)

**Best if:** You want URLs to show `interguide.app/portal/timedox`

### Prerequisites:
- Domain `interguide.app` registered
- Willing to use Cloudflare (free)

### Steps:

#### Step 1: Set Up Cloudflare (10 min)

1. **Create Cloudflare account:**
   - Go to https://dash.cloudflare.com/sign-up
   - Sign up (free)

2. **Add domain:**
   - Click "Add a site"
   - Enter `interguide.app`
   - Choose Free plan
   - Cloudflare will show nameservers

3. **Update nameservers:**
   - Go to your domain registrar (where you bought `interguide.app`)
   - Update nameservers to Cloudflare's (shown in Cloudflare dashboard)
   - Wait 5-60 minutes for DNS propagation

#### Step 2: Configure DNS (5 min)

In Cloudflare dashboard → DNS → Records:

1. **Add CNAME for frontend:**
   ```
   Type: CNAME
   Name: www
   Target: guide2026-frontend.onrender.com
   Proxy: ✅ Proxied (orange cloud)
   ```

2. **Add CNAME for root (if needed):**
   ```
   Type: CNAME
   Name: @
   Target: guide2026-frontend.onrender.com
   Proxy: ✅ Proxied
   ```

#### Step 3: Create Cloudflare Worker (10 min)

1. **Create Worker:**
   - Cloudflare Dashboard → Workers & Pages → Create Worker
   - Name: `portal-router`
   - Click "Deploy"

2. **Add Worker code:**
   Replace default code with:

   ```javascript
   export default {
     async fetch(request, env) {
       const url = new URL(request.url);
      const path = url.pathname;
      
      // Route /portal/* to backend
      if (path.startsWith('/portal/')) {
        const backendUrl = 'https://guide2026-backend-xxxx.onrender.com'; // REPLACE WITH YOUR BACKEND URL
        const backendRequest = new Request(`${backendUrl}${path}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        return fetch(backendRequest);
      }
      
      // All other routes go to frontend
      const frontendUrl = 'https://guide2026-frontend.onrender.com'; // REPLACE WITH YOUR FRONTEND URL
      const frontendRequest = new Request(`${frontendUrl}${path}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return fetch(frontendRequest);
     }
   }
   ```

   **⚠️ Replace both URLs with your actual Render service URLs!**

3. **Configure Worker route:**
   - Worker settings → Triggers → Add route
   - Route: `interguide.app/portal/*`
   - Zone: Select `interguide.app`
   - Save

#### Step 4: Update Backend CORS (2 min)

1. Render Dashboard → `guide2026-backend` → Environment
2. Update `CORS_ORIGINS`:
   ```
   https://www.interguide.app,https://interguide.app,https://guide2026-frontend.onrender.com,http://localhost:3000
   ```
3. Save (auto-redeploys)

#### Step 5: Test (3 min)

1. **Test backend directly:**
   ```bash
   curl -A "WhatsApp/2.0" https://YOUR-BACKEND-URL.onrender.com/portal/timedox
   ```
   Should return HTML with OG tags.

2. **Test through custom domain:**
   ```bash
   curl -A "WhatsApp/2.0" https://www.interguide.app/portal/timedox
   ```
   Should also return HTML (routed through Cloudflare to backend).

3. **Test in browser:**
   - Open `https://www.interguide.app/portal/timedox`
   - Should show portal page

4. **Test WhatsApp:**
   - Share: `https://www.interguide.app/portal/timedox`
   - Preview should show workspace logo and title ✅

**✅ Done!** URLs show `interguide.app` and WhatsApp previews work!

---

## Which Option Should You Choose?

| Option | Time | Complexity | URL Shows |
|--------|------|------------|-----------|
| Option 1 | 5 min | Easy | Backend domain |
| Option 2 | 30 min | Medium | Custom domain |

**Recommendation:** Start with Option 1 to get it working, then upgrade to Option 2 if needed.

---

## Troubleshooting

### Backend route not working?
- Check backend logs in Render dashboard
- Test: `curl -A "WhatsApp/2.0" https://BACKEND-URL/portal/SLUG`
- Verify workspace exists and has logo

### Cloudflare Worker not routing?
- Check Worker logs in Cloudflare dashboard
- Verify route is: `interguide.app/portal/*`
- Test Worker directly: `https://portal-router.YOUR-SUBDOMAIN.workers.dev/portal/timedox`

### CORS errors?
- Update backend `CORS_ORIGINS` to include `https://www.interguide.app`
- Redeploy backend

### Preview still wrong?
- Clear WhatsApp cache (delete and re-share link)
- Wait 5-10 minutes for cache to expire
- Test backend route directly first

---

## Quick Checklist

**Option 1 (Quick):**
- [ ] Got backend URL
- [ ] Updated sharing code
- [ ] Deployed frontend
- [ ] Tested WhatsApp preview

**Option 2 (Custom Domain):**
- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated
- [ ] DNS records configured
- [ ] Cloudflare Worker created
- [ ] Worker route configured
- [ ] Backend CORS updated
- [ ] Tested and working

---

## Need Help?

1. Check backend logs: Render Dashboard → Backend → Logs
2. Check Worker logs: Cloudflare Dashboard → Workers → Logs
3. Test backend directly with curl
4. Verify workspace has logo in database
