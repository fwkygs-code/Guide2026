# GIF Debugging Guide

## How to Debug GIF Playback Issues

### 1. Open Browser Console

**Desktop:**
- Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
- Safari: Enable Developer menu, then press `Cmd+Option+C`

**Mobile:**
- iOS Safari: Connect to Mac, use Safari Web Inspector
- Android Chrome: Connect via USB, use Chrome DevTools
- Or use remote debugging tools

### 2. Look for Debug Logs

All GIF-related logs are prefixed with `[GIF Debug]`:

#### Detection Logs
```
[GIF Debug] isGif: Detected GIF by extension: https://...
[GIF Debug] isGif: Detected GIF - Cloudinary video URL with media_type=image: https://...
[GIF Debug] isGif: Not a GIF: https://... mediaType: image
```

#### URL Conversion Logs
```
[GIF Debug] getGifVideoUrl called: {gifUrl: "...", mediaType: "image", ...}
[GIF Debug] getGifVideoUrl: Already video format, optimized: https://...
[GIF Debug] getGifVideoUrl: Converted (with version): https://...
[GIF Debug] getGifVideoUrl: No conversion possible, returning null
```

#### Rendering Decision Logs
```
[GIF Debug] Legacy Media Render: {url: "...", mediaType: "image", isMobile: true, ...}
[GIF Debug] Legacy Media Decision: {shouldRenderAsVideo: true, gifVideoUrl: "...", ...}
[GIF Debug] Rendering as VIDEO: {original: "...", videoUrl: "...", optimized: "..."}
```

#### Video Load Logs
```
[GIF Debug] Video load started: https://...
[GIF Debug] Video loaded successfully: https://...
[GIF Debug] Video failed to load: {error: ..., src: "...", original: "..."}
```

### 3. Common Issues & Solutions

#### Issue: Re-uploaded GIF shows as static image

**Check:**
1. Look for: `[GIF Debug] Legacy Media Render`
2. Verify `isVideoUrl: true` and `mediaType: "image"`
3. Verify `shouldRenderAsVideo: true`
4. Check if video element is created

**If video element is created but not playing:**
- Check Network tab - is video URL loading?
- Check for CORS errors
- Verify video URL is accessible
- Check `[GIF Debug] Video failed to load` error

**If video element is NOT created:**
- Check if `shouldRenderAsVideo` is false
- Verify URL detection logic
- Check if `isGif()` is returning false incorrectly

#### Issue: Old GIF doesn't load on mobile

**Check:**
1. Look for: `[GIF Debug] getGifVideoUrl called`
2. Verify URL conversion is happening
3. Check converted URL in logs
4. Verify mobile detection: `isMobile: true`

**If conversion fails:**
- Check URL format - is it Cloudinary?
- Check if URL has `/image/upload/` path
- Verify `.gif` extension is present
- Check for errors in `getGifVideoUrl` logs

**If conversion succeeds but video doesn't load:**
- Check Network tab for 404 errors
- Verify converted URL is correct format
- Check if Cloudinary has the video version
- May need to re-upload the GIF

#### Issue: Video element created but shows nothing

**Check:**
1. Network tab - is video file loading?
2. Check video element in Elements tab
3. Verify `src` attribute has correct URL
4. Check for console errors

**Common causes:**
- Video URL returns 404 (Cloudinary doesn't have video version)
- CORS issues
- Video format not supported
- Network timeout

### 4. Manual Testing in Console

You can test the detection functions directly:

```javascript
// Test GIF detection
const testUrl = "https://res.cloudinary.com/cloud/video/upload/v123/file.mp4";
console.log('Is GIF?', isGif(testUrl, 'image'));

// Test URL conversion
const gifUrl = "https://res.cloudinary.com/cloud/image/upload/v123/file.gif";
console.log('Video URL:', getGifVideoUrl(gifUrl, 'image'));

// Test optimization
const videoUrl = "https://res.cloudinary.com/cloud/video/upload/v123/file.mp4";
console.log('Optimized:', optimizeCloudinaryUrl(videoUrl, true));
```

### 5. Network Tab Analysis

1. Open Network tab in DevTools
2. Filter by "Media" or "Video"
3. Look for:
   - **200 OK**: Video loaded successfully
   - **404 Not Found**: Video URL doesn't exist (conversion may have failed)
   - **CORS error**: Cross-origin issue
   - **Timeout**: Server not responding

### 6. Element Inspection

1. Right-click on the GIF/video element
2. Select "Inspect"
3. Check:
   - Is it a `<video>` or `<img>` element?
   - What is the `src` attribute?
   - Are there any error attributes?
   - Check computed styles

### 7. Expected Behavior

#### Re-uploaded GIF (Cloudinary video URL)
```
[GIF Debug] isGif: Detected GIF - Cloudinary video URL with media_type=image
[GIF Debug] Legacy Media Render: {isVideoUrl: true, isGifFile: true, ...}
[GIF Debug] Legacy Media Decision: {shouldRenderAsVideo: true, ...}
[GIF Debug] Rendering as VIDEO: {videoUrl: "...", optimized: "..."}
[GIF Debug] Video load started: ...
[GIF Debug] Video loaded successfully: ...
```

#### Old GIF on Mobile
```
[GIF Debug] isGif: Detected GIF by extension
[GIF Debug] Legacy Media Render: {isMobile: true, isGifFile: true, ...}
[GIF Debug] getGifVideoUrl called: ...
[GIF Debug] getGifVideoUrl: Converted (with version): ...
[GIF Debug] Legacy Media Decision: {shouldRenderAsVideo: true, ...}
[GIF Debug] Rendering as VIDEO: ...
```

#### Regular Image
```
[GIF Debug] isGif: Not a GIF: ...
[GIF Debug] Legacy Media Render: {isGifFile: false, ...}
[GIF Debug] Legacy Media Decision: {shouldRenderAsVideo: false, ...}
(Renders as <img>)
```

### 8. Quick Fixes

**If video URL returns 404:**
- The GIF may not have a video version in Cloudinary
- Solution: Re-upload the GIF (it will be stored as video)

**If detection fails:**
- Check URL format in logs
- Verify Cloudinary URL structure
- Check if `media_type` is correct

**If video doesn't autoplay:**
- Check browser autoplay policies
- Verify `muted` and `playsInline` attributes
- Check for browser console warnings

### 9. Disable Logging (Production)

To disable debug logs in production, search for `[GIF Debug]` and remove or comment out those `console.log` statements.

### 10. Report Issues

When reporting issues, include:
1. Browser console logs (all `[GIF Debug]` entries)
2. Network tab screenshot
3. Element inspection screenshot
4. URL of the GIF that's not working
5. Device/browser information
