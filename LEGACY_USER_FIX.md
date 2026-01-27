# LEGACY USER FIX - ROOT CAUSE & SOLUTION

**Commit:** `6e25545` - LEGACY USER FIX  
**Issue:** Existing PayPal subscribers show no subscription status  
**User:** support@interguide.app (and all pre-refactor subscribers)

---

## ROOT CAUSE IDENTIFIED

### Problem: Cached Terminal States Without Billing Info

**What Happened:**

1. **Before Canonical Refactor:**
   - Users subscribed via PayPal
   - Subscription stored in database with `paypal_verified_status: "ACTIVE"`
   - Billing timestamps (`next_billing_time`, `final_payment_time`) **may not have been stored**
   - System relied on status strings, not timestamps

2. **After Canonical Refactor:**
   - `/api/users/me/plan` endpoint changed to canonical structure
   - Calls `reconcile_subscription_with_paypal(force=False)`
   - Reconciliation checks if status is terminal (ACTIVE, CANCELLED, etc.)
   - **If terminal, skips PayPal API call and returns cached data**
   - Cached data in skip path (lines 7292-7301) **did not include `billing_info`**

3. **Result for Legacy Users:**
   - Reconciliation skipped (ACTIVE is terminal)
   - Response: `{ success: true, access_granted: true, billing_info: MISSING }`
   - `/users/me/plan` tries to extract `next_billing_time` from `billing_info`
   - Gets `None` → `access_until = None`
   - Frontend receives: `{ access_granted: false, access_until: null }`
   - **UI shows no subscription status**

---

## FIX APPLIED (THREE-PART)

### Part 1: Include Billing Info in Skipped Response

**File:** `backend/server.py:7285-7302`

**Before:**
```python
return {
    "success": True,
    "access_granted": access_granted,
    "is_terminal_for_polling": True,
    "skipped": True
    # billing_info: MISSING!
}
```

**After:**
```python
return {
    "success": True,
    "access_granted": access_granted,
    "is_terminal_for_polling": True,
    "billing_info": {
        "last_payment_time": subscription.last_payment_time,
        "next_billing_time": subscription.next_billing_time,
        "final_payment_time": subscription.final_payment_time
    },
    "skipped": True
}
```

**Why This Helps:**
- Even when reconciliation is skipped, billing timestamps are returned
- `/users/me/plan` can extract `access_until` from cached data
- Prevents unnecessary PayPal API calls for users with billing data

---

### Part 2: Force Reconciliation for Legacy Users

**File:** `backend/server.py:6032-6046`

**Logic:**
```python
# Check if subscription has billing timestamps
has_billing_timestamps = (
    subscription_doc.get('next_billing_time') or 
    subscription_doc.get('final_payment_time') or 
    subscription_doc.get('last_payment_time')
)

# Force reconciliation if timestamps missing (legacy user)
force_reconciliation = not has_billing_timestamps

reconcile_result = await reconcile_subscription_with_paypal(
    subscription_id=subscription_doc['id'],
    force=force_reconciliation
)
```

**Why This Works:**
- Legacy users: No billing timestamps → `force=True` → Fetches from PayPal → Stores timestamps
- New users: Has billing timestamps → `force=False` → Uses cache → Fast response
- **One-time migration** - After first load, legacy users have timestamps and use cache

---

### Part 3: Add Forensic Logging

**File:** `backend/server.py:6024-6030, 6126-6130`

**Added Logs:**
```python
# Before reconciliation
logging.info(
    f"[GET_PLAN] User {current_user.email} has subscription: "
    f"paypal_verified_status={...}, has_billing_timestamps={...}"
)

# After building response
logging.info(
    f"[GET_PLAN] Returning for {current_user.email}: "
    f"plan={plan_name}, access_granted={access_granted}, access_until={access_until}"
)
```

**Why This Helps:**
- Surfaces exact data being returned
- Shows whether reconciliation was forced or cached
- Identifies which users are affected

---

## VERIFICATION FOR support@interguide.app

### Step 1: Check Backend Logs

**After deployment, when support@interguide.app loads Dashboard:**

**Look for:**
```
[GET_PLAN] User support@interguide.app has subscription: 
  id=abc123, 
  paypal_verified_status=ACTIVE, 
  has_billing_timestamps=False  <-- This indicates legacy user
```

**Then:**
```
[RECONCILE] Fetching from PayPal...  <-- Forced reconciliation triggered
[RECONCILE] PayPal state: status=ACTIVE, next_billing=2026-XX-XX...
```

**Finally:**
```
[GET_PLAN] Returning for support@interguide.app: 
  plan=Pro, 
  access_granted=True, 
  access_until=2026-XX-XXTXX:XX:XX  <-- Now has access_until!
```

---

### Step 2: Check API Response

**Use curl or browser DevTools:**

```bash
curl -H "Authorization: Bearer <token>" \
  https://your-backend.com/api/users/me/plan
```

**Expected Response:**
```json
{
  "plan": "pro",
  "provider": "PAYPAL",
  "access_granted": true,
  "access_until": "2026-02-17T12:00:00+00:00",
  "is_recurring": true,
  "management_url": "https://www.paypal.com/myaccount/autopay/connect/...",
  "quota": {
    "storage_used_bytes": 123456,
    "storage_allowed_bytes": 3221225472,
    "max_file_size_bytes": 157286400,
    ...
  }
}
```

**Required Fields (All Must Be Present):**
- ✅ `plan` = string ("pro" or "free")
- ✅ `provider` = "PAYPAL" or null
- ✅ `access_granted` = boolean
- ✅ `access_until` = ISO timestamp or null
- ✅ `is_recurring` = boolean
- ✅ `management_url` = URL or null
- ✅ `quota.max_file_size_bytes` = number

**Prohibited Fields (Must NOT Be Present):**
- ❌ `subscription` (old object)
- ❌ `trial_period_end`
- ❌ `current_period_end`
- ❌ `cancel_at_period_end`
- ❌ `paypal_verified_status`
- ❌ `cancellation_receipt`

---

### Step 3: Check UI After Fix

**After backend deploys, test with support@interguide.app:**

1. Login
2. Go to Dashboard
3. Click "Upgrade Plan"

**Expected UI:**
- ✅ Pro plan shows: "Manage Subscription in PayPal"
- ✅ Shows: "Status: Active"
- ✅ Shows: "Access until [date]"
- ✅ NO "Select" button on Pro plan
- ✅ All plan names in proper language (not keys)

**If Still Broken:**
- Check browser console for payload validation errors
- Check Network tab for `/api/users/me/plan` response
- Verify response matches canonical schema above

---

## WHY LEGACY USERS WERE BROKEN

**Timeline:**

1. **Pre-Refactor (Before commit 52c02e3):**
   - User subscribes via PayPal
   - Webhook stores: `status: "active"`, maybe some timestamps
   - System relies on status strings
   - `/users/me/plan` returns complex object with `subscription.status`

2. **Refactor Deployed (Commits 52c02e3 → 1703eb3):**
   - Backend changes `/users/me/plan` to canonical structure
   - Calls `reconcile_subscription_with_paypal(force=False)`
   - For ACTIVE users, reconciliation is skipped (terminal state)
   - Skipped response had no `billing_info`
   - `access_until` becomes `None`
   - Frontend receives broken data

3. **Frontend Updated (Commits 8bef112 → 1a1e606):**
   - Frontend expects `access_granted`, `access_until`
   - useQuota extracts these fields
   - But for legacy users, `access_until = None`
   - UI shows no subscription (appears inactive)

4. **Legacy Fix Applied (Commit 6e25545):**
   - Skipped response now includes `billing_info` from cached data
   - If cached data also lacks timestamps, forces fresh reconciliation
   - Fresh reconciliation fetches from PayPal → stores timestamps → returns complete data
   - **Next load uses cached timestamps** (one-time migration)

---

## EXPECTED OUTCOME

### First Load (After Deploy)
**For support@interguide.app:**
1. Loads `/api/users/me/plan`
2. Backend detects: `has_billing_timestamps = False`
3. **Forces reconciliation** (`force=True`)
4. Fetches from PayPal API
5. PayPal returns: `status: ACTIVE, next_billing_time: 2026-XX-XX`
6. Backend stores timestamps to database
7. Returns canonical response with `access_granted: true, access_until: 2026-XX-XX`
8. Frontend displays: "Status: Active • Access until [date]"

### Subsequent Loads
1. Loads `/api/users/me/plan`
2. Backend detects: `has_billing_timestamps = True`
3. **Uses cached data** (`force=False`, skips PayPal API)
4. Returns billing_info from cached subscription doc
5. Fast response, no PayPal API call

---

## MIGRATION STRATEGY

**This is a self-healing migration:**
- No manual database update required
- No migration script needed
- Happens automatically on first `/users/me/plan` load per user
- One-time PayPal API call per legacy user
- Subsequent calls use cache

**Affected Users:**
- Anyone who subscribed before commit `52c02e3` (2026-01-27)
- Subscriptions created after that commit already have billing timestamps

**Performance Impact:**
- First load: +1 PayPal API call (one-time per legacy user)
- Subsequent loads: Cached (no API call)

---

## VERIFICATION COMMANDS

### Check Backend Logs (Render)

```bash
# Look for support@interguide.app logs
grep "support@interguide.app" logs.txt

# Should show:
[GET_PLAN] User support@interguide.app has subscription: has_billing_timestamps=False
[RECONCILE] Fetching from PayPal for subscription...
[GET_PLAN] Returning for support@interguide.app: access_granted=True, access_until=2026-...
```

### Check Database (MongoDB)

```javascript
// Find support@interguide.app subscription
db.subscriptions.findOne({ 
  user_id: "<user_id>", 
  provider: "paypal" 
})

// BEFORE FIX:
{
  paypal_verified_status: "ACTIVE",
  next_billing_time: null,  // Missing!
  final_payment_time: null  // Missing!
}

// AFTER FIX (after first load):
{
  paypal_verified_status: "ACTIVE",
  next_billing_time: "2026-02-17T12:00:00Z",  // Now present!
  final_payment_time: null,
  last_payment_time: "2026-01-17T12:00:00Z"
}
```

### Test API Response (Browser)

```javascript
// In browser console (logged in as support@interguide.app)
fetch('/api/users/me/plan', {
  headers: { 
    'Authorization': 'Bearer ' + localStorage.getItem('token') 
  }
})
.then(r => r.json())
.then(d => {
  console.log('PLAN RESPONSE:', d);
  console.log('access_granted:', d.access_granted);
  console.log('access_until:', d.access_until);
  console.log('plan type:', typeof d.plan);
});
```

**Expected Output:**
```
PLAN RESPONSE: { plan: "pro", provider: "PAYPAL", access_granted: true, ... }
access_granted: true
access_until: "2026-02-17T12:00:00+00:00"
plan type: "string"
```

---

## COMPLETION CRITERIA

**Can confirm "fixed" only if:**

✅ Backend logs show forced reconciliation for support@interguide.app  
✅ API response has `access_granted: true`  
✅ API response has `access_until` with future date  
✅ UI displays "Status: Active"  
✅ Upgrade buttons disabled  
✅ Translations display correctly

**If ANY of these fail, report:**
- Exact API response
- Exact backend logs
- Exact browser console errors

---

## DEPLOYMENT STATUS

**Commit:** `6e25545`  
**Deployed:** YES  
**Logs:** Check Render dashboard for `[GET_PLAN]` and `[RECONCILE]` entries  
**Next:** Login as support@interguide.app and verify UI

**Expected:** First load triggers reconciliation, stores timestamps, UI displays correctly.
