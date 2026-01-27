# CRITICAL: PAYPAL CREDENTIALS INVALID

**Status:** Production is broken - payments cannot be verified  
**Impact:** All subscribers stuck on Free plan, double payments occurring  
**Affected User:** support@interguide.app (paid twice, no access)

---

## ERROR EVIDENCE

**Backend logs:**
```
ERROR:root:Failed to get PayPal access token: 401
ERROR:root:[RECONCILE] Failed to fetch PayPal details for subscription 80396013-c072-45f3-a158-cf9544181eeb
WARNING:root:[GET_PLAN] Reconciliation failed for user support@interguide.app: PayPal API unavailable or subscription not found
```

**HTTP 401** = Unauthorized → Invalid Client ID or Secret

---

## WHY THIS BREAKS EVERYTHING

### Payment Flow (BROKEN)

1. User completes PayPal payment ✅
2. PayPal approves subscription ✅
3. Frontend polls `/api/billing/reconcile` ✅
4. Backend tries to verify with PayPal API ❌ **401 ERROR**
5. Reconciliation fails ❌
6. Returns `access_granted: false` ❌
7. Frontend keeps polling forever ❌
8. Page never refreshes ❌
9. User stuck on "Waiting for activation..." ❌
10. User tries again → **DOUBLE PAYMENT** ❌

### Database State

**Subscription exists:**
```
id: 80396013-c072-45f3-a158-cf9544181eeb
user_id: <support@interguide.app>
provider: paypal
provider_subscription_id: <PayPal subscription ID>
```

**But cannot verify because PayPal API returns 401**

---

## FIX STEPS (DO THIS NOW)

### Step 1: Get Valid PayPal Credentials

**Go to:** https://developer.paypal.com/dashboard/

1. Login to your PayPal Developer account
2. Go to **"My Apps & Credentials"**
3. Check which mode you're using:
   - **Sandbox** (testing): Use sandbox credentials
   - **Live** (production): Use live credentials
4. Copy your credentials:
   - **Client ID**
   - **Secret** (click "Show" to reveal)

**IMPORTANT:** Sandbox and Live credentials are different! Make sure you're using the right ones.

---

### Step 2: Update Render Environment Variables

**Go to:** https://dashboard.render.com

1. Select your backend service
2. Go to **"Environment"** tab
3. Update these variables:

**For Sandbox (Testing):**
```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<your sandbox client ID>
PAYPAL_CLIENT_SECRET=<your sandbox secret>
```

**For Live (Production):**
```
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=<your live client ID>
PAYPAL_CLIENT_SECRET=<your live secret>
```

4. Click **"Save Changes"**
5. Service will auto-redeploy

---

### Step 3: Verify Fix

**Check backend logs after redeploy:**

**Before (BROKEN):**
```
ERROR:root:Failed to get PayPal access token: 401
```

**After (FIXED):**
```
[GET_PLAN] Reconciliation success: access_granted=True, plan=pro
```

---

### Step 4: Manually Reconcile support@interguide.app

**After fixing credentials, the user needs manual reconciliation:**

**Option A: User triggers reconciliation (Frontend)**
1. Login as support@interguide.app
2. Go to Dashboard
3. The system will auto-reconcile on page load

**Option B: Admin API call (Backend)**
```bash
curl -X POST https://your-backend.com/api/billing/reconcile \
  -H "Authorization: Bearer <support@interguide.app token>"
```

**Option C: Database manual fix (Last resort)**
```javascript
// MongoDB shell
db.subscriptions.updateOne(
  { user_id: "<support@interguide.app user_id>", provider: "paypal" },
  { 
    $set: { 
      paypal_verified_status: "ACTIVE",
      status: "active",
      last_verified_at: new Date().toISOString()
    } 
  }
)
```

---

## VERIFICATION CHECKLIST

After fixing credentials:

### 1. Backend Health Check
```bash
# Check if backend can get PayPal token
curl -X GET https://your-backend.com/api/health
```

**Look for:**
- ✅ No 401 errors in logs
- ✅ Successful PayPal API calls

### 2. User Status Check (support@interguide.app)

**API response for `/api/users/me/plan`:**
```json
{
  "plan": "pro",
  "access_granted": true,
  "access_until": "2026-XX-XX",
  "provider": "PAYPAL"
}
```

**If still `"plan": "free"` after 5 minutes:**
- Force refresh: Ctrl+Shift+R (clear cache)
- Or trigger manual reconciliation

### 3. New Payment Test

**Test with a different account:**
1. Subscribe via PayPal
2. After approval, page should:
   - Show "Pro access activated!" toast
   - Auto-refresh within 5 seconds
   - Display Pro plan status

---

## REFUND DOUBLE PAYMENT

**User support@interguide.app paid twice due to this bug.**

### Option 1: Refund via PayPal Dashboard
1. Go to: https://www.paypal.com/activity
2. Find the duplicate payment
3. Click "Issue Refund"

### Option 2: Cancel One Subscription
1. Go to: https://www.paypal.com/myaccount/autopay
2. Find both subscriptions for support@interguide.app
3. Cancel one of them (keep the other active)

**After refunding/canceling, reconcile the remaining subscription.**

---

## WHY CREDENTIALS EXPIRED

**Possible causes:**
1. **Rotated credentials** in PayPal dashboard but forgot to update Render
2. **Switched from Sandbox → Live** but Render still has sandbox credentials
3. **PayPal app was disabled/deleted** in developer dashboard
4. **Environment variable typo** (extra space, wrong key name)

**Check:**
- Render env var `PAYPAL_CLIENT_ID` matches PayPal dashboard
- Render env var `PAYPAL_MODE` matches credential type (sandbox vs live)

---

## TEMPORARY WORKAROUND (UNTIL CREDENTIALS FIXED)

**If you can't fix credentials immediately:**

### Add Manual Activation Button

**In `BillingInfo.jsx` or admin panel:**
```javascript
// Admin-only button to manually activate subscription
<Button onClick={async () => {
  await api.post('/admin/force-activate-subscription', {
    user_email: 'support@interguide.app'
  });
}}>
  Manually Activate Subscription
</Button>
```

**Backend endpoint:**
```python
@api_router.post("/admin/force-activate-subscription")
async def force_activate(
    data: dict,
    admin_user: User = Depends(require_admin)
):
    email = data.get('user_email')
    user = await db.users.find_one({"email": email})
    
    subscription = await db.subscriptions.find_one({
        "user_id": user['id'],
        "provider": "paypal"
    })
    
    if subscription:
        await db.subscriptions.update_one(
            {"id": subscription['id']},
            {"$set": {
                "paypal_verified_status": "ACTIVE",
                "status": "active",
                "last_verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"success": True}
    
    return {"success": False, "error": "No subscription found"}
```

---

## PREVENTION

**To prevent this in the future:**

1. **Monitor credentials expiration**
   - Add alert if PayPal API returns 401
   - Email admin when credentials fail

2. **Add health check endpoint**
   ```python
   @api_router.get("/health/paypal")
   async def paypal_health_check():
       try:
           token = await get_paypal_access_token()
           return {"status": "healthy", "token_obtained": bool(token)}
       except Exception as e:
           return {"status": "unhealthy", "error": str(e)}
   ```

3. **Add credentials to monitoring dashboard**
   - Check `/health/paypal` every 5 minutes
   - Alert if unhealthy

---

## SUMMARY

**Problem:** PayPal API credentials invalid (401 error)  
**Impact:** Payments accepted but not verified → users stuck on Free plan  
**Fix:** Update `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in Render  
**User:** support@interguide.app needs manual reconciliation after fix  
**Refund:** Issue refund for duplicate payment

**UNTIL CREDENTIALS ARE FIXED, ALL PAYMENTS WILL FAIL TO ACTIVATE.**
