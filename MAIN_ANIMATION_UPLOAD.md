# Main Animation Upload Instructions

## Problem
The hero video is returning 404 because the video file hasn't been uploaded to Cloudinary yet.

## Solution
Upload `frontend/public/MainAnimation.mp4` to Cloudinary with the following settings:

### Cloudinary Details:
- **Cloud Name**: `ds1dgifj8`
- **Upload Preset**: `interguide_static_upload` (unsigned)
- **Public ID**: `interguide-static/main-animation`
- **Resource Type**: `video`

### Upload Methods:

#### Method 1: Cloudinary Dashboard (Recommended)
1. Go to: https://cloudinary.com/console/upload
2. Upload `frontend/public/MainAnimation.mp4`
3. Set the public ID to: `interguide-static/main-animation`
4. The video will be available at: `https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/main-animation`

#### Method 2: Programmatic Upload
Run the upload script in a proper Node.js environment:
```bash
node upload-main-animation.js
```

### Verification:
- ✅ Video element is implemented in LandingPage.js
- ✅ Correct Cloudinary URL is configured in logo.js
- ✅ Graceful fallback to original logo is implemented
- ✅ Video has proper attributes: autoPlay, muted, loop, playsInline, no controls
- ✅ Layout spacing and sizing preserved

### Expected Result:
Once uploaded, the video will automatically appear in the hero section above the headline "Create Interactive Walkthroughs That Users Actually Follow".

### Files Modified:
1. `frontend/src/utils/logo.js` - Added INTERGUIDE_MAIN_ANIMATION_URL
2. `frontend/src/pages/LandingPage.js` - Replaced hero image with video element
3. `upload-main-animation.js` - Upload script (for proper Node.js environment)
