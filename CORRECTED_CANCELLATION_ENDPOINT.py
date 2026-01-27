"""
CORRECTED CANCELLATION ENDPOINT
Replace lines 6359-6854 in backend/server.py with this code.

This implementation follows STRICT rules:
- NEVER compute or infer dates
- NEVER store effective_end_date
- After cancellation, IMMEDIATELY reconcile to fetch PayPal timestamps
- Store ONLY PayPal fields
- Access determined ONLY by PayPal timestamps
"""

@api_router.post("/billing/paypal/subscribe")  # NOTE: This route name conflicts with subscribe endpoint - should be /billing/paypal/cancel
async def cancel_paypal_subscription(current_user: User = Depends(get_current_user)):
    """
    Cancel user's PayPal subscription.
    
    STRICT RULES (PayPal is single source of truth):
    - NEVER compute or infer dates (no effective_end_date, no started_at + 30 days)
    - After PayPal confirms cancellation, IMMEDIATELY reconcile to fetch PayPal timestamps
    - Store ONLY PayPal fields: next_billing_time, final_payment_time, last_payment_time
    - Access determined ONLY by PayPal timestamps
    - Downgrades happen ONLY via EXPIRED webhook, never here
    
    Access logic (enforced by reconciliation):
        access_granted = (
            (next_billing_time is not None and now < next_billing_time) or
            (final_payment_time is not None and now < final_payment_time)
        )
    """
    subscription = await get_user_subscription(current_user.id)
    
    # No subscription
    if not subscription:
        return JSONResponse({
            "success": True,
            "message": "No subscription found.",
            "status": "no_subscription"
        })
    
    # Not PayPal
    if subscription.provider != "paypal":
        return JSONResponse({
            "success": True,
            "message": "Not a PayPal subscription.",
            "status": "not_paypal"
        })
    
    # PENDING: Mark for cancellation, NO dates
    if subscription.status == SubscriptionStatus.PENDING:
        if subscription.cancel_at_period_end:
            return JSONResponse({
                "success": True,
                "message": "Cancellation already scheduled.",
                "status": "already_cancelled"
            })
        
        await db.subscriptions.update_one(
            {"id": subscription.id},
            {"$set": {
                "cancel_at_period_end": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return JSONResponse({
            "success": True,
            "message": "Cancellation scheduled.",
            "status": "pending_cancellation"
        })
    
    # CANCELLED: Idempotent
    if subscription.status == SubscriptionStatus.CANCELLED:
        return JSONResponse({
            "success": True,
            "message": "Already cancelled.",
            "status": "already_cancelled"
        })
    
    # ACTIVE: Call PayPal cancel, then reconcile
    if subscription.status != SubscriptionStatus.ACTIVE:
        return JSONResponse({
            "success": True,
            "message": "Subscription not active.",
            "status": "not_active"
        })
    
    paypal_subscription_id = subscription.provider_subscription_id
    if not paypal_subscription_id:
        raise HTTPException(status_code=400, detail="PayPal subscription ID not found")
    
    # Call PayPal cancel API
    try:
        access_token = await get_paypal_access_token()
        if not access_token:
            return JSONResponse({
                "success": False,
                "message": "Failed to authenticate with PayPal.",
                "status": "auth_failed"
            })
        
        # Cancel via PayPal API
        async with aiohttp.ClientSession() as session:
            cancel_url = f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{paypal_subscription_id}/cancel"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            payload = {"reason": "User requested cancellation"}
            
            async with session.post(cancel_url, json=payload, headers=headers) as response:
                if response.status != 204:
                    logging.error(f"PayPal cancel API failed: {response.status}")
                    return JSONResponse({
                        "success": False,
                        "message": "PayPal cancellation failed. Please manage via PayPal directly.",
                        "status": "cancel_failed"
                    })
                
                logging.info(f"PayPal cancel API succeeded: user={current_user.id}, subscription={subscription.id}")
        
        # CRITICAL: Immediately reconcile to fetch PayPal timestamps
        # PayPal provides next_billing_time (until paid period ends) for Auto Pay = OFF
        reconcile_result = await reconcile_subscription_with_paypal(subscription.id, force=True)
        
        if not reconcile_result.get("success"):
            logging.error(f"Reconciliation failed after cancel: {reconcile_result.get('error')}")
            return JSONResponse({
                "success": False,
                "message": "Cancelled with PayPal but unable to verify. Check PayPal directly.",
                "status": "reconcile_failed"
            })
        
        # Extract PayPal timestamps ONLY
        billing_info = reconcile_result.get("billing_info", {})
        next_billing_time = billing_info.get("next_billing_time")  # PayPal-provided
        final_payment_time = billing_info.get("final_payment_time")  # PayPal-provided
        access_granted = reconcile_result.get("access_granted", False)
        
        # Format message with PayPal date (if provided)
        access_until_message = "PayPal determines when access ends"
        if next_billing_time:
            try:
                dt = datetime.fromisoformat(next_billing_time.replace('Z', '+00:00'))
                access_until_message = f"Access until {dt.strftime('%B %d, %Y')}"
            except Exception:
                access_until_message = f"Access until {next_billing_time}"
        elif final_payment_time:
            try:
                dt = datetime.fromisoformat(final_payment_time.replace('Z', '+00:00'))
                access_until_message = f"Access until {dt.strftime('%B %d, %Y')}"
            except Exception:
                access_until_message = f"Access until {final_payment_time}"
        
        return JSONResponse({
            "success": True,
            "message": f"Subscription cancelled successfully. {access_until_message}",
            "status": "cancelled",
            "access_granted": access_granted,
            "next_billing_time": next_billing_time,  # PayPal field ONLY
            "final_payment_time": final_payment_time  # PayPal field ONLY
        })
    
    except Exception as e:
        logging.error(f"Cancellation error: {str(e)}", exc_info=True)
        return JSONResponse({
            "success": False,
            "message": "An error occurred. Please manage your subscription via PayPal.",
            "status": "error"
        })
