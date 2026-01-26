# Subscription Enforcement Implementation

## Overview

This document describes the strict, server-side subscription enforcement system implemented for workspace, portal, and API access. The system explicitly supports a free tier, grace period, and clean reactivation flow.

**Priority**: Correctness > Simplicity > Reversibility

## Key Principle

There are **three states**, not two:

1. **Free tier user** → always allowed
2. **Paid user with active subscription** → allowed
3. **Paid user with inactive subscription** → blocked (after grace)

**Critical Rules**:
- Never infer intent
- Never block free users
- Never rely on frontend hiding
- All enforcement is server-side only

---

## 1. Subscription State Model

### Database Schema

The system uses existing schema fields:

**User Model** (`users` collection):
- `plan_id`: Reference to plan (free/pro/enterprise)
- `subscription_id`: Reference to active subscription
- `grace_period_ends_at`: Nullable timestamp for grace period end

**Plan Model** (`plans` collection):
- `name`: "free" | "pro" | "enterprise"
- `max_workspaces`, `max_categories`, `max_walkthroughs`: Quota limits
- `storage_bytes`: Storage allocation

**Subscription Model** (`subscriptions` collection):
- `status`: "active" | "cancelled" | "expired" | "pending"
- `provider`: "manual" | "paypal" | "stripe"
- `grace_started_at`: When grace period started
- `grace_ends_at`: When grace period ends

### Single Source of Truth

**Function**: `can_access_paid_features(user_id: str) -> bool`

**Location**: `backend/server.py` (lines 1666-1724)

**Logic**:
```python
async def can_access_paid_features(user_id: str) -> bool:
    # 1. Get user and plan
    # 2. If plan is "free" → return True (always allowed)
    # 3. If paid plan:
    #    a. Check subscription status == "active" → return True
    #    b. Check grace period:
    #       - If within grace period → return True
    #       - If grace expired → return False
    # 4. Default: return False (paid user with no active subscription)
```

**Key Characteristics**:
- No frontend logic
- No cached flags
- No heuristics
- Deterministic evaluation on every request

---

## 2. Grace Period Policy

### Purpose
Reduce accidental churn by providing a buffer period for payment issues.

### Policy Details

**Applies to**: Paid users only (free users never enter grace)

**Duration**: 7 days (configurable via `grace_period_ends_at` field)

**Trigger**: When subscription becomes `past_due`, `cancelled`, or `expired`

**During Grace Period**:
- ✅ Workspace access allowed
- ✅ Portal access allowed
- ✅ API access allowed
- ⚠️ UI may show warning (optional, non-blocking)

**After Grace Period**:
- ❌ Full enforcement kicks in
- ❌ All access blocked until reactivation

**Constraints**:
- No stacking of grace periods
- No auto-extension
- No retry logic in enforcement layer

---

## 3. Server-Side Enforcement

### Enforcement Dependency

**Function**: `require_subscription_access(current_user: User) -> User`

**Location**: `backend/server.py` (lines 1726-1744)

**Behavior**:
- Calls `can_access_paid_features(current_user.id)`
- If access denied: raises `HTTPException(status_code=402)`
- If access allowed: returns user object

### Enforcement Points

All protected routes use `Depends(require_subscription_access)` instead of `Depends(get_current_user)`:

#### Workspace Routes
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/{workspace_id}` - Get workspace
- `PUT /api/workspaces/{workspace_id}` - Update workspace

#### Walkthrough Routes
- `POST /api/workspaces/{workspace_id}/walkthroughs` - Create walkthrough
- `GET /api/workspaces/{workspace_id}/walkthroughs` - List walkthroughs
- `GET /api/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}` - Get walkthrough
- `PUT /api/workspaces/{workspace_id}/walkthroughs/{walkthrough_id}` - Update walkthrough

#### Category Routes
- `POST /api/workspaces/{workspace_id}/categories` - Create category
- `GET /api/workspaces/{workspace_id}/categories` - List categories
- `PUT /api/workspaces/{workspace_id}/categories/{category_id}` - Update category

#### Portal Routes (Owner-Based Enforcement)
Portal routes check the **workspace owner's** subscription status:

- `GET /api/portal/{slug}` - Get portal data
- `GET /api/portal/{slug}/walkthroughs/{walkthrough_id}` - Get public walkthrough
- `POST /api/portal/{slug}/walkthroughs/{walkthrough_id}/access` - Password-protected access
- `GET /api/portal/{slug}/knowledge-systems` - List knowledge systems
- `GET /api/portal/{slug}/knowledge-systems/{system_id}` - Get knowledge system

**Portal Enforcement Logic**:
```python
# Check workspace owner's subscription
owner_id = workspace.get('owner_id')
if owner_id:
    has_access = await can_access_paid_features(owner_id)
    if not has_access:
        raise HTTPException(
            status_code=402,
            detail="This content is currently unavailable."
        )
```

### Constraints

**What enforcement does**:
- ✅ Blocks request before any content is returned
- ✅ Returns HTTP 402 (Payment Required)
- ✅ Provides minimal error message
- ✅ No redirects to login
- ✅ No partial data leaks
- ✅ No metadata exposure

**What enforcement does NOT do**:
- ❌ No client-side checks as fallback
- ❌ No background API calls
- ❌ No read/write access for blocked users
- ❌ No previews or cached data

---

## 4. Blocked State UX

### Workspace Access (Paid User, Inactive Subscription)

**HTTP Response**: `402 Payment Required`

**Error Message**: 
```json
{
  "detail": "Subscription inactive. Please reactivate your subscription to continue."
}
```

**Frontend Behavior** (recommended):
- Render blocked workspace shell
- Display message: "Your subscription is inactive. Your data is safe. Reactivate to continue."
- Show buttons: "Update payment" | "Reactivate subscription"
- No sidebar, no workspace content, no API calls

### Portal Access (Workspace Owner Has Inactive Subscription)

**HTTP Response**: `402 Payment Required`

**Error Message**:
```json
{
  "detail": "This content is currently unavailable."
}
```

**Frontend Behavior** (recommended):
- Render hard block
- Display message only: "This content is currently unavailable."
- No navigation, no system names, no hints
- No client fetches, no hydration of walkthrough data

**Important**: Free users never see this state.

---

## 5. Portal Content Security

### Server-Side Rendering Lock

Portal routes enforce subscription at the API level **before** returning any data:

**What is blocked**:
- ❌ Walkthrough schemas
- ❌ Step arrays
- ❌ JSON blobs
- ❌ `window.__DATA__` hydration
- ❌ Bulk step content

**What is allowed**:
- ✅ Per-request step content (only if owner has active subscription)
- ✅ Minimal error messages (no data leakage)

**Goal**:
- Prevent scraping
- Prevent cloning
- Prevent "export then cancel" abuse
- Keep implementation simple (no DRM, no obfuscation)

---

## 6. Data Handling Rules

### When Subscription Becomes Inactive (After Grace)

**Data Preservation**:
- ✅ All data is preserved
- ✅ No data is deleted
- ✅ No data is mutated

**Access Control**:
- ❌ Workspace → blocked
- ❌ Walkthroughs → read-only internally (no user access)
- ❌ Portal → fully blocked
- ❌ Analytics → frozen

**Free Users**:
- ✅ Completely unaffected by any enforcement

---

## 7. Reactivation Flow

### User Action
1. User clicks "Update payment" or "Reactivate subscription"
2. User completes payment via payment provider (PayPal, Stripe, etc.)

### Backend Processing
3. Payment webhook received
4. Backend updates:
   - `subscription.status = "active"`
   - `user.grace_period_ends_at = None` (clear grace period)
5. Access is **immediately restored** on next request

### Access Restoration
6. Next API request:
   - `can_access_paid_features()` returns `True`
   - Workspace loads normally
   - Portal loads normally
   - API access restored

### Idempotency
- ✅ Safe to retry
- ✅ Safe on refresh
- ✅ Safe on webhook replay
- ✅ No migrations required
- ✅ No rebuilds required
- ✅ No cache invalidation complexity

---

## 8. Implementation Constraints

### What Was NOT Changed

**Unchanged**:
- ❌ No blocking of free users
- ❌ No frontend-only enforcement
- ❌ No data deletion or mutation
- ❌ No export/download features added
- ❌ No DRM or obfuscation
- ❌ No per-page hacks
- ❌ No billing logic changes
- ❌ No dark patterns

**Unchanged Business Logic**:
- UI layouts
- Routing
- Component structure
- Payment provider integration
- Webhook handling (except subscription status updates)

---

## 9. Testing & Verification

### Test Scenarios

#### Scenario 1: Free User Access
**Setup**: User with `plan.name = "free"`
**Expected**: Full access to all features, no blocking

#### Scenario 2: Paid User with Active Subscription
**Setup**: User with `plan.name = "pro"`, `subscription.status = "active"`
**Expected**: Full access to all features

#### Scenario 3: Paid User in Grace Period
**Setup**: 
- User with `plan.name = "pro"`
- `subscription.status = "cancelled"`
- `grace_period_ends_at = NOW + 3 days`
**Expected**: Full access (grace period active)

#### Scenario 4: Paid User After Grace Period
**Setup**:
- User with `plan.name = "pro"`
- `subscription.status = "expired"`
- `grace_period_ends_at = NOW - 1 day`
**Expected**: HTTP 402, access blocked

#### Scenario 5: Portal Access (Owner Inactive)
**Setup**: 
- Workspace owner has inactive subscription
- Public user tries to access portal
**Expected**: HTTP 402, "This content is currently unavailable."

#### Scenario 6: Reactivation
**Setup**: User reactivates subscription (payment webhook)
**Expected**: 
- `subscription.status = "active"`
- `grace_period_ends_at = None`
- Immediate access restoration on next request

### Manual Testing Commands

```bash
# Test workspace access (authenticated)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/workspaces

# Test portal access (public)
curl http://localhost:8000/api/portal/my-workspace-slug

# Expected responses:
# - 200 OK: Access allowed
# - 402 Payment Required: Access blocked
# - 404 Not Found: Resource doesn't exist
```

---

## 10. Code Locations

### Core Functions
- **`can_access_paid_features()`**: Lines 1666-1724
- **`require_subscription_access()`**: Lines 1726-1744

### Enforcement Points
- **Workspace routes**: Lines 3248-3350 (create, get, update)
- **Walkthrough routes**: Lines 3695-3894 (create, get, update)
- **Category routes**: Lines 3546-3602 (create, get, update)
- **Portal routes**: Lines 5062-5228 (get portal, get walkthrough, password access)
- **Knowledge systems**: Lines 4647-4716 (portal knowledge systems)

### Supporting Functions
- **`get_user_plan()`**: Lines 1629-1644
- **`get_user_subscription()`**: Lines 1646-1664

---

## 11. Deployment Checklist

### Pre-Deployment
- [ ] Verify all protected routes use `require_subscription_access`
- [ ] Verify portal routes check workspace owner's subscription
- [ ] Verify free users are never blocked
- [ ] Test grace period logic with various timestamps
- [ ] Test reactivation flow end-to-end

### Post-Deployment
- [ ] Monitor 402 error rates
- [ ] Verify no false positives (free users blocked)
- [ ] Verify no false negatives (paid inactive users accessing)
- [ ] Test reactivation flow in production
- [ ] Monitor webhook processing for subscription updates

### Rollback Plan
If issues arise, the enforcement can be disabled by:
1. Modifying `can_access_paid_features()` to always return `True`
2. Redeploying backend
3. No database changes required

---

## 12. Future Enhancements

### Potential Improvements (Not Implemented)
- Grace period warning UI (non-blocking banner)
- Email notifications before grace period ends
- Subscription status dashboard for admins
- Detailed analytics on blocked access attempts
- A/B testing different grace period durations

### Not Recommended
- ❌ Frontend-only enforcement (security risk)
- ❌ Partial access during grace (complexity)
- ❌ Automatic subscription renewal (user control)
- ❌ Data deletion on expiration (data safety)

---

## Summary

This implementation provides **strict, server-side subscription enforcement** with:

✅ **Three-state model**: Free (always allowed), Paid Active (allowed), Paid Inactive (blocked)

✅ **Grace period**: 7-day buffer for paid users with payment issues

✅ **Server-side only**: No frontend-only checks, no data leaks

✅ **Clean reactivation**: Immediate access restoration on payment

✅ **Data safety**: No deletion, no mutation, full preservation

✅ **Free tier support**: Free users never blocked

✅ **Minimal changes**: No unrelated refactors, reversible implementation

The system is **correct, simple, and reversible** as required.
