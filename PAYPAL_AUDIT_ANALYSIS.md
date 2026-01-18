# PayPal Payment Action Analysis

## PART 1: All PayPal-Related Actions Enumerated

### 1. Subscription Creation
- **Location**: `backend/server.py:3643-3728` - `subscribe_paypal()` endpoint
- **PayPal API**: None (frontend creates via PayPal SDK)
- **Local State Change**: Creates subscription with `status=PENDING`
- **PayPal Confirmation**: None at creation time (waits for webhook)

### 2. Subscription Activation
- **Location**: `backend/server.py:4013-4117` - `BILLING.SUBSCRIPTION.ACTIVATED` webhook handler
- **PayPal API**: `GET /v1/billing/subscriptions/{id}` (to get billing_info)
- **Local State Change**: `status=PENDING → ACTIVE`, upgrades `user.plan_id` to Pro
- **PayPal Confirmation**: Webhook + API call to get billing_info

### 3. Trial Start
- **Location**: `backend/server.py:4045-4096` - Inside ACTIVATED webhook handler
- **PayPal API**: `GET /v1/billing/subscriptions/{id}` - reads `billing_info.next_billing_time`
- **Local State Change**: Sets `user.trial_ends_at` from PayPal data
- **PayPal Confirmation**: `billing_info.next_billing_time` from PayPal API

### 4. Billing Period Calculation
- **Location**: `backend/server.py:3040-3066` - `get_user_plan_endpoint()` 
- **PayPal API**: None (uses `trial_ends_at` from webhook-set data)
- **Local State Change**: None (read-only)
- **PayPal Confirmation**: `trial_ends_at` was set from PayPal `billing_info.next_billing_time`

### 5. Renewal
- **Location**: PayPal handles renewals automatically (no local code)
- **PayPal API**: PayPal processes renewals
- **Local State Change**: None (renewal is automatic via PayPal)
- **PayPal Confirmation**: N/A (PayPal controls renewal)

### 6. Cancellation
- **Location**: `backend/server.py:3202-3625` - `cancel_paypal_subscription()` endpoint
- **PayPal API**: `POST /v1/billing/subscriptions/{id}/cancel` → `GET /v1/billing/subscriptions/{id}`
- **Local State Change**: `cancel_at_period_end=True`, may set `status=CANCELLED` if PayPal confirms
- **PayPal Confirmation**: `GET` request verifies PayPal status after `POST`

### 7. Suspension
- **Location**: `backend/server.py:4160-4187` - `BILLING.SUBSCRIPTION.SUSPENDED` webhook
- **PayPal API**: None (webhook only)
- **Local State Change**: `status=CANCELLED` (treats suspended as cancelled)
- **PayPal Confirmation**: Webhook event

### 8. Expiration
- **Location**: `backend/server.py:4189-4237` - `BILLING.SUBSCRIPTION.EXPIRED` webhook
- **PayPal API**: None (webhook only)
- **Local State Change**: `status=EXPIRED`, downgrades `user.plan_id` to Free
- **PayPal Confirmation**: Webhook event

### 9. Reconciliation/Recovery
- **Location**: `backend/server.py:3791-3864` - `reconcile_pending_subscription()` 
- **PayPal API**: `GET /v1/billing/subscriptions/{id}`
- **Local State Change**: `status=PENDING → ACTIVE` if PayPal says ACTIVE
- **PayPal Confirmation**: PayPal API status check

### 10. Downgrade/Upgrade
- **Upgrade**: Only in `BILLING.SUBSCRIPTION.ACTIVATED` webhook (line 4098-4101)
- **Downgrade**: Only in `BILLING.SUBSCRIPTION.EXPIRED` webhook (line 4229-4235)
- **PayPal Confirmation**: Webhook events required

---

## PART 2: PayPal-First Enforcement Issues Found

### ✅ ENFORCED CORRECTLY:
- Subscription creation: No Pro access until webhook
- Activation: Only webhook upgrades to Pro
- Trial: Only from PayPal `billing_info.next_billing_time`
- Downgrade: Only on EXPIRED webhook
- Cancellation: Verifies PayPal status before marking CANCELLED

### ⚠️ NEEDS IMPROVEMENT:
- **Audit Logging**: No forensic logging of PayPal API calls
- **State Machine Guards**: No explicit state transition validation
- **Error Recovery**: Need better logging when PayPal API fails

---

## PART 3: Audit Logging Schema

```python
class PayPalAuditLog(BaseModel):
    id: str
    user_id: Optional[str]
    subscription_id: Optional[str]
    action: str  # create_subscription, activate, verify_activation, trial_start, renewal_check, cancel_request, cancel_verify, suspend, expire, reconcile
    paypal_endpoint: str
    http_method: str
    http_status_code: Optional[int]
    paypal_status: Optional[str]  # ACTIVE, PENDING, CANCELLED, EXPIRED, SUSPENDED, UNKNOWN
    raw_paypal_response: Optional[Dict]
    verified: bool
    source: str  # api_call, webhook, reconciliation
    created_at: datetime
```

---

## Implementation Plan

1. Create `PayPalAuditLog` model
2. Create `log_paypal_action()` helper function
3. Add audit logging to all PayPal interactions
4. Implement state machine guards
5. Update frontend wording
6. Create admin endpoints
7. Verify sandbox/production parity