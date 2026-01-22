# New Blocks Fixes - Critical Issues Resolved

**Date:** 2026-01-21  
**Issues:** Embed block not working, new blocks not persisting, preview broken

---

## 🐛 Issues Fixed

### 1. **Embed Block - URL Transformation**

**Problem:** YouTube and other embed URLs weren't working - iframe used raw URLs

**Fix:** Added comprehensive URL transformation for all providers:

#### YouTube
- `https://youtube.com/watch?v=VIDEO_ID` → `https://www.youtube.com/embed/VIDEO_ID`
- `https://youtu.be/VIDEO_ID` → `https://www.youtube.com/embed/VIDEO_ID`

#### Vimeo
- `https://vimeo.com/VIDEO_ID` → `https://player.vimeo.com/video/VIDEO_ID`

#### Loom
- `https://loom.com/share/VIDEO_ID` → `https://www.loom.com/embed/VIDEO_ID`

#### Figma
- Any Figma URL → `https://www.figma.com/embed?embed_host=share&url=ENCODED_URL`

#### Google Docs
- Docs → `/preview` format
- Presentations → `/embed` format
- Spreadsheets → `/preview` format

**Code Location:** `BuilderV2Page.js` - `case BLOCK_TYPES.EMBED`

---

### 2. **Preview URL Broken**

**Problem:** Preview button used `workspaceId` instead of `workspaceSlug`
- Wrong: `/portal/${workspaceId}/${walkthroughId}`
- This caused "Walkthrough not found" errors

**Fix:** Changed to use `workspaceSlug`:
- Correct: `/portal/${workspaceSlug}/${walkthroughId}`

**Code Location:** `BuilderV2Page.js` - Line ~732

---

### 3. **Blocks Not Persisting - Debugging Added**

**Problem:** New blocks disappeared after saving

**Root Cause Investigation:**
- Added comprehensive logging to track blocks through save/load cycle
- Added block structure validation before sending to backend
- Added filtering to remove null/invalid blocks

**Added Logging:**
```javascript
console.log('[BuilderV2] Saving step X with N blocks:', blockTypes)
console.log('[BuilderV2] Loaded walkthrough:', walkthroughId)
console.log('[BuilderV2] Step N has M blocks:', blockTypes)
```

**What to Check:**
1. Open browser console (F12)
2. Add a new block (Checklist, Callout, etc.)
3. Save the walkthrough
4. Look for `[BuilderV2] Saving step...` logs
5. Refresh page
6. Look for `[BuilderV2] Loaded walkthrough...` logs
7. Check if block types match before/after save

**Validation Added:**
- Ensures blocks have `id`, `type`, `data`, `settings`
- Filters out null/invalid blocks before save
- Logs warnings for malformed blocks

---

## 🧪 Testing Each New Block

### After Deployment Succeeds:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Refresh** the editor page
3. **Open browser console** (F12 → Console tab)
4. **Test each block:**

#### ☑️ Checklist
- Add block
- Add items with "Add Item" button
- Check/uncheck items
- Save → Refresh → Verify items persist

#### 💬 Callout
- Add block
- Select variant (Tip/Warning/Important/Info)
- Add text content
- Save → Refresh → Verify variant and content persist

#### 📌 Annotated Image
- Add block
- Upload or paste image URL
- Click image to add numbered markers
- Save → Refresh → Verify markers persist

#### 📺 Embed
**YouTube:**
- Add block, select "YouTube"
- Paste: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Should show embedded player
- Save → Refresh → Verify video plays

**Vimeo:**
- Select "Vimeo"
- Paste Vimeo URL
- Should show embedded player

**Loom:**
- Select "Loom"
- Paste Loom share URL
- Should show embedded player

**Figma:**
- Select "Figma"
- Paste Figma file URL
- Should show embedded preview

**Google Docs:**
- Select "Google Docs"
- Paste Google Docs/Sheets/Slides URL
- Should show embedded document

#### 📂 Section
- Add block
- Enter section title
- Nested blocks not yet supported (placeholder shown)
- Save → Refresh → Verify title persists

#### ✅ Confirmation
- Add block
- Enter message text
- Customize button text
- Save → Refresh → Verify message persists

#### 🔗 External Link
- Add block
- Enter link text
- Enter URL
- Toggle "Open in new tab"
- Save → Refresh → Verify settings persist

#### 💻 Code/Command
- Add block
- Select language (Bash, JavaScript, Python, etc.)
- Enter code
- Save → Refresh → Verify code and language persist

---

## 🔍 Debugging Blocks Not Persisting

If blocks still don't persist after these fixes, check console logs:

### Step 1: Check Save Logs
```
[BuilderV2] Saving step <id> with N blocks: ['checklist', 'callout', ...]
```
- ✅ If you see this, blocks ARE being sent to backend
- ❌ If you don't see this, blocks aren't in state correctly

### Step 2: Check Load Logs
```
[BuilderV2] Loaded walkthrough: <id>
[BuilderV2] Steps count: N
[BuilderV2] Step 1 has M blocks: ['checklist', 'callout', ...]
```
- ✅ If block types match save logs, backend is persisting correctly
- ❌ If block types are missing, backend might be filtering them

### Step 3: Check Network Tab
1. F12 → Network tab
2. Save walkthrough
3. Find `PUT /api/workspaces/.../walkthroughs/.../steps/...` request
4. Click → Preview tab
5. Look at `blocks` array in request payload
6. Verify all new blocks are present with correct structure

### Step 4: Backend Validation
If blocks disappear between save and load:
- Backend might have validation rejecting unknown block types
- Check Render logs for errors
- Verify `StepCreate` model in backend accepts any block type

---

## ⚙️ Code Changes Summary

### File: `BuilderV2Page.js`

**Lines ~1610-1710:** Embed block URL transformation
- Added `getEmbedUrl()` function
- Handles 7 embed providers
- Auto-converts URLs to embed format

**Line ~732:** Preview URL fix
- Changed from `workspaceId` to `workspaceSlug`

**Lines ~216-250:** Save function improvements
- Added block structure validation
- Added save logging
- Filter null blocks

**Lines ~148-178:** Load function improvements
- Added load logging
- Log block counts and types

---

## 📋 Checklist for User

After deployment:

- [ ] Clear browser cache
- [ ] Refresh editor page
- [ ] Open browser console (F12)
- [ ] Try adding Checklist block → Save → Refresh
- [ ] Check console for `[BuilderV2]` logs
- [ ] Try YouTube embed with watch URL
- [ ] Verify preview button works (no 404)
- [ ] Report any remaining issues with console logs

---

## 🚨 If Issues Persist

**Share these with developer:**

1. **Console logs** (all `[BuilderV2]` lines)
2. **Network tab** - Request/response for step save
3. **Exact steps to reproduce:**
   - Which block type?
   - What data entered?
   - What happens after save?
   - What happens after refresh?

---

**Status:** ✅ Fixes deployed - waiting for user testing

**Commit:** `393616e` - Fix Embed block URL transformation and Preview URL + add debugging logs
