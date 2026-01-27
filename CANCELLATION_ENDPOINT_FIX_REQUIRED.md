# CANCELLATION ENDPOINT - REMAINING VIOLATION

## Current State

**✅ FIXED:** Reconciliation logic (uses ONLY PayPal timestamps)
**❌ NOT FIXED:** Cancellation endpoint (`/billing/paypal/subscribe`, lines 6359-6854)

---

## The Violation

The cancellation endpoint computes `effective_end_date` in **7 locations**:

### 1. Lines 6413-6427: PENDING subscriptions
```python
effective_end_dt = now + timedelta(days=30)  # ❌ COMPUTED
```

### 2. Lines 6507-6516: Current period end
```python
current_period_end = (started_at_dt + timedelta(days=30)).isoformat()  # ❌ COMPUTED
```

### 3. Lines 6621-6641, 6672-6713, 6732-6765, 6775-6809, 6819-6853
```python
effective_end_dt = datetime.fromisoformat(current_period_end...)  # ❌ DERIVED FROM COMPUTED
```

---

## Why It's Wrong

Violates core rules:
- ❌ Calculates dates internally (`started_at + 30 days`)
- ❌ Stores inferred `effective_end_date`
- ❌ Returns dates NOT from PayPal

---

## Correct Implementation

```python
@api_router.post("/billing/paypal/subscribe")
async def cancel_paypal_subscription(current_user: User = Depends(get_current_user)):
    """Cancel via PayPal, then reconcile immediately."""
    
    subscription = await get_user_subscription(current_user.id)
    
    # Handle edge cases
    if not subscription:
        return JSONResponse({"success": True, "message": "No subscription"})
    if subscription.status == SubscriptionStatus.PENDING:
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {"$set": {"cancel_at_period_end": True}}
        )
        return JSONResponse({"success": True, "message": "Cancellation scheduled"})
    if subscription.status == SubscriptionStatus.CANCELLED:
        return JSONResponse({"success": True, "message": "Already cancelled"})
    
    # For ACTIVE: Call PayPal cancel, then reconcile
    try:
        access_token = await get_paypal_access_token()
        
        # Cancel via PayPal API
        async with aiohttp.ClientSession() as session:
            cancel_url = f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription.provider_subscription_id}/cancel"
            headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
            async with session.post(cancel_url, json={"reason": "User requested"}, headers=headers) as response:
                if response.status != 204:
                    return JSONResponse({"success": False, "message": "PayPal cancellation failed"})
        
        # CRITICAL: Immediately reconcile to fetch PayPal timestamps
        reconcile_result = await reconcile_subscription_with_paypal(subscription.id, force=True)
        
        # Extract ONLY PayPal timestamps
        billing_info = reconcile_result.get("billing_info", {})
        next_billing_time = billing_info.get("next_billing_time")  # PayPal-provided
        
        # Return ONLY PayPal date
        return JSONResponse({
            "success": True,
            "message": "Cancelled successfully",
            "next_billing_time": next_billing_time  # From PayPal ONLY
        })
    
    except Exception as e:
        return JSONResponse({"success": False, "message": "Error occurred"})
```

---

## Key Changes Required

1. **Remove lines 6442-6468**: All `current_period_end` computation
2. **Remove lines 6570-6616, 6620-6665, 6672-6716, 6723-6760, 6770-6808**: All `effective_end_date` assignments
3. **Replace with**: Single call to `reconcile_subscription_with_paypal(force=True)` after PayPal confirms cancellation
4. **Return**: ONLY `next_billing_time` from PayPal (no computed dates)

---

## File Location

`backend/server.py` lines 6359-6854

---

## Status

**Ready for implementation** - This document provides the complete specification for fixing the cancellation endpoint.
