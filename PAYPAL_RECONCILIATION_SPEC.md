# PayPal Reconciliation - Production Hardening Specification

## Critical Issues & Fixes

### Issue 1: Incomplete Reconciliation Function
**Current:** `reconcile_pending_subscription()` only handles PENDING → ACTIVE  
**Problem:** Doesn't handle CANCELLED, EXPIRED, SUSPENDED, or other states  
**Impact:** Users stuck in "pending" state even after PayPal confirms cancellation

**Fix Required:**
```python
async def reconcile_subscription_with_paypal(
    subscription_id: str,
    force: bool = False
) -> Dict[str, Any]:
    """
    Comprehensive PayPal reconciliation - SINGLE SOURCE OF TRUTH
    
    Rules:
    1. Fetch subscription from PayPal API
    2. Map PayPal status → internal status (deterministic)
    3. Persist immediately
    4. Derive access from billing timestamps, not status strings
    5. Handle ALL PayPal statuses explicitly
    6. Stop reconciliation at terminal states
    """
    # Implementation details below...
```

### Issue 2: Webhook Handler Independence
**Current:** Webhook handler has ~200 lines of business logic  
**Problem:** Duplicates logic, can diverge from reconciliation  
**Impact:** Webhook and API reconciliation may produce different results

**Fix Required:**
- Webhook handlers must ONLY call reconciliation function
- Zero independent logic
- Just: `await reconcile_subscription_with_paypal(subscription_id)`

### Issue 3: No User Reconciliation Endpoint
**Current:** No way for users to manually trigger reconciliation  
**Problem:** If webhook delayed, users stuck until next poll  
**Impact:** Poor UX, support burden

**Fix Required:**
```python
@api_router.post("/billing/reconcile")
@rate_limit(max_calls=5, window_seconds=60)
async def reconcile_my_subscription(current_user: User):
    """
    User-triggered reconciliation (rate-limited)
    - Only reconciles authenticated user's subscription
    - Returns updated status immediately
    """
```

### Issue 4: Access Control Based on Status Strings
**Current:** May grant access based on `status == 'active'`  
**Problem:** Status strings can be stale  
**Impact:** Users may get/lose access incorrectly

**Fix Required:**
```python
def has_paid_access(subscription: Subscription, paypal_details: Dict) -> bool:
    """
    SINGLE RULE for paid access based on PayPal billing evidence
    
    Access granted ONLY if:
    1. last_payment_time exists AND within current period
    2. next_billing_time exists AND in future
    3. If cancelled: billing_info.final_payment_time in future
    
    Status strings NEVER used alone for access decision
    """
```

### Issue 5: Terminal vs Non-Terminal States
**Current:** Unclear when to stop polling  
**Problem:** Unnecessary PayPal API calls  
**Impact:** Rate limiting, performance

**Fix Required:**
```python
TERMINAL_STATUSES = frozenset([
    'CANCELLED',  # PayPal confirmed cancellation
    'EXPIRED',    # Subscription ended
    'SUSPENDED'   # PayPal suspended (payment failure, etc)
])

NON_TERMINAL_STATUSES = frozenset([
    'APPROVAL_PENDING',  # User hasn't approved yet
    'ACTIVE',            # May transition to CANCELLED/EXPIRED
    'PENDING'            # Initial state
])

# Stop polling once terminal state reached
```

### Issue 6: Frontend Assumes Success
**Current:** Shows "waiting for activation" but never closes  
**Problem:** Assumes webhook will arrive  
**Impact:** Poor UX, confused users

**Fix Required:**
- Poll `/billing/reconcile` endpoint
- Display only backend-returned status
- Close modal immediately when backend returns `access_granted: true`
- Timeout after 60 seconds with "refresh page" message

---

## Implementation Order

1. **Create comprehensive reconciliation function** (30 min)
2. **Add rate-limited reconciliation endpoint** (15 min)
3. **Refactor webhook handlers to delegate** (30 min)
4. **Update access control logic** (20 min)
5. **Fix frontend polling** (20 min)
6. **Add comprehensive logging** (10 min)
7. **Testing & validation** (30 min)

**Total estimated time:** 2-3 hours

---

## PayPal Status Mapping (Definitive)

| PayPal Status | Internal Status | Access Granted? | Terminal? |
|--------------|----------------|-----------------|-----------|
| ACTIVE | ACTIVE | Yes (if billing timestamps valid) | No |
| APPROVAL_PENDING | PENDING | No | No |
| CANCELLED | CANCELLED | Yes (until final_payment_time) | Yes |
| EXPIRED | EXPIRED | No | Yes |
| SUSPENDED | SUSPENDED | No | Yes |
| Unknown/Other | PENDING | No | No |

---

## Acceptance Criteria

✅ All webhook handlers delegate to reconciliation  
✅ Reconciliation handles all PayPal statuses explicitly  
✅ Access control uses billing timestamps, not status strings  
✅ Users can manually trigger reconciliation (rate-limited)  
✅ Frontend polls until terminal state  
✅ Success modal closes immediately after access granted  
✅ Comprehensive logging for all PayPal interactions  
✅ No inferred states, timers, or assumptions  
✅ System works even if webhooks never arrive  

---

## Next Steps

**Choose implementation approach:**
- **Full refactoring:** All issues fixed, production-ready (~3 hours)
- **Critical path:** Core fixes only, iterative improvements later (~1 hour)
- **Review first:** Detailed code samples for approval before implementation

**Recommended:** Critical path now, full refactoring in maintenance window
