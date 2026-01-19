# How to Test Backend Route Directly - Exact Steps

## Method 1: Using PowerShell (Windows) - Recommended

### Step 1: Open PowerShell
- Press `Windows Key + X`
- Select "Windows PowerShell" or "Terminal"

### Step 2: Test with WhatsApp User-Agent
Run this command (replace `timedox` with your actual workspace slug):

```powershell
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox
```

**What this does:**
- `curl.exe` - Windows curl command
- `-A "WhatsApp/2.0"` - Sets User-Agent header to simulate WhatsApp crawler
- `https://guide2026-backend.onrender.com/portal/timedox` - Your backend route

### Step 3: Check the Output
You should see HTML output like this:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta property="og:title" content="InterGuide – Your Workspace Name">
    <meta property="og:image" content="https://res.cloudinary.com/.../workspace-logo.png">
    ...
</head>
```

### Step 4: Verify OG Tags
Look for these in the output:
- ✅ `<meta property="og:title" content="InterGuide – {Workspace Name}">`
- ✅ `<meta property="og:image" content="...">` (should be workspace logo URL)
- ✅ `<meta property="og:image:secure_url" content="...">`

---

## Method 2: Using Browser with User-Agent Switcher

### Step 1: Install Browser Extension
- **Chrome**: Install "User-Agent Switcher and Manager"
- **Firefox**: Install "User-Agent Switcher"

### Step 2: Set User-Agent to WhatsApp
1. Click the extension icon
2. Select "WhatsApp" or "Custom"
3. Enter: `WhatsApp/2.0`

### Step 3: Visit the URL
Open in browser:
```
https://guide2026-backend.onrender.com/portal/timedox
```

### Step 4: View Page Source
- Right-click → "View Page Source" (or `Ctrl+U`)
- Look for `<meta property="og:...">` tags

---

## Method 3: Using Online Tools

### Option A: WhatsApp Link Preview Debugger
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter URL: `https://guide2026-backend.onrender.com/portal/timedox`
3. Click "Debug"
4. Check preview shows workspace logo and title

### Option B: curl Online
1. Go to: https://reqbin.com/curl
2. Enter:
   - URL: `https://guide2026-backend.onrender.com/portal/timedox`
   - Headers: `User-Agent: WhatsApp/2.0`
3. Click "Send"
4. Check response contains OG tags

---

## Expected Results

### ✅ Success - You Should See:

**HTML Response with:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta property="og:title" content="InterGuide – Timedox">
    <meta property="og:description" content="InterGuide – Timedox">
    <meta property="og:image" content="https://res.cloudinary.com/.../logo.png">
    <meta property="og:image:secure_url" content="https://res.cloudinary.com/.../logo.png">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://guide2026-backend.onrender.com/portal/timedox">
</head>
<body>
    <h1>InterGuide – Timedox</h1>
    <p>InterGuide – Timedox</p>
</body>
</html>
```

### ❌ Failure - If You See:

**404 Error:**
```
{"detail": "Portal not found"}
```
→ Check workspace slug exists in database

**Redirect (302):**
→ This means it detected you as a browser, not crawler
→ Try with `-A "WhatsApp/2.0"` header

**Empty Response:**
→ Check backend logs in Render dashboard

---

## Quick Test Commands

### Test 1: Check if route exists
```powershell
curl.exe https://guide2026-backend.onrender.com/portal/timedox
```
Should redirect (302) or return HTML

### Test 2: Test as WhatsApp crawler
```powershell
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox
```
Should return HTML with OG tags

### Test 3: Test as browser (should redirect)
```powershell
curl.exe -A "Mozilla/5.0" https://guide2026-backend.onrender.com/portal/timedox
```
Should redirect to frontend URL

### Test 4: Save response to file (easier to read)
```powershell
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox -o response.html
```
Then open `response.html` in browser to see formatted HTML

---

## Troubleshooting

### Issue: "curl is not recognized"
**Solution:** Use full path or install curl:
```powershell
# Try this instead:
Invoke-WebRequest -Uri "https://guide2026-backend.onrender.com/portal/timedox" -Headers @{"User-Agent"="WhatsApp/2.0"} | Select-Object -ExpandProperty Content
```

### Issue: Getting 404
**Check:**
1. Workspace slug exists: `timedox`
2. Backend is deployed and running
3. Check Render dashboard → Backend → Logs

### Issue: Getting redirect instead of HTML
**Solution:** Make sure you're using `-A "WhatsApp/2.0"` header

### Issue: OG image URL is wrong
**Check:**
1. Workspace has logo uploaded
2. Logo URL in database is correct Cloudinary URL
3. Check backend logs for `[share_portal]` entries

---

## Verify in Render Logs

1. Go to: https://dashboard.render.com
2. Click `guide2026-backend` service
3. Click "Logs" tab
4. Look for entries like:
   ```
   [share_portal] Portal 'timedox': logo value from DB = 'https://res.cloudinary.com/...'
   [share_portal] Using workspace logo: https://res.cloudinary.com/...
   [share_portal] Returning OG HTML for crawler 'timedox'
   ```

---

## Test Checklist

- [ ] Backend URL is correct: `https://guide2026-backend.onrender.com`
- [ ] Workspace slug exists: `timedox` (or your actual slug)
- [ ] Used WhatsApp User-Agent: `-A "WhatsApp/2.0"`
- [ ] Response contains HTML (not JSON)
- [ ] OG tags are present in HTML
- [ ] `og:title` shows "InterGuide – {Workspace Name}"
- [ ] `og:image` shows workspace logo URL (or fallback)
- [ ] Backend logs show `[share_portal]` entries

---

## Example: Complete Test Session

```powershell
# 1. Test backend is accessible
curl.exe https://guide2026-backend.onrender.com/health

# 2. Test portal route as WhatsApp
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox

# 3. Save response to file for easier reading
curl.exe -A "WhatsApp/2.0" https://guide2026-backend.onrender.com/portal/timedox -o test-response.html

# 4. Open the file
notepad test-response.html
```

---

## What to Look For

### ✅ Good Response:
- HTML document (starts with `<!DOCTYPE html>`)
- Contains `<meta property="og:title">` with workspace name
- Contains `<meta property="og:image">` with Cloudinary URL
- Status code: 200

### ❌ Bad Response:
- JSON error: `{"detail": "..."}`
- 404 Not Found
- Empty response
- Wrong logo URL

---

## Next Steps After Testing

1. **If test passes:** ✅ Share link in WhatsApp and verify preview
2. **If test fails:** Check backend logs and verify workspace exists
3. **If logo missing:** Upload logo in Settings → Branding
