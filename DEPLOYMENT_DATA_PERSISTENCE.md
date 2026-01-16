# Deployment Data Persistence Guide

## ⚠️ CRITICAL: File Upload Storage Issue

### Current Problem
The backend stores uploaded files (images, videos, etc.) in `backend/uploads/` directory, which is **ephemeral** on cloud platforms like Render. This means:

- ❌ **Uploaded files will be LOST on every redeployment**
- ✅ **Database data is SAFE** (MongoDB persists all metadata, URLs, blocks, etc.)
- ❌ **But image files themselves will be missing** even though URLs are saved

### What's Safe (Persists Across Deployments)

✅ **MongoDB Database** - All data persists:
- Walkthroughs, steps, blocks
- Block data including image URLs
- User accounts, workspaces, categories
- Version snapshots
- All metadata

✅ **Code Changes** - Git pushes and redeployments don't affect:
- Database connections (via MONGO_URI env var)
- Saved walkthrough data
- Block structures and URLs

### What's NOT Safe (Lost on Redeployment)

❌ **Uploaded Files** - Files in `backend/uploads/` are lost:
- Image files uploaded by users
- Video files
- Any files stored locally

## Solutions

### Option 1: Use Cloud Storage (RECOMMENDED)

**Best for production:** Use AWS S3, Cloudinary, or similar cloud storage.

#### Implementation Steps:

1. **Install cloud storage library:**
```bash
pip install boto3  # For AWS S3
# OR
pip install cloudinary  # For Cloudinary
```

2. **Update `backend/server.py` upload route:**
```python
import boto3
from botocore.exceptions import ClientError

s3_client = boto3.client('s3',
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    region_name=os.environ.get('AWS_REGION', 'us-east-1')
)
S3_BUCKET = os.environ.get('S3_BUCKET_NAME')

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    file_extension = Path(file.filename).suffix.lower()
    file_id = str(uuid.uuid4())
    file_key = f"{file_id}{file_extension}"
    
    # Upload to S3
    try:
        file_content = await file.read()
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=file_content,
            ContentType=file.content_type
        )
        # Return public URL
        url = f"https://{S3_BUCKET}.s3.amazonaws.com/{file_key}"
        return {"url": url}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
```

3. **Update `render.yaml` with S3 credentials:**
```yaml
envVars:
  - key: AWS_ACCESS_KEY_ID
    sync: false
  - key: AWS_SECRET_ACCESS_KEY
    sync: false
  - key: S3_BUCKET_NAME
    value: "your-bucket-name"
  - key: AWS_REGION
    value: "us-east-1"
```

### Option 2: Use Render Persistent Disk (Render Only)

If using Render, you can mount a persistent disk:

1. **Create a persistent disk in Render dashboard**
2. **Mount it in `render.yaml`:**
```yaml
services:
  - type: web
    name: guide2026-backend
    # ... existing config ...
    disk:
      name: uploads-disk
      mountPath: /opt/render/uploads
      sizeGB: 10
```

3. **Update `backend/server.py`:**
```python
# Use persistent disk path
UPLOAD_DIR = Path(os.environ.get('UPLOAD_DIR', '/opt/render/uploads'))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
```

### Option 3: Use External File Service

Use services like:
- **Cloudinary** - Free tier available, easy integration
- **Imgur API** - For images only
- **Google Cloud Storage**
- **Azure Blob Storage**

## Current Status

### ✅ What Works Now
- All walkthrough data (title, description, steps, blocks) persists
- Block structures and metadata persist
- Image URLs are saved in database
- Version snapshots are preserved

### ⚠️ What Needs Fixing
- **Uploaded files are lost on redeployment**
- Need to migrate to cloud storage or persistent disk

## Migration Strategy

If you already have files in `backend/uploads/`:

1. **Backup existing files** before migration
2. **Upload to cloud storage** (S3, Cloudinary, etc.)
3. **Update database URLs** to point to new cloud storage URLs
4. **Deploy new code** with cloud storage integration
5. **Test** that existing images still load

## Testing After Migration

1. Upload a new image → Should save to cloud storage
2. Check image URL → Should be cloud storage URL
3. Redeploy → Image should still be accessible
4. Verify existing images → Should still work if migrated

## Recommendations

**For Production:**
- ✅ Use AWS S3 or Cloudinary (most reliable)
- ✅ Set up proper CORS for image serving
- ✅ Use CDN for faster image delivery
- ✅ Implement image optimization/compression

**For Development:**
- Local `uploads/` directory is fine
- Just be aware files are lost on redeploy

## Environment Variables Needed

Add to `render.yaml` or your deployment platform:

```yaml
envVars:
  # For S3
  - key: AWS_ACCESS_KEY_ID
    sync: false
  - key: AWS_SECRET_ACCESS_KEY
    sync: false
  - key: S3_BUCKET_NAME
    value: "your-bucket"
  - key: AWS_REGION
    value: "us-east-1"
  
  # OR for Cloudinary
  - key: CLOUDINARY_CLOUD_NAME
    sync: false
  - key: CLOUDINARY_API_KEY
    sync: false
  - key: CLOUDINARY_API_SECRET
    sync: false
```

## Next Steps

1. **Immediate:** Document this limitation for users
2. **Short-term:** Implement cloud storage (S3 or Cloudinary)
3. **Long-term:** Add image optimization and CDN
