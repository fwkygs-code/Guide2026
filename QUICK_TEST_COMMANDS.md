# Quick Test - Backend Route Directly

## The Problem
You're seeing frontend `index.html` because you tested through `interguide.app` which goes to the frontend static site.

## Solution: Test Backend URL Directly

### Step 1: Open PowerShell
Press `Windows Key + X` → Select "PowerShell"

### Step 2: Test Backend Route Directly
Run this command (replace `timedox` with your workspace slug):

```powershell
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox
```

**Important:** Use `guide2026-backend.onrender.com` NOT `interguide.app`

### Step 3: What You Should See
You should see HTML like this (NOT the frontend index.html):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta property="og:title" content="InterGuide – Timedox">
    <meta property="og:description" content="InterGuide – Timedox">
    <meta property="og:image" content="https://res.cloudinary.com/.../logo.png">
    <meta property="og:image:secure_url" content="https://res.cloudinary.com/.../logo.png">
    ...
</head>
<body>
    <h1>InterGuide – Timedox</h1>
</body>
</html>
```

### Step 4: Save to File (Easier to Read)
```powershell
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox -o backend-response.html
notepad backend-response.html
```

---

## Why You Got Frontend HTML

- ❌ `https://www.interguide.app/portal/timedox` → Goes to **frontend** → Returns `index.html`
- ✅ `https://guide2026-backend.onrender.com/portal/timedox` → Goes to **backend** → Returns OG HTML

---

## For WhatsApp to Work

**Option 1 (Current):** Share backend URL directly
```
https://guide2026-backend.onrender.com/portal/timedox
```
✅ Works immediately
⚠️ Shows backend domain in URL

**Option 2 (Future):** Set up Cloudflare Worker
- Routes `interguide.app/portal/*` → Backend
- URLs show `interguide.app`
- Requires Cloudflare setup (see WHATSAPP_PREVIEW_FIX_STEPS.md)

---

## Test Checklist

- [ ] Tested: `https://guide2026-backend.onrender.com/portal/timedox`
- [ ] Used User-Agent: `WhatsApp/2.0`
- [ ] Got HTML response (not frontend index.html)
- [ ] HTML contains `<meta property="og:title">`
- [ ] HTML contains `<meta property="og:image">` with workspace logo
- [ ] Title shows "InterGuide – {Workspace Name}"

---

## If You Still Get Frontend HTML

1. **Check backend is deployed:**
   - Render Dashboard → `guide2026-backend` → Check status is "Live"

2. **Check backend logs:**
   - Render Dashboard → `guide2026-backend` → Logs
   - Look for `[share_portal]` entries

3. **Verify URL:**
   - Make sure you're using: `guide2026-backend.onrender.com`
   - NOT: `interguide.app` or `guide2026-frontend.onrender.com`
