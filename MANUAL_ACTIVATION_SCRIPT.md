# MANUAL SUBSCRIPTION ACTIVATION

**Use this when reconciliation endpoint is failing (500 error)**

---

## For support@interguide.app

### Option 1: Via MongoDB (Direct Database)

```javascript
// Connect to your MongoDB database
// Find the user
const user = db.users.findOne({ email: "support@interguide.app" });

// Find their PayPal subscription
const subscription = db.subscriptions.findOne({ 
  user_id: user.id, 
  provider: "paypal" 
});

// Manually activate it
db.subscriptions.updateOne(
  { id: subscription.id },
  { 
    $set: { 
      paypal_verified_status: "ACTIVE",
      status: "active",
      last_verified_at: new Date().toISOString(),
      next_billing_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    } 
  }
);

// Verify
db.subscriptions.findOne({ id: subscription.id });
```

### Option 2: Via Admin API Endpoint (If you add one)

Create this endpoint in `backend/server.py`:

```python
@api_router.post("/admin/force-activate")
async def force_activate_subscription(
    data: dict,
    admin: User = Depends(require_admin)
):
    """Manually activate a subscription (for emergencies only)"""
    email = data.get("email")
    
    # Find user
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find subscription
    subscription = await db.subscriptions.find_one({
        "user_id": user["id"],
        "provider": "paypal"
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="No PayPal subscription found")
    
    # Force activate
    now = datetime.now(timezone.utc)
    next_billing = now + timedelta(days=30)
    
    await db.subscriptions.update_one(
        {"id": subscription["id"]},
        {"$set": {
            "paypal_verified_status": "ACTIVE",
            "status": "active",
            "last_verified_at": now.isoformat(),
            "next_billing_time": next_billing.isoformat(),
            "last_payment_time": now.isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Subscription activated for {email}",
        "subscription_id": subscription["id"]
    }
```

Then call it:
```bash
curl -X POST https://guide2026-backend.onrender.com/api/admin/force-activate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "support@interguide.app"}'
```

---

## After Manual Activation

1. User should refresh page (Ctrl+Shift+R)
2. Should see "Pro Plan" immediately
3. Fix the 500 error separately (check Render logs)

---

## IMPORTANT

This is a **temporary workaround**. You MUST fix the 500 error by:
1. Checking Render backend logs
2. Fixing the root cause (likely PayPal credentials or missing data)
3. Testing reconciliation endpoint works

**Don't rely on manual activation for production.**
