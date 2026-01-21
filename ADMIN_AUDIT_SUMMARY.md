# Admin Panel Audit Summary

## ✅ EXISTING ADMIN ACTIONS (What Already Works)

### User Management
- ✅ List/search users with pagination
- ✅ Disable/enable user login
- ✅ Update user role (owner/admin/editor/viewer)
- ✅ Update user plan (free/pro/enterprise)
- ✅ Soft delete user (marks deleted_at, preserves data)
- ✅ Hard delete user (permanent removal with confirmation)
- ✅ View user workspace memberships

### Billing & Plans
- ✅ Create manual subscription (bypasses PayPal)
- ✅ Cancel subscription
- ✅ Force downgrade to Free plan
- ✅ Force upgrade to Pro plan
- ✅ Set grace period (temporary Pro access)
- ✅ Set custom quotas (storage, workspaces, walkthroughs)

### Security (Backend Only - Not in UI)
- ✅ Manually verify user email
- ✅ Manually unverify user email

### System Tools (Backend Only - Not in UI)
- ✅ Reconcile quota discrepancies
- ✅ Cleanup orphaned files
- ✅ Test email configuration
- ✅ PayPal audit logs

---

## ❌ MISSING ADMIN ACTIONS (What Needs to Be Added)

### A. User & Security
- ❌ Force logout user (all sessions)
- ❌ Revoke refresh tokens / invalidate sessions  
- ❌ Admin override: mark email as verified (EXISTS in backend, NOT in UI)
- ❌ Temporary account lock with time-based expiration
- ⚠️ **BROKEN: Restore user** (frontend calls it, backend doesn't exist!)

### B. Workspace Control
- ❌ Remove user from workspace (admin override)
- ❌ Transfer workspace ownership (super-admin only)
- ⚠️ View user workspaces (EXISTS but limited read-only view)

### C. Billing & Quotas
- ✅ Grant temporary Pro - **Already EXISTS** (grace period)
- ✅ Override storage quota - **Already EXISTS**
- ❌ Override max upload size (per-user limit)

### D. Invitations & Collaboration
- ❌ View pending invitations (workspace invites)
- ❌ Revoke invitation
- ❌ Force accept invitation
- ❌ Force expire invitation

### E. Communication
- ❌ Send system notification (in-app)

---

## 🔴 CRITICAL ISSUES

### 1. BROKEN FEATURE: Restore User
**Problem:** Frontend calls `PUT /admin/users/{id}/restore` but backend endpoint DOESN'T EXIST!

```javascript
// Frontend calls this:
adminRestoreUser: (userId) => axios.put(`${API}/admin/users/${userId}/restore`)

// Backend: NO SUCH ENDPOINT!
```

**Impact:** "Restore User" button in admin panel throws 404 error.

### 2. NO Super-Admin Role
**Problem:** All admins have identical permissions. Can't restrict:
- Workspace ownership transfers
- Hard deletes
- Force logouts
- Sensitive overrides

**Current:**
```python
class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"     # Only one admin level!
    EDITOR = "editor"
    VIEWER = "viewer"
```

**Needed:**
```python
class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"  # NEW!
```

### 3. NO Admin Audit Log
**Problem:** Admin actions only logged to console (`logging.info()`).

**Issues:**
- Not queryable
- Not immutable
- No reason field
- Can't generate audit reports
- Compliance risk

**Exists:** Workspace audit log, PayPal audit log  
**Missing:** Admin action audit log

### 4. NO Session Management
**Problem:** Can't force logout users or revoke tokens.

**Current:** JWT tokens in localStorage, no server-side revocation.

**Impact:** 
- Compromised accounts stay logged in
- Can't force logout abusive users
- No session tracking

---

## 📊 AUTHORIZATION STRUCTURE

### Current (Single Admin Level)
```python
@api_router.put("/admin/users/{user_id}/...")
async def admin_action(
    user_id: str,
    current_user: User = Depends(require_admin)  # Only checks role == "admin"
):
    logging.info(f"[ADMIN] User {current_user.id} performed action")
    # ... action code ...
```

### Missing
- ❌ `require_super_admin()` dependency
- ❌ Role hierarchy (super-admin > admin)
- ❌ Structured audit log writes
- ❌ Reason field for sensitive actions

---

## 🎯 ASSUMPTIONS

### 1. Super-Admin Implementation
- Will add `SUPER_ADMIN` role to enum
- Will create `require_super_admin()` dependency
- Will manually promote specific admins in database
- Dangerous actions (ownership transfer, hard delete) require super-admin

### 2. Admin Audit Log
- Will create new collection: `admin_audit_logs`
- Schema:
  ```python
  {
    "id": str,
    "admin_id": str,          # Who did it
    "target_id": str,         # Who/what was affected
    "action": str,            # What action
    "reason": Optional[str],  # Why (for sensitive actions)
    "metadata": dict,         # Context
    "timestamp": datetime,    # When
    "ip_address": Optional[str]
  }
  ```
- Append-only (no deletions)
- Indexed for queries

### 3. Session Management
- Current JWT system has no server-side revocation
- Options:
  A. Token blacklist (add revoked tokens to DB)
  B. Short-lived tokens + refresh token tracking
  C. Session collection (track all active sessions)
- Will implement Option B (minimal changes)

### 4. Workspace Member Removal
- Existing endpoint: `DELETE /workspaces/{id}/members/{userId}`
- Currently requires workspace owner permission
- Will add admin override (bypass owner check)
- Will prevent removing last owner

### 5. Account Lock vs Disable
- **Disable**: Permanent, admin must re-enable, shows "Account disabled"
- **Lock**: Temporary, auto-expires, shows "Account restricted"
- Both block login at auth layer

### 6. Notifications
- Notification model already exists
- `create_notification()` function already exists
- Will add new types: ADMIN_ACTION, SYSTEM_MESSAGE

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Critical Fixes)
- [ ] Add `SUPER_ADMIN` role to UserRole enum
- [ ] Create `require_super_admin()` dependency
- [ ] Create `AdminAuditLog` model
- [ ] Create `admin_audit_logs` collection
- [ ] **FIX: Add missing restore user endpoint**
- [ ] Add helper function: `log_admin_action()`

### Phase 2: Security & Sessions
- [ ] Add `account_locked_until` field to User model
- [ ] Add `account_lock_reason` field
- [ ] Create session/token blacklist collection
- [ ] Add `POST /admin/users/{id}/force-logout` endpoint
- [ ] Add `POST /admin/users/{id}/lock-account` endpoint
- [ ] Add `POST /admin/users/{id}/unlock-account` endpoint
- [ ] Update auth middleware to check locks and blacklist

### Phase 3: Workspace Management
- [ ] Add `DELETE /admin/workspaces/{id}/members/{userId}` endpoint
- [ ] Add `POST /admin/workspaces/{id}/transfer-ownership` endpoint
- [ ] Add ownership transfer validation (prevent last owner removal)
- [ ] Add full workspace audit trail

### Phase 4: Invitations
- [ ] Add `GET /admin/invitations` endpoint (list all pending)
- [ ] Add `DELETE /admin/invitations/{id}` endpoint (revoke)
- [ ] Add `POST /admin/invitations/{id}/force-accept` endpoint
- [ ] Add `POST /admin/invitations/{id}/force-expire` endpoint

### Phase 5: Communication & Misc
- [ ] Add `POST /admin/notifications/send` endpoint
- [ ] Add `max_upload_size_override` field to User model
- [ ] Add UI for admin email verification override
- [ ] Add admin audit log viewer in frontend

### Phase 6: Frontend UI
- [ ] Add force logout action to user dropdown
- [ ] Add account lock dialog
- [ ] Add workspace transfer dialog (super-admin only)
- [ ] Add invitation management tab
- [ ] Add system notification sender
- [ ] Add audit log viewer tab
- [ ] Update all actions to show loading states
- [ ] Add reason input for sensitive actions

---

## ⚠️ GUARDRAILS (Non-Negotiable)

Every new admin action MUST:

1. ✅ **Be permission-checked** (Admin vs Super-Admin)
2. ✅ **Be logged to admin audit log** with:
   - admin_id
   - target_id  
   - action
   - timestamp
   - optional reason
3. ✅ **Validate inputs strictly** (no SQL injection, XSS, etc.)
4. ✅ **Live under `/api/admin/*`** path
5. ✅ **Return clear error messages** (no stack traces to frontend)
6. ✅ **Have matching frontend UI** (no orphaned endpoints)

NEVER:
- ❌ Allow direct DB field editing from UI
- ❌ Show/edit user passwords
- ❌ Allow content impersonation
- ❌ Trust frontend role checks alone
- ❌ Reuse user-facing endpoints for admin actions
- ❌ Delete user data without confirmation
- ❌ Skip audit logging

---

## 🧪 VERIFICATION CHECKLIST

Before declaring complete, verify:

- [ ] All existing admin actions still work
- [ ] New actions appear only for authorized admins
- [ ] Super-admin actions appear only for super-admins
- [ ] Audit log records every action with all required fields
- [ ] No user data deleted unintentionally
- [ ] Frontend doesn't crash when permissions insufficient
- [ ] Backend authorization can't be bypassed from frontend
- [ ] Session revocation actually logs users out
- [ ] Account locks expire automatically
- [ ] Workspace transfers preserve all data
- [ ] Last owner can't be removed from workspace
- [ ] Forced logouts clear all sessions
- [ ] Admin audit log is queryable
- [ ] Restore user endpoint works
- [ ] All dropdowns show correct actions based on user state

---

**STATUS: AUDIT COMPLETE - READY FOR IMPLEMENTATION APPROVAL**
