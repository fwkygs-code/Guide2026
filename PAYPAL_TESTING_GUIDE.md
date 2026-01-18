# PayPal Subscription Testing Guide

This guide covers how to test PayPal subscriptions in both sandbox and production environments.

## Prerequisites

### 1. PayPal Developer Account

1. Go to [PayPal Developer Portal](https://developer.paypal.com/)
2. Sign up or log in with your PayPal account
3. Navigate to **Dashboard** → **My Apps & Credentials**

### 2. Sandbox Account Setup

1. In PayPal Developer Dashboard, go to **Accounts** → **Sandbox**
2. Create a **Business** account (for receiving payments)
3. Create a **Personal** account (for testing as a customer)
4. Note: Sandbox accounts can be created with fake emails/names for testing

### 3. Create Sandbox Application

1. Go to **My Apps & Credentials**
2. Click **Create App**
3. Name: `Guide2026 Sandbox` (or any name)
4. Select **Merchant** or **Marketplace** as the app type
5. Click **Create App**
6. Copy the **Client ID** and **Secret** (you'll need these)

### 4. Create Subscription Plan in PayPal

1. Log into PayPal Sandbox Business Account:
   - Go to **Sandbox** → **Accounts**
   - Click **Enter sandbox site** next to your Business account
   - Log in with the sandbox credentials

2. Create Subscription Plan:
   - Navigate to **Products** → **Subscriptions** → **Plans**
   - Click **Create Plan**
   - Fill in:
     - **Product Name**: Pro Plan
     - **Billing Cycle**: Monthly
     - **Price**: $9.99 (or your test amount)
   - Click **Create Plan**
   - Copy the **Plan ID** (starts with `P-`)

## Environment Variables Setup

### Backend (.env)

```env
# PayPal Sandbox (for testing)
PAYPAL_CLIENT_ID=your_sandbox_client_id_from_paypal_dashboard
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_from_paypal_dashboard
PAYPAL_WEBHOOK_ID=your_webhook_id_from_paypal_dashboard
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com

# PayPal Production (when ready)
# PAYPAL_CLIENT_ID=your_production_client_id
# PAYPAL_CLIENT_SECRET=your_production_client_secret
# PAYPAL_WEBHOOK_ID=your_production_webhook_id
# PAYPAL_API_BASE=https://api-m.paypal.com
```

### Frontend (.env)

```env
# PayPal Sandbox
REACT_APP_PAYPAL_CLIENT_ID=your_sandbox_client_id_from_paypal_dashboard
REACT_APP_PAYPAL_PLAN_ID=P-XXXXXXXXXXXXX  # Your sandbox plan ID

# PayPal Production (when ready)
# REACT_APP_PAYPAL_CLIENT_ID=your_production_client_id
# REACT_APP_PAYPAL_PLAN_ID=P-XXXXXXXXXXXXX  # Your production plan ID
```

## Webhook Setup (CRITICAL)

### 1. Create Webhook in PayPal Dashboard

1. Go to PayPal Developer Dashboard → **My Apps & Credentials**
2. Select your app → **Webhooks**
3. Click **Add Webhook**
4. **Webhook URL**: `https://your-backend-url.onrender.com/api/billing/paypal/webhook`
   - Replace with your actual backend URL
   - Must be HTTPS (not HTTP)
5. **Event Types** (select these):
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.DENIED`
   - `PAYMENT.SALE.FAILED`
6. Click **Save**
7. Copy the **Webhook ID** (you'll need this for `PAYPAL_WEBHOOK_ID`)

### 2. Test Webhook Delivery

1. In PayPal Dashboard → **Webhooks** → Your webhook
2. Click **Simulate Event**
3. Select `BILLING.SUBSCRIPTION.ACTIVATED`
4. Click **Send Test Event**
5. Check your backend logs to confirm webhook was received

## Testing Workflow

### Step 1: Start Backend with Environment Variables

```bash
cd backend
# Make sure .env file has all PayPal variables set
python server.py
# or if using uvicorn:
uvicorn server:app --reload
```

**Verify**: Check logs for PayPal configuration:
- Should NOT see "PayPal credentials not configured" errors
- Should see successful startup

### Step 2: Start Frontend with Environment Variables

```bash
cd frontend
# Make sure .env file has REACT_APP_PAYPAL_CLIENT_ID and REACT_APP_PAYPAL_PLAN_ID
npm start
```

**Verify**: Check browser console:
- Should NOT see "REACT_APP_PAYPAL_CLIENT_ID environment variable is not set"
- PayPal SDK should load without errors

### Step 3: Test Subscription Creation

1. **Login or Signup** to your app
2. **Navigate to Dashboard** → Click **Upgrade to Pro**
3. **Verify PayPal Button** appears:
   - Should show PayPal button (gold/pill shape)
   - Should NOT show "PayPal is not configured" error

4. **Click Subscribe**:
   - PayPal popup should open
   - Should show your subscription plan details

5. **Complete Payment** (use Sandbox Personal account):
   - Click **Subscribe Now** in PayPal popup
   - Use PayPal Sandbox Personal account credentials
   - OR use PayPal test card: `4032034148668781` (any future expiry, any CVV)

6. **Verify Subscription Created**:
   - Should see success message: "Subscription created successfully! Your Pro access will be activated shortly."
   - Backend should log: `PayPal subscription created: user=..., subscription_id=..., paypal_subscription_id=...`

### Step 4: Test Webhook Activation

**Automatic (Recommended)**:
- Wait 1-2 minutes after subscription creation
- PayPal usually sends `BILLING.SUBSCRIPTION.ACTIVATED` webhook automatically
- Check backend logs for webhook receipt

**Manual**:
1. Go to PayPal Developer Dashboard → **Webhooks** → Your webhook
2. Click **Simulate Event** → Select `BILLING.SUBSCRIPTION.ACTIVATED`
3. Click **Send Test Event**
4. Check backend logs

**Verify**:
- Backend logs: `PayPal subscription activated: user=..., subscription=...`
- Frontend: Refresh quota → Should show Pro plan (after webhook)
- User should have Pro access

### Step 5: Verify Pro Access

1. **Check Plan Status**:
   - Go to Dashboard
   - Check quota display → Should show "Pro" plan
   - Try Pro features (create workspace, upload large file, etc.)

2. **Check Subscription Status**:
   - Backend: `/api/users/me/plan` should return `subscription.status: "active"`
   - Frontend: Upgrade dialog should show "Manage Subscription" button (not "Subscribe")

### Step 6: Test Subscription Cancellation

1. **Cancel in PayPal**:
   - Go to [PayPal Sandbox Site](https://www.sandbox.paypal.com/)
   - Log in with your test Business account
   - Go to **Profile** → **My money** → **Preapproved payments** (or **Autopay**)
   - Find your subscription → Click **Cancel**

2. **Wait for Webhook**:
   - PayPal will send `BILLING.SUBSCRIPTION.CANCELLED` webhook
   - Or manually simulate it in PayPal Dashboard

3. **Verify**:
   - Backend logs: `PayPal subscription cancelled: user=..., subscription=...`
   - User keeps Pro access (via `user.plan_id`) until EXPIRED
   - Subscription status becomes `CANCELLED`

### Step 7: Test Subscription Expiration

1. **Wait for Expiration** (or simulate):
   - Wait until billing period ends
   - OR simulate `BILLING.SUBSCRIPTION.EXPIRED` webhook in PayPal Dashboard

2. **Verify**:
   - Backend logs: `PayPal subscription expired: user=..., subscription=...`
   - User downgraded to Free plan
   - Subscription status becomes `EXPIRED`

## Debugging Checklist

### Frontend Issues

**PayPal button doesn't appear**:
- ✅ Check `REACT_APP_PAYPAL_CLIENT_ID` is set in `.env`
- ✅ Check browser console for errors
- ✅ Verify PayPal SDK script loaded (check Network tab)

**PayPal popup doesn't open**:
- ✅ Check `REACT_APP_PAYPAL_PLAN_ID` is set correctly
- ✅ Verify plan ID matches your PayPal plan ID
- ✅ Check browser popup blocker isn't blocking it

**Subscription creation fails**:
- ✅ Check backend is running and accessible
- ✅ Check `api.subscribePayPal` API call in Network tab
- ✅ Check backend logs for errors

### Backend Issues

**Webhook not received**:
- ✅ Verify `PAYPAL_WEBHOOK_ID` is set correctly
- ✅ Check webhook URL is correct (must be HTTPS in production)
- ✅ Check webhook URL is accessible (not behind firewall)
- ✅ Verify webhook is enabled in PayPal Dashboard

**Webhook signature verification fails**:
- ✅ Check `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are correct
- ✅ Check `PAYPAL_API_BASE` is correct (sandbox vs production)
- ✅ Check backend logs for verification errors
- ✅ Verify webhook headers are being received (check logs)

**Subscription not activating**:
- ✅ Check webhook `BILLING.SUBSCRIPTION.ACTIVATED` is being received
- ✅ Check backend logs for webhook processing
- ✅ Verify subscription record exists in database
- ✅ Check `user.plan_id` is being updated (should be Pro plan ID)

### Database Verification

**Check subscription record**:
```javascript
// In MongoDB or your database client
db.subscriptions.find({ "provider": "paypal" }).pretty()
// Should show: status, provider_subscription_id, user_id, plan_id
```

**Check user plan**:
```javascript
db.users.find({ "subscription_id": "your_subscription_id" }).pretty()
// Should show: subscription_id, plan_id (Pro plan ID if active)
```

## Testing Checklist

- [ ] PayPal button appears on upgrade dialog
- [ ] PayPal popup opens when clicking subscribe
- [ ] Can complete payment with Sandbox account
- [ ] Subscription created (backend logs show subscription record)
- [ ] Webhook `BILLING.SUBSCRIPTION.ACTIVATED` received
- [ ] User upgraded to Pro (plan status = Pro)
- [ ] Pro features are accessible
- [ ] "Manage Subscription" button appears (not "Subscribe")
- [ ] Cancellation works (webhook received, status = CANCELLED)
- [ ] User keeps Pro access after cancellation (until EXPIRED)
- [ ] Expiration works (webhook received, downgrade to Free)
- [ ] No payment credentials stored in database (only subscription IDs)
- [ ] Webhook signature verification works (no 401 errors)
- [ ] Idempotency works (duplicate webhook events ignored)

## Common Issues

### Issue: "PayPal is not configured" error

**Solution**: Set `REACT_APP_PAYPAL_CLIENT_ID` in frontend `.env` file

### Issue: Webhook 401 (Unauthorized)

**Solution**: 
- Check `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` are correct
- Check `PAYPAL_API_BASE` matches your environment (sandbox vs production)
- Verify webhook ID matches the one in PayPal Dashboard

### Issue: Webhook not received

**Solution**:
- Check webhook URL is correct and accessible
- Verify webhook is enabled in PayPal Dashboard
- Check backend logs for incoming requests
- Try simulating a test event in PayPal Dashboard

### Issue: Subscription not activating

**Solution**:
- Check if `BILLING.SUBSCRIPTION.ACTIVATED` webhook is being received
- Verify webhook signature verification is passing
- Check subscription record in database (status should be PENDING initially)
- Manually simulate `BILLING.SUBSCRIPTION.ACTIVATED` webhook if needed

### Issue: Payment credentials stored locally

**Solution**:
- Verify only `subscription_id` and `provider_subscription_id` are stored
- No card numbers, billing addresses, or PayPal tokens should be stored
- Check `backend/server.py` line 3044 - should only store `subscription_id`

## Production Checklist

Before going to production:

- [ ] Switch to production PayPal credentials
- [ ] Update `PAYPAL_API_BASE` to `https://api-m.paypal.com`
- [ ] Create production subscription plan in PayPal
- [ ] Update `REACT_APP_PAYPAL_PLAN_ID` to production plan ID
- [ ] Set up production webhook URL (HTTPS required)
- [ ] Test with real PayPal account (small amount first)
- [ ] Monitor webhook delivery in PayPal Dashboard
- [ ] Set up webhook delivery monitoring/alerts
- [ ] Review all policy pages are accessible
- [ ] Verify all legal text is correct ("PayPal processes payments")

## Quick Test Commands

```bash
# Test backend PayPal config
curl https://your-backend.onrender.com/api/billing/paypal/subscribe \
  -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionID": "test-id"}'
# Should return 400 (invalid subscription ID) or 400 (already subscribed), not 500

# Test webhook endpoint (from PayPal)
# PayPal will automatically send webhooks when events occur
# Check backend logs for webhook receipt
```

## Need Help?

- **PayPal Developer Docs**: https://developer.paypal.com/docs/subscriptions/
- **PayPal Sandbox Testing**: https://developer.paypal.com/docs/api-basics/sandbox/
- **PayPal Webhook Guide**: https://developer.paypal.com/docs/api-basics/notifications/webhooks/
