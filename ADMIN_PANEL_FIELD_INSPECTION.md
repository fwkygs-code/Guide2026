# ADMIN PANEL FIELD INSPECTION REPORT

## Current Display Status

### ✅ Already Displayed

1. **disabled** 
   - Location: State column (via `getEffectiveState()` function)
   - File: `frontend/src/pages/AdminDashboardPage.js:366-375`
   - Shows as "Disabled" badge when `user.disabled === true`

2. **deleted_at**
   - Location: State column
   - File: `frontend/src/pages/AdminDashboardPage.js:370-374`
   - Shows "Deleted: [date]" when `user.deleted_at` exists

3. **grace_period_ends_at** (from User model)
   - Location: Grace Period column
   - File: `frontend/src/pages/AdminDashboardPage.js:404-415`
   - Shows "Until: [date]" or "None"

4. **custom quotas**
   - Location: Custom Quotas column
   - File: `frontend/src/pages/AdminDashboardPage.js:424-436`
   - Shows `custom_max_workspaces` and `custom_max_walkthroughs` if set
   - Also shown in Storage column for `custom_storage_bytes` (line 418-422)

### ❌ NOT Currently Displayed

1. **grace_started_at** (from Subscription model)
   - Not returned by list endpoint
   - Subscription model has this field (backend/server.py:398)
   - List endpoint only returns `status` and `started_at` (line 8032)

2. **grace_ends_at** (from Subscription model)
   - Not returned by list endpoint
   - Subscription model has this field (backend/server.py:399)
   - List endpoint only returns `status` and `started_at` (line 8032)

3. **frozen workspace memberships**
   - No endpoint exists to fetch this data
   - Would require querying `workspace_members` with `frozen_reason` filter

---

## Backend Verification

### Subscription Grace Fields
- ✅ Fields exist in Subscription model: `grace_started_at`, `grace_ends_at` (line 398-399)
- ❌ Not included in list endpoint response (line 8032 only returns `status`, `started_at`)

### Frozen Memberships
- ✅ `frozen_reason` field exists in `workspace_members` collection
- ❌ No admin endpoint exists to fetch user's workspace memberships

---

## Required Changes

1. **Backend**: Update list endpoint to include subscription grace fields
2. **Backend**: Add endpoint to fetch user's workspace memberships (read-only)
3. **Frontend**: Display subscription grace fields in UI
4. **Frontend**: Display frozen memberships in UI
