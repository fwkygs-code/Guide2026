# Carousel Block Type - Test Checklist

## Implementation Summary

### Data Model
- **Block type**: `carousel`
- **Data structure**: `block.data.slides[]` with:
  - `slide_id`: Unique identifier for each slide
  - `file_id`: File record ID (for tracking)
  - `url`: Media URL (image/video/GIF)
  - `media_type`: 'image', 'video', or 'gif'
  - `caption`: Optional rich text caption (HTML)
- **UI-only state**: `active_index` (not persisted)

### Features Implemented

#### Editor Mode (Builder V2)
- ✅ Add/remove slides (max 20 per carousel)
- ✅ Left/right navigation arrows
- ✅ Dot indicators for slide position
- ✅ Upload media (image/video/GIF) per slide
- ✅ URL input for media
- ✅ Caption editor (rich text via InlineRichEditor)
- ✅ Quota checking before upload
- ✅ File record creation on upload (ACTIVE status)
- ✅ Visual preview of current slide
- ✅ Slide counter display

#### Viewer Mode (WalkthroughViewerPage)
- ✅ Clean carousel display
- ✅ Smooth transitions (Framer Motion)
- ✅ Left/right navigation arrows
- ✅ Dot indicators
- ✅ Mobile swipe support (touch events)
- ✅ Media type handling (image/video)
- ✅ Caption display (HTML rendering)
- ✅ Cloudinary URL optimization

#### Backend Compatibility
- ✅ No schema changes required
- ✅ Slides stored in `block.data.slides` array
- ✅ Uses existing `/api/upload` endpoint
- ✅ File records created with `referenceType: 'block_image'`
- ✅ Full backward compatibility (existing walkthroughs unaffected)

## Test Checklist

### ✅ Basic Functionality
- [ ] **Add carousel block**: Click "+" → Select "Carousel" → Block appears
- [ ] **Add first slide**: Click "Add Slide" → Empty slide editor appears
- [ ] **Upload image to slide**: Upload file → Image appears in preview
- [ ] **Add caption**: Type caption → Caption saves correctly
- [ ] **Add second slide**: Click "Add Slide" → Second slide added
- [ ] **Navigate between slides**: Click arrows/dots → Slide changes
- [ ] **Remove slide**: Click "Remove" → Slide deleted (if >1 slide)

### ✅ Media Upload
- [ ] **Image upload**: Upload JPG/PNG → Displays correctly
- [ ] **GIF upload**: Upload GIF → Displays as image/video based on type
- [ ] **Video upload**: Upload MP4 → Displays with video controls
- [ ] **URL input**: Paste image URL → Media loads
- [ ] **Quota enforcement**: Upload when over quota → Error message shown
- [ ] **File record creation**: Upload file → File record created in DB (ACTIVE)

### ✅ Limits & Validation
- [ ] **Max slides limit**: Try adding 21st slide → Error shown (max 20)
- [ ] **Min slides limit**: Try removing last slide → Error shown (min 1)
- [ ] **Empty carousel**: Carousel with 0 slides → Shows "Add Slide" prompt

### ✅ Persistence
- [ ] **Save walkthrough**: Add carousel with slides → Save → Reload page
- [ ] **Media persists**: Upload media → Save → Reload → Media still visible
- [ ] **Captions persist**: Add captions → Save → Reload → Captions preserved
- [ ] **Multiple slides persist**: Add 3+ slides → Save → Reload → All slides present

### ✅ Viewer Mode
- [ ] **Carousel displays**: View walkthrough → Carousel renders correctly
- [ ] **Navigation works**: Click arrows/dots → Slide changes
- [ ] **Mobile swipe**: Swipe left/right on mobile → Slide changes
- [ ] **Media displays**: Images/videos render correctly
- [ ] **Captions display**: Captions render as HTML
- [ ] **Smooth transitions**: Slide changes animate smoothly

### ✅ Redeploy Safety
- [ ] **After redeploy**: Upload media → Save → Redeploy → Media still works
- [ ] **URL normalization**: Cloudinary URLs resolve correctly after redeploy
- [ ] **File records**: File records persist across redeploys

### ✅ Edge Cases
- [ ] **Empty slide**: Slide with no media → Shows placeholder
- [ ] **Invalid URL**: Paste invalid URL → Error handling
- [ ] **Large file**: Upload file > plan limit → Quota error
- [ ] **Concurrent uploads**: Upload multiple slides → All succeed
- [ ] **Delete walkthrough**: Delete walkthrough with carousel → No orphaned files

### ✅ Backward Compatibility
- [ ] **Existing walkthroughs**: Old walkthroughs without carousel → Still work
- [ ] **Image blocks**: Existing image blocks → Unaffected
- [ ] **Mixed blocks**: Walkthrough with carousel + other blocks → All render

## Files Modified

1. **`frontend/src/utils/blockUtils.js`**
   - Added `CAROUSEL` to `BLOCK_TYPES`
   - Added carousel default data structure
   - Added icon and label

2. **`frontend/src/pages/BuilderV2Page.js`**
   - Added `CarouselBlockEditor` component
   - Added carousel case in `BlockContent`
   - Added carousel to block picker
   - Added carousel settings in inspector

3. **`frontend/src/pages/WalkthroughViewerPage.js`**
   - Added `CarouselViewer` component
   - Added carousel rendering in block display
   - Mobile swipe support

4. **`frontend/src/lib/utils.js`**
   - Enhanced `normalizeImageUrlsInObject` to handle carousel slides

## Backend Requirements

✅ **No backend changes needed** - Carousel slides are stored in `block.data.slides` array, which is already supported by the existing block structure.

## Notes

- **File deletion**: Removing a slide does NOT delete the file record (as per requirements - no frontend deletion logic)
- **Quota**: Each slide upload creates a File record and counts toward quota
- **Max slides**: Enforced at 20 slides per carousel (frontend validation)
- **Media types**: Supports image, video, and GIF (detected automatically)
