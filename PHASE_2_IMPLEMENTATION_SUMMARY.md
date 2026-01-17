# Phase 2: File Tracking - Implementation Summary

## ✅ Completed Implementation

### 1. Two-Phase Upload Flow

#### Upload Endpoint (`POST /api/upload`)
**Complete rewrite with:**
- ✅ Idempotency key support (prevents duplicate uploads)
- ✅ File size limit checking (against plan limits)
- ✅ Storage quota checking (before upload)
- ✅ Two-phase commit:
  1. Create file record with `status=pending` (reserves quota)
  2. Upload to Cloudinary/local storage
  3. Update file record to `status=active` on success
  4. Mark as `status=failed` on failure (doesn't count toward quota)

**New Request Headers:**
- `X-Workspace-Id`: Workspace ID (optional, auto-detected if not provided)
- `X-Idempotency-Key`: Unique key for deduplication (auto-generated if not provided)
- `X-Reference-Type`: Type of reference ("walkthrough_icon", "step_media", "block_image", etc.)
- `X-Reference-Id`: ID of the referencing entity

**Response Format (Backward Compatible):**
```json
{
  "file_id": "uuid",
  "url": "https://...",
  "size_bytes": 123456,
  "status": "active"
}
```

**Error Codes:**
- `402 Payment Required`: Storage quota exceeded
- `413 Payload Too Large`: File size exceeds plan limit
- `409 Conflict`: Upload already in progress (idempotency)

### 2. File Deletion Endpoint

#### `DELETE /api/files/{file_id}`
**Features:**
- ✅ Idempotent (safe to call multiple times)
- ✅ Marks file as `deleting` → deletes from storage → marks as `deleted`
- ✅ Handles Cloudinary and local storage
- ✅ Quota automatically updated (only active files count)

### 3. Cascade Deletion

#### Walkthrough Permanent Deletion
- ✅ Extracts all file URLs from walkthrough (icon, step media, block images)
- ✅ Deletes all associated files
- ✅ Returns count of deleted files

**Helper Functions:**
- `extract_file_urls_from_walkthrough()`: Finds all file URLs in walkthrough
- `delete_files_by_urls()`: Deletes files by URL (idempotent)

### 4. Quota Enforcement

#### Workspace Creation
- ✅ Checks workspace count against plan limit
- ✅ Returns `402` error if limit exceeded

#### Walkthrough Creation
- ✅ Checks walkthrough count against plan limit
- ✅ Returns `402` error if limit exceeded

#### Category Creation
- ✅ Checks category count against plan limit
- ✅ Returns `402` error if limit exceeded

### 5. Lazy Migration

#### File Record Creation from URLs
- ✅ `create_file_record_from_url()`: Creates file records for existing URLs
- ✅ Automatically called when:
  - Walkthrough created/updated (icon_url)
  - Step created/updated (media_url, block images)
  - Workspace created (logo, background)
- ✅ Only creates records for uploaded files (Cloudinary/local URLs)
- ✅ External URLs are ignored (don't count toward quota)

**Migration Strategy:**
- No bulk migration required
- Files are tracked as they're accessed/edited
- Existing files continue to work (backward compatible)

### 6. File Association Tracking

Files are now tracked with:
- `reference_type`: "walkthrough_icon", "step_media", "block_image", "workspace_logo", "workspace_background"
- `reference_id`: ID of the entity using the file
- Enables cascade deletion and reference counting

### 7. Frontend Updates

#### API Client (`frontend/src/lib/api.js`)
- ✅ Updated `uploadFile()` to accept options (workspaceId, idempotencyKey, etc.)
- ✅ Added `getUserPlan()` endpoint
- ✅ Added `getWorkspaceQuota()` endpoint
- ✅ Added `deleteFile()` endpoint

#### BlockComponent
- ✅ Passes workspace/walkthrough context to upload
- ✅ Generates idempotency keys
- ✅ Handles quota errors (402, 413) with user-friendly messages
- ✅ Stores `file_id` in block data for tracking

#### LeftSidebar
- ✅ Passes workspaceId to icon upload
- ✅ Handles quota errors

#### RightInspector
- ✅ Passes workspace/walkthrough/step context to media upload
- ✅ Handles quota errors

#### LiveCanvas
- ✅ Passes workspace/walkthrough context to BlockComponent

## 🔄 Backward Compatibility

- ✅ Upload response includes `url` (existing code continues to work)
- ✅ Existing file URLs continue to function
- ✅ Lazy migration means no downtime required
- ✅ External URLs still work (not tracked, don't count toward quota)

## 📋 Next Steps: Phase 3-6

**Phase 3: Quota Display** (Low Risk)
- Add quota usage display in UI
- Show storage usage, limits, and warnings

**Phase 4: Quota Enforcement UI** (Medium Risk)
- Show over-quota state
- Block uploads when over quota
- Display upgrade prompts

**Phase 5: Plan Management** (Low Risk)
- Plan selection modal on signup
- Plan change handling
- Over-quota state management

**Phase 6: Reconciliation & Cleanup** (Medium Risk)
- Background job for quota reconciliation
- Cleanup of failed/pending files
- Health checks for orphaned files

## 🧪 Testing Checklist

Before proceeding, verify:
- [ ] Upload endpoint creates file records
- [ ] Quota checks prevent uploads when over limit
- [ ] File size limits enforced
- [ ] Idempotency keys prevent duplicate uploads
- [ ] File deletion works and is idempotent
- [ ] Cascade deletion removes all walkthrough files
- [ ] Lazy migration creates file records for existing URLs
- [ ] Frontend handles quota errors gracefully
- [ ] Existing uploads continue to work

## 📝 Notes

- File records are created with `status=pending` initially
- Only `status=active` files count toward quota
- Failed uploads don't consume quota
- External URLs (not from our storage) are not tracked
- Lazy migration happens automatically on edit/access
