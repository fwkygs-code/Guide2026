# Cloudinary Setup Guide

## Why Cloudinary?

Cloudinary provides persistent file storage that survives redeployments:
- ✅ **Free Tier**: 25GB storage, 25GB bandwidth/month
- ✅ **Automatic Optimization**: Images are optimized automatically
- ✅ **CDN**: Fast global delivery
- ✅ **Persistent**: Files never lost on redeployment
- ✅ **Easy Setup**: Just add 3 environment variables

## Quick Setup (5 minutes)

### Step 1: Create Cloudinary Account

1. Go to https://cloudinary.com/users/register/free
2. Sign up for free account
3. Verify your email

### Step 2: Get Your Credentials

1. Go to https://cloudinary.com/console
2. You'll see your **Cloud Name**, **API Key**, and **API Secret**
3. Copy these values (you'll need them in Step 3)

### Step 3: Add to Render

1. Go to your Render dashboard
2. Select your `guide2026-backend` service
3. Go to **Environment** tab
4. Add these environment variables:

```
CLOUDINARY_CLOUD_NAME = your-cloud-name
CLOUDINARY_API_KEY = your-api-key
CLOUDINARY_API_SECRET = your-api-secret
```

5. Click **Save Changes**
6. Render will automatically redeploy

### Step 4: Verify It Works

1. After redeployment, upload an image in your app
2. Check the image URL - it should start with `https://res.cloudinary.com/...`
3. Redeploy your app - the image should still be accessible!

## How It Works

### Before (Local Storage)
```
Upload → backend/uploads/file.jpg → Lost on redeploy ❌
```

### After (Cloudinary)
```
Upload → Cloudinary CDN → https://res.cloudinary.com/... → Persists forever ✅
```

## Features You Get

### Automatic Image Optimization
- Images are automatically optimized for web
- Multiple formats (WebP, AVIF) when supported
- Responsive images

### CDN Delivery
- Files served from global CDN
- Faster loading times
- Reduced server load

### Transformations
You can add transformations to image URLs:
- Resize: `?w=800&h=600`
- Crop: `?c_fill,w=400,h=400`
- Quality: `?q_auto`
- Format: `?f_auto` (auto WebP/AVIF)

Example:
```
Original: https://res.cloudinary.com/your-cloud/image/upload/v123/file.jpg
Resized:  https://res.cloudinary.com/your-cloud/image/upload/w_800,h_600/v123/file.jpg
```

## Migration from Local Storage

If you have existing files in `backend/uploads/`:

1. **Backup existing files** (download them)
2. **Upload to Cloudinary** manually via dashboard or API
3. **Update database URLs** (if needed) - but this is usually automatic
4. **Deploy new code** - new uploads will go to Cloudinary

## Testing

### Test Upload
```bash
# Upload a test image
curl -X POST https://your-backend.onrender.com/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"
```

### Check Response
You should see:
```json
{
  "url": "https://res.cloudinary.com/your-cloud/image/upload/v123/file.jpg",
  "public_id": "guide2026/file-id",
  "format": "jpg",
  "width": 1920,
  "height": 1080,
  "bytes": 245678
}
```

## Troubleshooting

### Images Still Using Local Storage?

1. Check environment variables are set correctly
2. Check Render logs for Cloudinary errors
3. Verify credentials are correct in Cloudinary dashboard

### Upload Fails?

1. Check file size (free tier: 10MB per file)
2. Check file format (images, videos, PDFs supported)
3. Check Cloudinary dashboard for errors

### Want to Use Local Storage for Development?

Just don't set the Cloudinary environment variables. The code will automatically fall back to local storage.

## Cost

### Free Tier (Perfect for Most Apps)
- 25GB storage
- 25GB bandwidth/month
- 25,000 transformations/month
- Unlimited uploads

### Paid Plans (If You Need More)
- Starter: $99/month - 100GB storage, 100GB bandwidth
- Advanced: $224/month - 500GB storage, 500GB bandwidth

## Security

- ✅ All files are private by default
- ✅ Access via signed URLs if needed
- ✅ API keys are secure (never exposed to frontend)
- ✅ HTTPS only

## Next Steps

1. ✅ Set up Cloudinary account
2. ✅ Add environment variables to Render
3. ✅ Redeploy backend
4. ✅ Test upload
5. ✅ Verify persistence after redeploy

That's it! Your files are now persistent. 🎉
