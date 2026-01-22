# Embed Block Usage Guide

**Issue:** YouTube embed not working  
**Cause:** Using homepage URL instead of video URL

---

## ✅ How to Use Embed Block Correctly

### YouTube Embeds

#### ✅ CORRECT URLs (specific videos):
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/embed/dQw4w9WgXcQ
```

#### ❌ WRONG URLs (will fail):
```
https://www.youtube.com/          ← Homepage (blocked by YouTube)
https://www.youtube.com/feed      ← Feed page (blocked)
https://www.youtube.com/trending  ← Trending page (blocked)
```

**Error you'll see:**
```
Refused to display 'https://www.youtube.com/' in a frame 
because it set 'X-Frame-Options' to 'sameorigin'.
```

**Why:** YouTube only allows embedding individual videos, not their main pages.

---

### How to Get a YouTube Video URL

1. **Go to YouTube** (youtube.com)
2. **Search for a video** (or go to your video)
3. **Click on the video** to open it
4. **Copy the URL** from the address bar
   - It should contain `watch?v=` or `youtu.be/`
5. **Paste in Embed block**

**Example:**
```
🎥 Video you want: "Never Gonna Give You Up"
✅ URL to copy: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

---

## All Supported Embed Providers

### 1. YouTube
**Format:** `https://www.youtube.com/watch?v=VIDEO_ID`  
**Example:** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`  
**Auto-converts to:** `https://www.youtube.com/embed/VIDEO_ID`

### 2. Vimeo
**Format:** `https://vimeo.com/VIDEO_ID`  
**Example:** `https://vimeo.com/123456789`  
**Auto-converts to:** `https://player.vimeo.com/video/VIDEO_ID`

### 3. Loom
**Format:** `https://www.loom.com/share/VIDEO_ID`  
**Example:** `https://www.loom.com/share/abc123def456`  
**Auto-converts to:** `https://www.loom.com/embed/VIDEO_ID`

### 4. Figma
**Format:** Any Figma file URL  
**Example:** `https://www.figma.com/file/ABC123/Design`  
**Auto-converts to:** Figma embed viewer

### 5. Google Docs
**Formats:**
- Documents: `https://docs.google.com/document/d/DOC_ID/edit`
- Presentations: `https://docs.google.com/presentation/d/DOC_ID/edit`
- Spreadsheets: `https://docs.google.com/spreadsheets/d/DOC_ID/edit`

**Auto-converts to:** Google preview/embed format

### 6. NotebookLM
**Format:** NotebookLM share URL  
**Note:** Use the shareable link from NotebookLM

### 7. Gemini
**Format:** Gemini conversation share URL  
**Note:** Use the shareable link from Gemini

---

## 🔧 Troubleshooting Embed Issues

### Issue: "Refused to display in a frame"

**Causes:**
1. ❌ Using homepage/main page URL instead of specific content
2. ❌ Content owner disabled embedding
3. ❌ Private/restricted content

**Solutions:**
1. ✅ Use specific video/file URL (not homepage)
2. ✅ Make sure content is public
3. ✅ Check if content allows embedding

---

### Issue: Embed shows blank/empty

**Causes:**
1. ❌ Invalid URL format
2. ❌ Content has been deleted
3. ❌ Network/loading issue

**Solutions:**
1. ✅ Copy URL directly from address bar
2. ✅ Test URL in new browser tab first
3. ✅ Wait a few seconds for loading

---

### Issue: "Content Security Policy" error

**Cause:** Some websites block embedding for security

**Solution:** 
- Use official embed URLs when available
- For YouTube: URL must include video ID
- For Google Docs: Must be set to "Anyone with link can view"

---

## 📝 Step-by-Step: Embedding YouTube Video

1. **Add Embed Block**
   - Click "+ Add block" button
   - Select "📺 Embed"

2. **Select Provider**
   - Dropdown should show "YouTube" (default)
   - Keep it selected

3. **Get Video URL**
   - Open YouTube in new tab
   - Find video you want
   - Click to play it
   - Copy URL from address bar
   - Should look like: `https://www.youtube.com/watch?v=...`

4. **Paste URL**
   - Paste into "Paste YouTube URL" field
   - Video should appear immediately

5. **Save Walkthrough**
   - Click "Save" button
   - Refresh page
   - Video should still show

---

## ⚠️ Common Mistakes

### ❌ Don't Do This:
```
1. Pasting YouTube homepage: youtube.com
2. Pasting YouTube channel: youtube.com/@channelname
3. Pasting search results: youtube.com/results?search_query=...
4. Pasting playlists: youtube.com/playlist?list=...
5. Using private/unlisted videos from other accounts
```

### ✅ Do This Instead:
```
1. Paste specific video URL: youtube.com/watch?v=VIDEO_ID
2. Or short URL: youtu.be/VIDEO_ID
3. Make sure video is public
4. Test URL in new tab first
```

---

## 🎯 Quick Test

**Want to test if Embed block works?**

Use this test video URL:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

This is a public YouTube video that will definitely work!

---

## 📊 Error Messages Explained

### "Refused to display in a frame because it set 'X-Frame-Options' to 'sameorigin'"
**Meaning:** The website you're trying to embed doesn't allow embedding  
**Fix:** Use a specific video/file URL, not a homepage

### "Framing '<URL>' violates the following Content Security Policy directive"
**Meaning:** Content Security Policy blocks this embed  
**Fix:** Make sure you're using official embed URLs, not regular page URLs

### "Failed to load resource: 404"
**Meaning:** The URL doesn't exist or was deleted  
**Fix:** Check if the URL is correct and content still exists

---

## 💡 Pro Tips

1. **Always test URLs first**
   - Open URL in new tab
   - Make sure it loads
   - Then paste into Embed block

2. **Use official share buttons**
   - YouTube: Click "Share" → Copy link
   - Vimeo: Click "Share" → Copy link
   - This gives you the correct format

3. **Check embed permissions**
   - Some videos disable embedding
   - Look for "Share" or "Embed" options
   - If missing, video might not be embeddable

4. **Provider-specific URLs**
   - Each provider has its own URL format
   - Embed block auto-converts to proper format
   - But you still need specific content URL, not homepage

---

**Need help? Check console logs (F12) for specific error messages!**
