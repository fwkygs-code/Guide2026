# Image Persistence Fix - Complete Solution

## Problem
Images (including GIFs) were being lost when:
1. Uploading to a block
2. Saving the walkthrough
3. Refreshing the page

## Root Causes Identified

### 1. Backend Merge Logic Issue
The `update_step` endpoint had a bug where it wasn't properly preserving existing block URLs when merging new block data. The merge logic was overwriting URLs instead of preserving them.

### 2. Missing Deep Copy
Block data wasn't being deep copied properly, causing nested properties (like `data.url`) to be lost during state updates.

### 3. Insufficient Logging
No visibility into where data was being lost in the flow.

## Fixes Implemented

### Backend (`backend/server.py`)

1. **Fixed Block Merge Logic** (lines 1107-1161):
   - Now properly preserves existing URLs when merging block data
   - If new block has URL, use it; otherwise preserve existing URL
   - Deep copies all block data to prevent reference issues

2. **Comprehensive Logging**:
   - Logs when blocks are saved with/without URLs
   - Warns when image blocks are missing URLs
   - Tracks block state throughout the save process

3. **New Diagnostic Endpoint** (`/diagnose-blocks`):
   - Checks block data integrity
   - Reports which blocks have URLs and which don't
   - Identifies specific issues per step

### Frontend

1. **BlockComponent.js** - Enhanced Upload Handler:
   - Preserves ALL existing block data when updating URL
   - Logs upload process for debugging
   - Ensures settings and other data fields are preserved

2. **CanvasBuilderPage.js** - Enhanced Save/Load:
   - Deep copies block data during save
   - Logs image blocks with/without URLs during save
   - Logs loaded blocks during fetch
   - Warns when image blocks are missing URLs

3. **Comprehensive Console Logging**:
   - `[BlockComponent]` - Upload and block update logs
   - `[CanvasBuilder]` - Save, load, and state update logs
   - All logs include block IDs and URLs for tracking

## How to Use Diagnostic Tools

### 1. Browser Console Logs

Open browser console (F12) and look for:

**During Upload:**
```
[BlockComponent] Starting upload for block: block-123 Type: image
[BlockComponent] Upload response: {url: "https://..."}
[BlockComponent] Full URL: https://res.cloudinary.com/...
[BlockComponent] Updating image block with URL: https://...
[BlockComponent] Block updated successfully: {id: "...", data: {url: "..."}}
```

**During Save:**
```
[CanvasBuilder] Saving image block with URL: block-123 https://...
[CanvasBuilder] Saving step with blocks: step-456 [...]
```

**During Load:**
```
[CanvasBuilder] Loaded image block with URL: block-123 https://...
[CanvasBuilder] Step step-456: 2 image blocks, 2 with URLs
```

**Warnings (if issues):**
```
[CanvasBuilder] WARNING: Image block missing URL: block-123
[CanvasBuilder] WARNING: Loaded image block WITHOUT URL: block-123
```

### 2. Backend Diagnostic Endpoint

Call the diagnostic endpoint to check block integrity:

```javascript
// In browser console or via API
const response = await fetch('/api/workspaces/{workspaceId}/walkthroughs/{walkthroughId}/diagnose-blocks', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log(data);
```

**Response includes:**
- Summary of all blocks (total, image blocks, with/without URLs)
- Per-step breakdown
- List of issues (blocks missing URLs)
- Block details with URLs

### 3. Backend Server Logs

Check Render backend logs for:
```
[update_step] Step step-123: Existing blocks count: 5
[update_step] Block block-456 (image): New URL provided: https://...
[update_step] Step step-123: Final state - 2 image blocks with URLs, 0 without URLs
[update_step] Step step-123: Successfully saved to database
```

**Warnings:**
```
[update_step] WARNING - 1 image blocks missing URLs!
[update_step] Block block-789 missing URL: {...}
```

## Testing the Fix

1. **Upload an image/GIF to a block:**
   - Check console for `[BlockComponent]` logs
   - Verify URL is logged correctly

2. **Save the walkthrough:**
   - Check console for `[CanvasBuilder] Saving image block with URL`
   - Check backend logs for `[update_step]` messages
   - Verify no warnings about missing URLs

3. **Refresh the page:**
   - Check console for `[CanvasBuilder] Loaded image block with URL`
   - Verify image still displays
   - Check for any warnings

4. **If image is missing:**
   - Check console logs to see where URL was lost
   - Use diagnostic endpoint to identify the issue
   - Check backend logs for merge warnings

## Key Improvements

1. **URL Preservation**: URLs are now explicitly preserved during all merge operations
2. **Deep Copying**: All block data is deep copied to prevent reference issues
3. **Comprehensive Logging**: Full visibility into data flow
4. **Diagnostic Tools**: Easy way to check block integrity
5. **Error Detection**: Warnings when blocks are missing URLs

## If Issues Persist

1. **Check Console Logs**: Look for warnings about missing URLs
2. **Use Diagnostic Endpoint**: Identify which blocks are affected
3. **Check Backend Logs**: See if merge logic is working correctly
4. **Verify Upload Response**: Ensure upload returns a valid URL
5. **Check Network Tab**: Verify API calls include block data with URLs

The logging will show exactly where in the flow the URL is being lost, making it easy to identify and fix any remaining issues.
