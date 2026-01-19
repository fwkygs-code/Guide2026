# Simple WhatsApp Preview Solution for Render

## The Simplest Approach (Recommended)

Since Render static sites can't proxy requests, the **simplest solution** is to:

### Option 1: Share Backend URL Directly (Easiest)

Update your sharing code to use the backend URL for social media links. The backend route already handles:
- ✅ Crawlers: Returns HTML with OG tags
- ✅ Browsers: Redirects to frontend SPA

**Implementation:**

1. **Find your backend URL:**
   - Go to Render dashboard → `guide2026-backend` service
   - Copy the service URL (e.g., `https://guide2026-backend-xxxx.onrender.com`)

2. **Update sharing code** to use backend URL:

   In `frontend/src/pages/PortalPage.js` or wherever you generate share links:

   ```javascript
   // Get backend URL from environment
   const getBackendUrl = () => {
     const apiUrl = process.env.REACT_APP_API_URL || 
                    process.env.REACT_APP_BACKEND_URL;
     if (apiUrl) {
       // Remove /api suffix if present
       return apiUrl.replace(/\/api$/, '');
     }
     return 'https://guide2026-backend-xxxx.onrender.com'; // Fallback
   };

   // Use backend URL for sharing
   const shareUrl = `${getBackendUrl()}/portal/${slug}`;
   ```

3. **When users share portal links**, they'll share:
   ```
   https://guide2026-backend-xxxx.onrender.com/portal/timedox
   ```

4. **WhatsApp crawler** hits backend → Gets OG HTML ✅
5. **Browser user** clicks link → Backend redirects to frontend ✅

**Pros:**
- ✅ Works immediately
- ✅ No additional setup needed
- ✅ Backend already handles everything

**Cons:**
- ⚠️ URL shows backend domain (not `interguide.app`)

---

### Option 2: Use Custom Domain with Cloudflare (Best UX)

If you want URLs to show `interguide.app`, use Cloudflare Workers (see `RENDER_WHATSAPP_SETUP_COMPLETE.md`).

---

## Quick Implementation Steps

### Step 1: Get Backend URL
1. Render Dashboard → `guide2026-backend` → Copy URL

### Step 2: Update Sharing Code
Update your portal sharing component to use backend URL.

### Step 3: Test
1. Share link: `https://BACKEND-URL/portal/timedox`
2. Check WhatsApp preview
3. Click link → Should redirect to frontend

---

## Which Option to Choose?

- **Need it working NOW?** → Use Option 1 (Backend URL)
- **Want custom domain in URLs?** → Use Option 2 (Cloudflare)

Both work! Option 1 is faster to implement.
