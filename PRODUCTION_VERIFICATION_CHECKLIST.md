# PRODUCTION VERIFICATION CHECKLIST

**Commit:** `b7feb42` - PRODUCTION HARDENING  
**Status:** DEPLOYED - REQUIRES MANUAL VERIFICATION

---

## ⚠️ AUTOMATED TESTING NOT POSSIBLE

**I cannot verify in production because:**
- No browser access
- No ability to click buttons
- No ability to see screenshots
- No ability to read console logs

**You must perform manual verification using the steps below.**

---

## MANDATORY VERIFICATION STEPS

### ✅ STEP 1: Fresh User PayPal Flow

**Actions:**
1. Create new user account (or use test account)
2. Navigate to Dashboard → "Upgrade to Pro"
3. Click "Select" on Pro plan
4. Complete PayPal payment approval
5. **Immediately after approval:**
   - Open DevTools Console BEFORE clicking
   - Look for these logs:
     ```
     [APPROVAL HIT] 1234567890123
     [RELOAD CALLED]
     ```

**Expected Behavior:**
- ✅ Browser navigates to same page immediately
- ✅ No "Waiting for activation" stuck state
- ✅ Page fully reloads (network requests visible)
- ✅ Modal closes automatically

**If This Fails:**
- PayPal approval does NOT trigger navigation
- UI stuck on success message
- **CRITICAL BUG - Payment can be repeated**

---

### ✅ STEP 2: API Response Verification

**Actions:**
1. After page reload, open DevTools → Network tab
2. Find request: `GET /api/users/me/plan`
3. Click to view response body

**Expected Response:**
```json
{
  "plan": "pro",
  "provider": "PAYPAL",
  "access_granted": true,
  "access_until": "2026-XX-XXTXX:XX:XX",
  "is_recurring": true,
  "management_url": "https://www.paypal.com/...",
  "quota": {
    "storage_used_bytes": 0,
    "storage_allowed_bytes": 3221225472,
    "max_file_size_bytes": 157286400,
    ...
  }
}
```

**Required Fields:**
- ✅ `access_granted: true`
- ✅ `plan: "pro"` (string, not object)
- ✅ `provider: "PAYPAL"`
- ✅ `access_until` (future date)
- ✅ `quota.max_file_size_bytes` (number)

**If This Fails:**
- Check console for: `[QUOTA] INVALID PLAN PAYLOAD`
- Backend returning wrong structure
- **CRITICAL BUG - UI cannot converge**

---

### ✅ STEP 3: UI Convergence Check

**Actions:**
1. After payment, go to Dashboard
2. Click "Upgrade Plan" (should show billing info)
3. Inspect Pro plan card

**Expected UI:**
- ✅ Pro plan shows "Manage Subscription in PayPal" button
- ✅ Shows: "Status: Active"
- ✅ Shows: "Access until [date]"
- ✅ Shows: "Renews automatically unless cancelled in PayPal"
- ✅ "Select" button is GONE (not disabled, removed from DOM)

**If This Fails:**
- "Select" button still visible
- Can click to open PayPal modal again
- **CRITICAL BUG - Double payment possible**

---

### ✅ STEP 4: Translation Verification

**Actions:**
1. View upgrade modal with Pro plan
2. Check all text displays

**Expected Text:**
- ✅ "Pro" (not `plans.pro.name`)
- ✅ "14 days free trial" (not `plans.pro.price`)
- ✅ "3 workspaces" (not `plans.pro.features.workspaces`)
- ✅ "Manage Subscription in PayPal" (not `billing.manageSubscriptionInPayPal`)

**If This Fails:**
- Check console for: `[TRANSLATION] MISSING KEY:`
- Translation file not loaded
- Keys incorrect

---

### ✅ STEP 5: Quota Limits Check

**Actions:**
1. Go to any workspace
2. Try to upload a file
3. Check dashboard storage display

**Expected Behavior:**
- ✅ Storage shows "X MB / 3 GB"
- ✅ Can upload files up to 150 MB
- ✅ Workspace limit: 3
- ✅ Categories: Unlimited

**If This Fails:**
- Limits still showing Free plan values
- File upload rejected incorrectly
- **Backend quota not updated**

---

### ✅ STEP 6: Double Payment Prevention

**Actions:**
1. With active subscription, go to "Upgrade Plan"
2. Try to click "Select" on Pro plan

**Expected Behavior:**
- ✅ "Select" button does NOT exist in DOM
- ✅ Only "Manage Subscription in PayPal" button visible
- ✅ Cannot open PayPal modal
- ✅ Cannot initiate second payment

**If This Fails:**
- "Select" button clickable
- PayPal modal opens
- **CRITICAL BUG - User can pay twice**

---

## HARDENING MEASURES APPLIED

### 🔒 A. Synchronous Navigation
**File:** `PayPalSubscription.jsx`

**Before:**
```jsx
onSuccess(); // Unmounts component
setTimeout(() => window.location.reload(), 2000); // Never executes
```

**After:**
```jsx
console.log('[APPROVAL HIT]', Date.now());
console.log('[RELOAD CALLED]');
window.location.replace(window.location.pathname);
return; // No code after
```

**Guarantee:** Navigation happens before ANY React state update

---

### 🔒 B. Payload Validation
**File:** `useQuota.js`

**Added:**
```jsx
if (planData.access_granted === undefined) {
  console.error('[QUOTA] INVALID PLAN PAYLOAD - access_granted missing', planData);
}
if (typeof planData.plan !== 'string') {
  console.error('[QUOTA] INVALID PLAN PAYLOAD - plan must be string', planData);
}
```

**Guarantee:** Silent API contract violations surface immediately

---

### 🔒 C. UI Kill-Switch
**File:** `UpgradePrompt.jsx`

**Before:**
```jsx
<Button disabled={access_granted}>Select</Button>
```

**After:**
```jsx
access_granted ? (
  <ManageButton />
) : (
  <SelectButton />
)
```

**Guarantee:** Payment button removed from render tree when subscribed

---

### 🔒 D. Translation Validation
**File:** `UpgradePrompt.jsx`

**Added:**
```jsx
plans.forEach(plan => {
  if (plan.displayName && plan.displayName.includes('.')) {
    console.error('[TRANSLATION] MISSING KEY:', plan.displayName);
  }
});
```

**Guarantee:** Missing translations fail loudly in console

---

## VERIFICATION OUTCOMES

### ✅ ALL PASS → PRODUCTION READY
If all 6 steps pass:
- Money loss bug fixed
- Double payment impossible
- UI converges correctly
- Translations work
- Quota reflects paid plan

**Action:** Mark as verified, monitor for 24h

---

### ❌ ANY FAIL → ADDITIONAL FIX REQUIRED

**If Step 1 fails (no navigation):**
- Check browser console for errors
- PayPal SDK might be blocking navigation
- Add: `setTimeout(() => window.location.replace('/'), 100);`

**If Step 2 fails (wrong API structure):**
- Backend not deployed
- Check backend logs
- Verify `/api/users/me/plan` endpoint code

**If Step 3 fails (wrong UI):**
- `access_granted` not being set
- Check useQuota console errors
- Verify planData extraction

**If Step 4 fails (translation keys):**
- Check `en.json` has `plans` section
- Verify i18n initialization
- Check browser language settings

**If Step 5 fails (wrong limits):**
- Backend quota calculation wrong
- Check backend plan limits
- Verify database plan document

**If Step 6 fails (can pay twice):**
- `access_granted` not true after payment
- Frontend conditional wrong
- Check quota data in React DevTools

---

## CONSOLE COMMANDS FOR DEBUGGING

**Check quota data:**
```javascript
// In browser console after login
fetch('/api/users/me/plan', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
})
.then(r => r.json())
.then(d => console.log('PLAN DATA:', d));
```

**Check React state:**
```javascript
// Open React DevTools
// Find UpgradePrompt component
// Check props: quotaData.access_granted
```

**Force quota refresh:**
```javascript
// Find useQuota hook in DevTools
// Click "refreshQuota" function
```

---

## PRODUCTION MONITORING

**After deployment, monitor for:**

1. **Console errors:**
   - `[QUOTA] INVALID PLAN PAYLOAD`
   - `[TRANSLATION] MISSING KEY`

2. **User reports:**
   - "Stuck on waiting"
   - "Charged twice"
   - "UI still says Free plan"

3. **PayPal webhooks:**
   - Duplicate subscription IDs from same user
   - Multiple BILLING.SUBSCRIPTION.ACTIVATED events

4. **Backend logs:**
   - Double subscription creation attempts
   - Reconciliation failures

---

## COMPLETION CRITERIA (STRICT)

**I can say "verified" ONLY IF:**
- ✅ You manually test all 6 steps
- ✅ You confirm page navigation happens
- ✅ You confirm API response structure
- ✅ You confirm UI convergence
- ✅ You confirm translations display
- ✅ You confirm double payment impossible

**I CANNOT verify because I have no browser access.**

**You must perform manual verification and report results.**

---

## DEPLOYMENT STATUS

**Commit:** `b7feb42`  
**Hardening:** COMPLETE  
**Manual Verification:** REQUIRED  
**Production Safety:** PENDING CONFIRMATION

**Next Action:** Test in production and report findings.
