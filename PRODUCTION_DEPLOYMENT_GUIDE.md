# Production Deployment Guide - PayPal Subscription System

## Pre-Deployment Checklist

### 1. PayPal Production Setup

#### Create PayPal Production App:
1. Log into [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Switch from Sandbox to **Live** mode
3. Create a new **Live App** (or use existing)
4. Note your **Live Client ID** and **Secret**

#### Configure Production Webhook:
1. Go to **Webhooks** section in PayPal Developer Dashboard
2. Create webhook endpoint: `https://your-backend-domain.com/api/billing/paypal/webhook`
3. Subscribe to events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.DENIED`
   - `PAYMENT.SALE.FAILED`
4. Copy the **Webhook ID** (starts with `WH-`)

#### Create Production Subscription Plan:
1. Go to **Products** → **Recurring Subscriptions**
2. Create product: "Pro Plan - Monthly"
3. Create billing plan with:
   - **Trial period**: 14 days
   - **Recurring amount**: $19.90 USD/month
   - **Billing cycle**: Monthly
4. Copy the **Plan ID** (starts with `P-`)

---

## 2. Environment Variables Configuration

### Backend Environment Variables (Production):

```bash
# PayPal Production Credentials
PAYPAL_CLIENT_ID=<YOUR_LIVE_CLIENT_ID>
PAYPAL_CLIENT_SECRET=<YOUR_LIVE_SECRET>
PAYPAL_WEBHOOK_ID=<YOUR_LIVE_WEBHOOK_ID>
PAYPAL_API_BASE=https://api-m.paypal.com

# Frontend: Update PayPal SDK Client ID in frontend
# (See frontend/src/components/PayPalSubscription.jsx)
```

### ⚠️ CRITICAL: Environment Variable Differences

| Variable | Sandbox | Production |
|----------|---------|------------|
| `PAYPAL_CLIENT_ID` | Sandbox Client ID | **Live Client ID** |
| `PAYPAL_CLIENT_SECRET` | Sandbox Secret | **Live Secret** |
| `PAYPAL_WEBHOOK_ID` | Sandbox Webhook ID | **Live Webhook ID** |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` | `https://api-m.paypal.com` |

---

## 3. Frontend PayPal SDK Configuration

### Update PayPal Client ID:

**File**: `frontend/src/components/PayPalSubscription.jsx`

```javascript
// Change from sandbox client ID to production client ID
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'YOUR_LIVE_CLIENT_ID';
```

### Frontend Environment Variables:

**File**: `.env.production` (or Render environment variables)

```bash
REACT_APP_PAYPAL_CLIENT_ID=<YOUR_LIVE_CLIENT_ID>
```

---

## 4. Deployment Steps (Render.com)

### Step 1: Update Backend Environment Variables

1. Go to **Render Dashboard** → Your Backend Service
2. Navigate to **Environment** tab
3. Update the following variables:

```
PAYPAL_CLIENT_ID=<YOUR_LIVE_CLIENT_ID>
PAYPAL_CLIENT_SECRET=<YOUR_LIVE_SECRET>
PAYPAL_WEBHOOK_ID=<YOUR_LIVE_WEBHOOK_ID>
PAYPAL_API_BASE=https://api-m.paypal.com
```

4. **Save** changes (this will trigger a redeploy)

### Step 2: Update Frontend Environment Variables

1. Go to **Render Dashboard** → Your Frontend Service
2. Navigate to **Environment** tab
3. Add/Update:

```
REACT_APP_PAYPAL_CLIENT_ID=<YOUR_LIVE_CLIENT_ID>
```

4. **Save** changes (this will trigger a redeploy)

### Step 3: Verify Webhook Endpoint

1. After backend redeploy, verify webhook URL is accessible:
   ```
   https://your-backend-domain.com/api/billing/paypal/webhook
   ```
2. Test with PayPal webhook simulator (optional)
3. Confirm webhook is active in PayPal Dashboard

---

## 5. Post-Deployment Verification

### Critical Checks:

- ✅ **Webhook is active** in PayPal Dashboard (shows green/active status)
- ✅ **Backend logs** show PayPal API calls to `api-m.paypal.com` (not sandbox)
- ✅ **Frontend** loads PayPal SDK with production client ID
- ✅ **Test subscription** works end-to-end (use real test card)
- ✅ **Audit logs** are being written (check `paypal_audit_logs` collection)
- ✅ **Admin endpoints** work: `/api/admin/paypal/audit/:subscriptionId`

### Test Subscription Flow:

1. **Create test subscription** with PayPal test card
2. **Verify activation**:
   - Check `/api/users/me/plan` returns Pro plan
   - Check audit logs show ACTIVATED webhook
   - Check `paypal_verified_status = "ACTIVE"`

3. **Test cancellation**:
   - Cancel subscription
   - Verify `paypal_verified_status` updates
   - Check audit logs show cancel_request and cancel_verify

4. **Verify webhook processing**:
   - Check audit logs for webhook_received and webhook_processed
   - Verify subscription status matches PayPal

---

## 6. Production Monitoring

### Monitor These Metrics:

1. **PayPal API Success Rate**:
   - Check audit logs for failed API calls
   - Monitor `http_status_code != 200` in audit logs

2. **Webhook Processing**:
   - Monitor for failed webhook signature verifications
   - Check for unprocessed webhooks

3. **State Validation Warnings**:
   - Monitor logs for `[STATE VALIDATION]` warnings
   - Investigate any CRITICAL violations immediately

4. **Reconciliation**:
   - Monitor reconciliation success rate
   - Check how many PENDING subscriptions get reconciled

### Log Queries (MongoDB):

```javascript
// Check recent audit logs
db.paypal_audit_logs.find().sort({created_at: -1}).limit(10)

// Check failed API calls
db.paypal_audit_logs.find({http_status_code: {$ne: 200}})

// Check unverified actions
db.paypal_audit_logs.find({verified: false})

// Check state validation warnings (in application logs)
// Search logs for: [STATE VALIDATION]
```

---

## 7. Rollback Plan

### If Issues Occur:

1. **Immediate Rollback**:
   - Revert environment variables to sandbox values
   - Redeploy backend and frontend
   - Existing production subscriptions will still work (PayPal processes them)

2. **User Impact**:
   - Users with active subscriptions: **No impact** (PayPal handles billing)
   - Users in trial: **No impact** (trial continues)
   - New subscriptions: **Will use sandbox** (non-functional until switch back)

3. **Data Migration**:
   - Production audit logs are preserved in database
   - No data loss during rollback
   - Can switch back to production after fixing issues

---

## 8. Important Notes

### ⚠️ DO NOT:

- ❌ Mix sandbox and production credentials
- ❌ Use sandbox webhook ID with production API
- ❌ Test with production credentials in development
- ❌ Skip webhook verification in production

### ✅ ALWAYS:

- ✅ Verify webhook signature in production (already implemented)
- ✅ Monitor audit logs for anomalies
- ✅ Keep production credentials secure
- ✅ Test cancellation flow after deployment
- ✅ Verify admin endpoints work

---

## 9. Support & Troubleshooting

### Common Issues:

**Issue**: Webhook not receiving events
- **Check**: Webhook URL is accessible from internet
- **Check**: Webhook is active in PayPal Dashboard
- **Check**: CORS headers allow PayPal requests

**Issue**: Subscription activation not working
- **Check**: Webhook events are being received (check audit logs)
- **Check**: Reconciliation is working for PENDING subscriptions
- **Check**: PayPal Plan ID is correct

**Issue**: Cancellation not working
- **Check**: PayPal API calls are succeeding (check audit logs)
- **Check**: `paypal_verified_status` is being updated
- **Check**: User sees correct cancellation status in UI

### Contact Points:

- **PayPal Support**: [PayPal Developer Support](https://developer.paypal.com/support/)
- **Audit Logs**: Use admin endpoints to review full history
- **State Validation**: Check application logs for `[STATE VALIDATION]` warnings

---

## 10. Final Pre-Production Checklist

Before going live, verify:

- [ ] PayPal production app created with Live credentials
- [ ] Production webhook configured and active
- [ ] Production subscription plan created (Plan ID noted)
- [ ] Backend environment variables updated (PAYPAL_*)
- [ ] Frontend environment variables updated (REACT_APP_PAYPAL_CLIENT_ID)
- [ ] Webhook endpoint accessible from internet
- [ ] Test subscription works end-to-end
- [ ] Cancellation flow works correctly
- [ ] Audit logging is working (check database)
- [ ] Admin endpoints accessible (for disputes)
- [ ] State validation logging is working
- [ ] Monitoring and alerting set up

---

## Quick Reference

### Production URLs:
- **PayPal API**: `https://api-m.paypal.com`
- **PayPal Dashboard**: `https://developer.paypal.com/` (switch to Live mode)
- **Webhook Endpoint**: `https://your-backend-domain.com/api/billing/paypal/webhook`

### Key Files to Update:
- **Backend**: Environment variables (Render Dashboard)
- **Frontend**: `PayPalSubscription.jsx` client ID (or env var)
- **PayPal Dashboard**: Webhook configuration

### Verification Commands:
```bash
# Check backend logs for PayPal API calls
# Should show: api-m.paypal.com (not sandbox)

# Check audit logs in MongoDB
db.paypal_audit_logs.find().sort({created_at: -1}).limit(5)

# Test admin endpoint
curl https://your-backend-domain.com/api/admin/paypal/state/:subscriptionId
```

---

**Status**: System is production-ready. Follow this guide to deploy.