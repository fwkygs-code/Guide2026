# SECURITY INVARIANTS - NON-NEGOTIABLE RULES

## Status: LOCKED
## Date: Current
## Purpose: Document verified security invariants that MUST NOT be violated

---

## ⚠️ CRITICAL: THESE RULES ARE NON-NEGOTIABLE

Any code change that violates these invariants MUST be rejected.

---

## INVARIANT 1: SHARED WORKSPACE ACCESS ENFORCEMENT

### Rule
**ALL shared workspace access MUST pass through `check_workspace_access()`**

### Enforcement
- **Function**: `check_workspace_access()` (backend/server.py:882-970)
- **Applies to**: All workspace endpoints except public portal (read-only)
- **Checks**:
  1. Owner check (line 893): Owners always allowed
  2. Grace period expiration (line 903-915): Expired grace → 403
  3. Free plan check (line 924-929): Free plan → 403
  4. Expired subscription check (line 934-939): EXPIRED subscription → 403
  5. Membership status (line 968): Only ACCEPTED members allowed

### Violation Detection
- **Guard**: All workspace endpoints MUST call `check_workspace_access()` or `is_workspace_owner()`
- **Exception**: Public portal endpoints (`/portal/{slug}`) are intentionally unauthenticated
- **Test**: Regression guard checks all workspace endpoints

### Proof
- 39 workspace endpoints verified
- All use `check_workspace_access()` or equivalent
- Quota endpoint fixed to use `check_workspace_access()`

---

## INVARIANT 2: FROZEN MEMBERSHIP RESTORATION

### Rule
**Frozen memberships CANNOT become active without resubscription**

### Enforcement
- **Freeze Location**: EXPIRED webhook (backend/server.py:6818-6830)
  - Sets `status` → PENDING
  - Sets `frozen_reason` → "subscription_expired"
  - Sets `frozen_at` → timestamp

- **Restore Location**: ACTIVATED webhook (backend/server.py:6620-6636)
  - Only restores if `frozen_reason == "subscription_expired"`
  - Only restores if `status == PENDING`
  - Changes `status` → ACCEPTED
  - Clears `frozen_reason` and `frozen_at`

### Violation Detection
- **Guard**: No code path can set ACCEPTED status for memberships with `frozen_reason == "subscription_expired"`
- **Test**: Regression guard verifies frozen memberships cannot be activated

### Proof
- Accept invitation endpoint checks `can_user_share_workspaces()` (line 2316)
- `check_workspace_access()` blocks Free users (line 924-929)
- Only ACTIVATED webhook restores frozen memberships (line 6620-6636)

---

## INVARIANT 3: GRACE PERIOD DETERMINISTIC EXPIRATION

### Rule
**Grace periods MUST expire deterministically on every authenticated request**

### Enforcement
- **Check Location**: `get_current_user()` (backend/server.py:763-800)
- **Trigger**: Every authenticated request
- **Action**: If `grace_ends_at <= now` → Downgrade to Free

### Violation Detection
- **Guard**: Grace period expiration MUST be checked in `get_current_user()`
- **Test**: Regression guard verifies grace period check exists

### Proof
- Checked on every request (line 763-800)
- Compares `grace_end <= now` (line 772)
- Downgrades immediately if expired (line 786-793)

---

## INVARIANT 4: FREE USER SHARED ACCESS BLOCK

### Rule
**Free users CANNOT access shared workspaces in ANY scenario**

### Enforcement
- **Check Location**: `check_workspace_access()` (backend/server.py:924-929)
- **Applies to**: All non-owner workspace access
- **Exception**: Owners always have access (by design)

### Violation Detection
- **Guard**: Free plan check MUST happen before membership status check
- **Test**: Regression guard verifies Free users are blocked

### Proof
- Free plan check (line 924) happens before membership check (line 963)
- Even ACCEPTED memberships are blocked if user is Free
- Frozen memberships (PENDING) are also blocked

---

## INVARIANT 5: EXPIRED SUBSCRIPTION BLOCK

### Rule
**Users with EXPIRED subscriptions CANNOT access shared workspaces**

### Enforcement
- **Check Location**: `check_workspace_access()` (backend/server.py:934-939)
- **Applies to**: Pro plan users with EXPIRED subscriptions

### Violation Detection
- **Guard**: Subscription status check MUST happen for Pro plan users
- **Test**: Regression guard verifies EXPIRED subscriptions are blocked

### Proof
- Subscription status checked (line 933-939)
- EXPIRED status → 403 error
- Blocks access even if plan_id is Pro

---

## INVARIANT 6: MEMBERSHIP FREEZE ON DOWNGRADE

### Rule
**When user downgrades to Free, ALL ACCEPTED memberships MUST be frozen**

### Enforcement
- **Location**: EXPIRED webhook (backend/server.py:6818-6830)
- **Action**: Updates all ACCEPTED memberships to PENDING with `frozen_reason`

### Violation Detection
- **Guard**: EXPIRED webhook MUST freeze memberships before downgrading user
- **Test**: Regression guard verifies memberships are frozen on downgrade

### Proof
- `update_many()` freezes all ACCEPTED memberships (line 6818-6830)
- Sets `frozen_reason = "subscription_expired"` (line 6827)
- Happens before user downgrade (line 6832)

---

## INVARIANT 7: MEMBERSHIP RESTORATION ON RESUBSCRIBE

### Rule
**When user resubscribes, ONLY frozen memberships are restored**

### Enforcement
- **Location**: ACTIVATED webhook (backend/server.py:6620-6636)
- **Filter**: `status == PENDING AND frozen_reason == "subscription_expired"`
- **Action**: Restores to ACCEPTED, clears freeze metadata

### Violation Detection
- **Guard**: Restoration MUST filter by `frozen_reason`
- **Test**: Regression guard verifies only frozen memberships restored

### Proof
- Filter includes `frozen_reason == "subscription_expired"` (line 6624)
- New pending invitations (no `frozen_reason`) are NOT restored
- Only previously frozen memberships restored

---

## INVARIANT 8: NO DATA DELETION ON DOWNGRADE

### Rule
**User downgrade MUST NOT delete workspace memberships**

### Enforcement
- **Location**: EXPIRED webhook (backend/server.py:6818-6830)
- **Action**: Uses `update_many()` not `delete_many()`

### Violation Detection
- **Guard**: No `delete_many()` calls on `workspace_members` in downgrade path
- **Test**: Regression guard verifies memberships preserved

### Proof
- Uses `update_many()` (line 6818)
- Changes status, does not delete
- Data preserved for restoration

---

## INVARIANT 9: WALKTHROUGH QUOTA ENFORCEMENT

### Rule
**Walkthrough creation MUST enforce user-level quota limits**

### Enforcement
- **Location**: Walkthrough creation endpoint (backend/server.py:3186-3218)
- **Check**: User-level quota across all workspaces
- **Respects**: Custom quota overrides

### Violation Detection
- **Guard**: Walkthrough creation MUST check quota before creating
- **Test**: Regression guard verifies quota check exists

### Proof
- Quota check happens before creation (line 3186-3218)
- Counts across all user's workspaces (line 3197-3214)
- Blocks creation if quota exceeded (line 3216-3221)

---

## INVARIANT 10: NO FRONTEND BYPASS

### Rule
**Frontend state CANNOT override backend enforcement**

### Enforcement
- **Location**: All workspace endpoints
- **Method**: Backend checks on every request
- **Source of Truth**: Database (not frontend state)

### Violation Detection
- **Guard**: All endpoints MUST check database state, not trust frontend
- **Test**: Regression guard verifies no endpoints trust frontend state

### Proof
- All endpoints read from database (line 898, 924, 933)
- No caching of plan/subscription status
- Database is authoritative

---

## REGRESSION GUARD REQUIREMENTS

### Guard 1: Workspace Access Check
- **Purpose**: Ensure all workspace endpoints use `check_workspace_access()`
- **Method**: Static analysis or runtime check
- **Location**: Startup or test suite

### Guard 2: Frozen Membership Protection
- **Purpose**: Prevent frozen memberships from being activated incorrectly
- **Method**: Database constraint or code check
- **Location**: Membership update functions

### Guard 3: Grace Period Expiration
- **Purpose**: Ensure grace period check exists in `get_current_user()`
- **Method**: Code check or test
- **Location**: Authentication flow

### Guard 4: Free User Block
- **Purpose**: Ensure Free users cannot access shared workspaces
- **Method**: Test or assertion
- **Location**: `check_workspace_access()` function

---

## VIOLATION CONSEQUENCES

**If any invariant is violated:**
1. Code change MUST be rejected
2. Violation MUST be documented
3. Fix MUST be applied before merge
4. Regression guard MUST be updated

---

## MAINTENANCE

**When modifying workspace access code:**
1. Review this document
2. Verify all invariants still hold
3. Update regression guards if needed
4. Test all attack scenarios

---

**END OF LOCKED INVARIANTS**
