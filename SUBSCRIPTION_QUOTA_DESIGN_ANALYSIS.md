# Subscription, Quota, and Storage Enforcement System - Design Analysis

## Phase 1: Analysis & Safety Check

### 1.1 Current Database Schema Analysis

#### Existing Collections:
1. **users** - User accounts (email, password_hash, name)
2. **workspaces** - Workspaces (name, slug, logo, brand_color, portal_* fields, owner_id)
3. **workspace_members** - User-workspace relationships (workspace_id, user_id, role)
4. **categories** - Categories (workspace_id, name, description, parent_id, icon_url)
5. **walkthroughs** - Walkthroughs (workspace_id, title, description, icon_url, steps[], category_ids, privacy, status)
6. **walkthrough_versions** - Version snapshots
7. **analytics_events** - Analytics tracking
8. **feedback** - User feedback

#### Current File Storage:
- **NO file records table** - Files are stored in Cloudinary/Local storage but NOT tracked in DB
- Files are referenced by URL strings embedded in:
  - `walkthroughs.icon_url`
  - `walkthroughs.steps[].media_url`
  - `walkthroughs.steps[].blocks[].data.url`
  - `categories.icon_url`
  - `workspaces.logo`
  - `workspaces.portal_background_url`
- **Problem**: No way to track file sizes, deletion, or enforce quotas without file records

### 1.2 Components That Will Be Affected

#### A. Upload Flow (`/api/upload`)
**Current Behavior:**
- No quota checking
- No file size limits
- No DB record creation
- Direct Cloudinary/local storage upload
- Returns URL immediately

**Changes Required:**
- Add file record creation in DB (status=pending)
- Add quota check before upload
- Add file size validation against plan limits
- Two-phase commit: DB record → Object storage
- Handle failures gracefully

**Risk Level**: HIGH - Core functionality, many call sites

#### B. Walkthrough Creation/Editing
**Affected Endpoints:**
- `POST /api/workspaces/{id}/walkthroughs` - create_walkthrough
- `PUT /api/workspaces/{id}/walkthroughs/{id}` - update_walkthrough
- `POST /api/workspaces/{id}/walkthroughs/{id}/steps` - add_step
- `PUT /api/workspaces/{id}/walkthroughs/{id}/steps/{id}` - update_step

**Current Behavior:**
- No workspace limit checking
- No walkthrough count enforcement
- Icon/media URLs can be set to any URL (not just uploaded files)
- External URLs allowed (bypass storage limits)

**Changes Required:**
- Enforce workspace count per user (based on plan)
- Enforce walkthrough count per workspace
- Track file usage when files are associated with walkthroughs
- Distinguish between uploaded files vs external URLs

**Risk Level**: MEDIUM-HIGH - Multiple endpoints, existing flows

#### C. Category Creation
**Affected Endpoint:**
- `POST /api/workspaces/{id}/categories` - create_category

**Current Behavior:**
- No category limit checking
- Icon URLs allowed (external or uploaded)

**Changes Required:**
- Enforce category count per workspace
- Track icon file usage if using uploaded files

**Risk Level**: LOW - Single endpoint, simple logic

#### D. Walkthrough Deletion
**Affected Endpoints:**
- `DELETE /api/workspaces/{id}/walkthroughs/{id}` - delete_walkthrough (archives)
- `DELETE /api/workspaces/{id}/walkthroughs/{id}/permanent` - permanently_delete_walkthrough

**Current Behavior:**
- Only soft-deletes (archives) walkthrough
- Does NOT delete associated files
- Permanent delete only removes DB record
- No cleanup of Cloudinary/local storage

**Changes Required:**
- Cascade delete file records
- Delete files from object storage
- Update storage quota
- Must be idempotent

**Risk Level**: HIGH - File cleanup is critical, orphaned files = wasted storage

#### E. Workspace Creation
**Affected Endpoint:**
- `POST /api/workspaces` - create_workspace

**Current Behavior:**
- No limit checking
- Logo/background URLs allowed (external or uploaded)

**Changes Required:**
- Check user's workspace count against plan limit
- Track workspace file usage (logo, background)
- Assign default plan on signup

**Risk Level**: MEDIUM - New feature, but affects critical flow

#### F. File Deletion (New Endpoint)
**Required Endpoint:**
- `DELETE /api/files/{file_id}` - delete_file

**Behavior:**
- Must be idempotent
- Mark file as deleting
- Delete from object storage
- Remove DB record or mark deleted_at
- Update quota
- Handle partial failures

**Risk Level**: NEW - No existing endpoint, but critical for quota management

### 1.3 Potential Failure Cases

#### Race Conditions:
1. **Concurrent Uploads**: Two users upload simultaneously, both pass quota check
   - **Solution**: SELECT FOR UPDATE lock on user quota rows
   - **Risk**: Lock contention on high-traffic accounts

2. **Concurrent Deletions**: File deleted while walkthrough being created with same file
   - **Solution**: Status checks (deleting/active), proper transaction isolation

3. **Quota Check vs Upload Gap**: Quota checked, then another request consumes quota before upload completes
   - **Solution**: Reserve quota with status=pending in same transaction

#### Partial Uploads:
1. **DB Record Created, Cloudinary Upload Fails**:
   - Current: File record exists but no actual file
   - Solution: Mark status=failed, don't count toward quota, auto-cleanup

2. **Cloudinary Upload Succeeds, DB Update Fails**:
   - Current: File in Cloudinary but no DB record (orphaned)
   - Solution: Retry mechanism, or check Cloudinary for orphaned files

3. **Network Timeout During Upload**:
   - Current: Unknown state
   - Solution: Idempotency keys, status polling, cleanup jobs

#### Retries / Double Submits:
1. **Duplicate Upload Request**: Same file uploaded twice due to retry
   - Current: Two separate files, double storage usage
   - Solution: Idempotency key checking before upload

2. **Frontend Retry on Timeout**: User clicks upload multiple times
   - Current: Multiple upload attempts
   - Solution: Frontend debouncing + idempotency keys

#### Cascade Deletes:
1. **Walkthrough Deletion**: Must find all associated files
   - Current: Files referenced as URLs in steps/blocks - need to scan
   - Solution: File records with `reference_type` and `reference_id` for tracking

2. **File Deletion While In Use**: File deleted but walkthrough still references it
   - Current: Broken images
   - Solution: Reference counting, prevent deletion if referenced

3. **Failed Cascade Deletion**: Partial failure during cleanup
   - Current: Orphaned files remain
   - Solution: Transaction logs, retry mechanism, manual cleanup tools

#### Plan Downgrade:
1. **Over Quota After Downgrade**: User has 30GB, downgrades to 25GB plan
   - Current: No handling
   - Solution: Mark user as over_quota, block uploads, allow read-only access

2. **Workspace Count Over Limit**: User has 5 workspaces, downgrades to 3
   - Current: No handling
   - Solution: Mark excess workspaces as read-only, prevent new workspace creation

3. **Walkthrough Count Over Limit**: Workspace has 15 walkthroughs, downgrades to 10
   - Current: No handling
   - Solution: Mark excess walkthroughs as read-only, prevent new walkthrough creation

#### Quota Desync:
1. **Manual Database Changes**: Admin edits quota values directly
   - Current: No validation
   - Solution: Quota validation on read, background reconciliation job

2. **Failed Deletion Accounting**: File deleted from storage but quota not updated
   - Current: Quota permanently inflated
   - Solution: Periodic reconciliation job, audit logs

3. **Orphaned File Records**: DB record exists but file missing from storage
   - Current: Quota counted but no actual storage used
   - Solution: Health check job, cleanup orphaned records

### 1.4 Existing Pages/APIs/Workflows Impacted

#### Frontend Pages:
1. **DashboardPage** - Workspace creation (add plan selection modal)
2. **WalkthroughsPage** - Walkthrough creation (check limits, show over-quota warnings)
3. **CanvasBuilderPage** - File uploads (quota checks, error handling)
4. **SettingsPage** - Plan display, quota usage display
5. **CategoriesPage** - Category creation (limit enforcement)
6. **SignupPage** - Post-signup plan selection modal
7. **WalkthroughBuilderPage** - File uploads (legacy builder)

#### Backend APIs:
1. `POST /api/upload` - Complete rewrite with quota checks
2. `POST /api/workspaces` - Add workspace count check
3. `POST /api/workspaces/{id}/walkthroughs` - Add walkthrough count check
4. `POST /api/workspaces/{id}/categories` - Add category count check
5. `DELETE /api/workspaces/{id}/walkthroughs/{id}` - Add file cleanup
6. `DELETE /api/workspaces/{id}/walkthroughs/{id}/permanent` - Add file cleanup
7. `PUT /api/workspaces/{id}/walkthroughs/{id}` - File association tracking
8. `POST /api/workspaces/{id}/walkthroughs/{id}/steps` - File association tracking
9. `PUT /api/workspaces/{id}/walkthroughs/{id}/steps/{id}` - File association tracking
10. `GET /api/workspaces/{id}` - Include quota usage in response

#### New APIs Required:
1. `GET /api/users/me/plan` - Get user's current plan
2. `PUT /api/users/me/plan` - Change plan (admin/test)
3. `GET /api/workspaces/{id}/quota` - Get workspace quota usage
4. `DELETE /api/files/{file_id}` - Delete file (idempotent)
5. `POST /api/files/{file_id}/verify` - Verify file exists and update status
6. `GET /api/users/me/subscription` - Get subscription details

### 1.5 Safety Confirmations

#### ✅ Will NOT Break Existing Behavior:
1. **Read Operations**: All GET endpoints remain unchanged (except adding quota info)
2. **Existing Files**: Files already in Cloudinary/local storage will be migrated to file records
3. **External URLs**: External URLs (not uploaded) will NOT count toward quota
4. **Walkthrough Viewing**: Portal and viewer pages unchanged
5. **Authentication**: Auth flow unchanged

#### ⚠️ Changes to Existing Flows:
1. **Upload Endpoint**: Returns error codes for quota/file size exceeded (frontend must handle)
2. **Workspace Creation**: May fail if user at workspace limit (new error)
3. **Walkthrough Creation**: May fail if workspace at walkthrough limit (new error)
4. **Category Creation**: May fail if workspace at category limit (new error)

#### ❌ Breaking Changes:
1. **File URLs**: File IDs may need to be stored alongside URLs for tracking (backward compatible)
2. **Upload Response**: May include file_id in addition to URL (backward compatible)

---

## Phase 2: Test Plan

### 2.1 Unit Tests

#### Test Suite: File Upload
1. **Normal Upload**
   - Upload file under quota
   - Verify DB record created with status=active
   - Verify quota incremented
   - Verify Cloudinary upload succeeds

2. **File Size Limit**
   - Upload file exceeding max_file_size
   - Verify error before upload attempt
   - Verify no DB record created
   - Verify quota unchanged

3. **Quota Limit**
   - Upload file when quota would be exceeded
   - Verify error before upload attempt
   - Verify no DB record created
   - Verify quota unchanged

4. **Idempotency**
   - Upload same file twice with same idempotency_key
   - Verify second request returns existing file
   - Verify quota only counted once

5. **Failed Upload (Cloudinary Fails)**
   - Mock Cloudinary failure
   - Verify DB record marked as status=failed
   - Verify quota NOT counted
   - Verify cleanup job can retry

6. **Failed Upload (DB Insert Fails)**
   - Mock DB failure after Cloudinary success
   - Verify Cloudinary file can be cleaned up
   - Verify quota unchanged

#### Test Suite: Quota Enforcement
1. **Workspace Count**
   - Create workspace at limit
   - Verify success
   - Try to create one more
   - Verify failure with clear error

2. **Walkthrough Count**
   - Create walkthrough at limit
   - Verify success
   - Try to create one more
   - Verify failure with clear error

3. **Category Count**
   - Create category at limit
   - Verify success
   - Try to create one more
   - Verify failure with clear error

4. **Storage Quota**
   - Calculate current active storage
   - Upload file that would exceed quota
   - Verify error with current vs allowed storage

#### Test Suite: Deletion
1. **File Deletion**
   - Delete file with status=active
   - Verify status changed to deleting
   - Verify Cloudinary deletion called
   - Verify DB record removed
   - Verify quota decremented

2. **Idempotent Deletion**
   - Delete file twice
   - Verify second request succeeds (idempotent)
   - Verify no errors

3. **Delete Non-Existent File**
   - Delete file_id that doesn't exist
   - Verify idempotent success (no error)

4. **Cascade Walkthrough Deletion**
   - Delete walkthrough with 5 associated files
   - Verify all 5 files marked for deletion
   - Verify quota decremented by sum of all files
   - Verify Cloudinary cleanup for all files

5. **Failed Cascade (Partial)**
   - Mock Cloudinary failure for one file in cascade
   - Verify other files still deleted
   - Verify failed file marked for retry
   - Verify quota partially decremented

#### Test Suite: Plan Downgrade
1. **Storage Over Quota**
   - User has 30GB, downgrade to 25GB plan
   - Verify over_quota flag set
   - Verify new uploads blocked
   - Verify existing content readable

2. **Workspace Over Limit**
   - User has 5 workspaces, downgrade to 3
   - Verify excess workspaces marked read-only
   - Verify new workspace creation blocked
   - Verify existing workspaces functional

3. **Walkthrough Over Limit**
   - Workspace has 15 walkthroughs, downgrade to 10
   - Verify excess walkthroughs marked read-only
   - Verify new walkthrough creation blocked

### 2.2 Integration Tests

#### Test Suite: Concurrent Operations
1. **Concurrent Uploads (Same User)**
   - Two requests upload simultaneously
   - Verify both check quota with lock
   - Verify only one succeeds if quota would be exceeded
   - Verify quota accurate after both complete

2. **Upload + Delete Race**
   - Upload file, immediately delete it
   - Verify quota accurate (should be 0)
   - Verify file properly cleaned up

3. **Concurrent Deletions (Same File)**
   - Two requests delete same file
   - Verify idempotent behavior
   - Verify quota decremented once

#### Test Suite: Failure Recovery
1. **Partial Upload Recovery**
   - Upload fails after DB insert
   - Verify cleanup job finds orphaned record
   - Verify status updated to failed
   - Verify quota corrected

2. **Orphaned Cloudinary Files**
   - File in Cloudinary but no DB record
   - Verify health check detects it
   - Verify manual cleanup possible

3. **Quota Reconciliation**
   - Manually edit DB to desync quota
   - Run reconciliation job
   - Verify quota recalculated correctly

#### Test Suite: Migration
1. **Existing Files Migration**
   - Create test data with URLs (no file records)
   - Run migration script
   - Verify file records created
   - Verify quota calculated correctly

2. **External URL Handling**
   - Walkthrough with external URLs (not uploaded)
   - Verify no file records created
   - Verify quota unchanged

---

## Phase 3: Explicit Confirmation

### Implementation Safety Assessment

#### ✅ CAN Implement Safely:

1. **Database Schema Changes**
   - New collections (plans, subscriptions, files) won't affect existing collections
   - Can add fields incrementally (subscription_id to users, plan_id to workspaces)
   - Existing queries unaffected if new fields optional

2. **Quota Enforcement Middleware**
   - Can be added as dependency injection
   - Existing endpoints wrap with quota checks
   - Failures return clear error codes (don't break existing error handling)

3. **File Record Creation**
   - Can be added alongside existing upload flow
   - Gradual migration: new uploads create records, old files migrated later
   - Backward compatible (existing URLs still work)

4. **Upload Flow Rewrite**
   - Most critical change, but isolated to `/api/upload`
   - Can maintain backward compatibility in response format
   - Frontend only needs error handling updates

5. **Deletion Cascade**
   - Can be added to existing deletion endpoints
   - Non-breaking: existing deletes continue to work, just add cleanup
   - Can be made optional (flag) for gradual rollout

#### ⚠️ AREAS REQUIRING CAREFUL IMPLEMENTATION:

1. **File URL Tracking**
   - Currently URLs stored as strings in various places
   - Need to link URLs to file records
   - Options:
     a) Store file_id alongside URL (backward compatible)
     b) Lookup file_id by URL on read (performance concern)
     c) Migration script to populate file records from existing URLs

2. **External vs Uploaded URLs**
   - Need to distinguish between Cloudinary/local URLs vs external URLs
   - External URLs should NOT count toward quota
   - May require URL pattern matching or explicit flag

3. **Quota Calculation Performance**
   - Summing all active files could be slow for large accounts
   - Solutions:
     a) Cache quota with periodic refresh
     b) Increment/decrement on upload/delete (with reconciliation job)
     c) Materialized view or aggregation pipeline

4. **Transaction Safety**
   - MongoDB transactions require replica set (single-node dev vs prod)
   - Need to handle both cases
   - Consider alternative locking mechanisms for dev

5. **Plan Selection UX**
   - "Choose your plan" modal after signup
   - Must not break existing signup flow
   - Can default to Free plan if modal dismissed

#### ❌ BLOCKERS / UNSAFE AREAS:

1. **File URL Migration**
   - Existing walkthroughs/steps/blocks have URLs but no file records
   - Need migration strategy:
     - Option A: Bulk migration script (safe, but requires downtime)
     - Option B: Lazy migration (create records on access) - preferred
     - Option C: Hybrid (migrate on edit, bulk for remaining)

2. **Cloudinary Orphaned Files**
   - Files may exist in Cloudinary but not in new file records
   - Need cleanup strategy or manual tool
   - Could inflate storage costs temporarily

3. **Quota Counter Consistency**
   - Increment/decrement counters vs SUM calculation
   - Risk of desync if increments fail but files created
   - Solution: Reconciliation job + audit logging

4. **Plan Assignment on Signup**
   - Existing users have no plan assigned
   - Default to Free plan automatically?
   - Or force plan selection on first login?

### Final Confirmation Statement

**I CAN implement this subscription, quota, and storage enforcement system WITHOUT breaking existing functionality, provided:**

1. ✅ **Migration Strategy**: Lazy migration of existing file URLs to file records (no downtime)
2. ✅ **Backward Compatibility**: All new features are additive; existing URLs/flows continue working
3. ✅ **Gradual Rollout**: Quota checks can be feature-flagged for testing
4. ✅ **Default Plans**: Existing users auto-assigned Free plan; new users select plan after signup
5. ✅ **Error Handling**: All quota/limit errors return clear HTTP codes (402 Payment Required, 413 Payload Too Large, etc.)
6. ✅ **Reconciliation Jobs**: Background jobs to fix quota desync and orphaned files

**However, I recommend the following implementation order to minimize risk:**

### Recommended Implementation Phases:

**Phase 1: Foundation (Low Risk)**
- Add plans/subscriptions/files collections to DB
- Add plan assignment to users (default Free)
- Create file records table and models
- Migration script for file record creation (dry-run first)

**Phase 2: File Tracking (Medium Risk)**
- Update upload endpoint to create file records
- Add file_id storage alongside URLs in walkthroughs/steps/blocks
- Lazy migration: create file records when URLs accessed if missing

**Phase 3: Quota Calculation (Medium Risk)**
- Add quota calculation functions
- Add quota to workspace/user API responses
- Frontend quota display (no enforcement yet)

**Phase 4: Quota Enforcement (High Risk)**
- Add quota checks to upload endpoint
- Add limit checks to workspace/walkthrough/category creation
- Add over-quota state handling
- Frontend error handling and UI

**Phase 5: Deletion & Cleanup (High Risk)**
- Add file deletion endpoint
- Cascade deletion on walkthrough deletion
- Cloudinary cleanup
- Reconciliation jobs

**Phase 6: Plan Management (Low Risk)**
- Plan selection modal on signup
- Plan downgrade handling
- Over-quota state UI

This phased approach allows testing each component independently and minimizes risk of breaking existing functionality.

---

## Proposed Database Schema

### New Collections:

```javascript
// plans collection
{
  id: string (PK),
  name: string ("free", "pro", "enterprise"),
  display_name: string ("Free", "Pro", "Enterprise"),
  max_workspaces: number | null (null = unlimited),
  max_categories: number | null,
  max_walkthroughs: number | null,
  storage_bytes: number (500 * 1024 * 1024 for Free, etc.),
  max_file_size_bytes: number (10 * 1024 * 1024 for Free, etc.),
  extra_storage_increment_bytes: number | null (25 * 1024 * 1024 * 1024, null if not available),
  created_at: datetime,
  updated_at: datetime
}

// subscriptions collection
{
  id: string (PK),
  user_id: string (FK to users),
  plan_id: string (FK to plans),
  status: string ("active", "cancelled", "expired"),
  extra_storage_bytes: number (0, additional beyond plan storage),
  started_at: datetime,
  cancelled_at: datetime | null,
  created_at: datetime,
  updated_at: datetime
}

// files collection
{
  id: string (PK),
  user_id: string (FK to users),
  workspace_id: string (FK to workspaces),
  status: string ("pending", "active", "failed", "deleting"),
  size_bytes: number (authoritative file size),
  url: string (Cloudinary URL or local path),
  public_id: string | null (Cloudinary public_id),
  resource_type: string ("image", "video", "raw"),
  idempotency_key: string (unique, for deduplication),
  reference_type: string | null ("walkthrough_icon", "step_media", "block_image", "workspace_logo", etc.),
  reference_id: string | null (walkthrough_id, step_id, block_id, etc.),
  created_at: datetime,
  updated_at: datetime,
  deleted_at: datetime | null
}
```

### Schema Changes to Existing Collections:

```javascript
// users collection - ADD:
subscription_id: string | null (FK to subscriptions)
plan_id: string | null (FK to plans, denormalized for performance)

// workspaces collection - ADD:
subscription_id: string | null (FK to subscriptions, for workspace-level quotas if needed)
```

---

## End of Analysis

**Status**: ✅ **READY FOR IMPLEMENTATION** with phased approach and migration strategy.

**Estimated Implementation Time**: 3-4 weeks (with testing)

**Critical Dependencies**: 
- MongoDB replica set (for transactions) OR alternative locking mechanism
- Cloudinary API access for file deletion
- Background job system (for reconciliation and cleanup)

**Next Steps**: Await explicit approval to proceed with Phase 1 implementation.
