# Payment Integration Guide - Stripe Checkout (Easiest & Free)

## Why Stripe Checkout?
- ✅ **Free to start** - Only pay 2.9% + $0.30 per transaction
- ✅ **Easiest integration** - Hosted payment page, no custom forms needed
- ✅ **No PCI compliance** - Stripe handles all card data
- ✅ **Built-in subscriptions** - Automatic recurring billing
- ✅ **Test mode** - Free testing with test cards

## Step 1: Get Stripe Account (5 minutes)

1. Sign up at https://stripe.com (free)
2. Get your API keys from Dashboard → Developers → API keys
3. You'll need:
   - **Publishable key** (starts with `pk_`) - for frontend
   - **Secret key** (starts with `sk_`) - for backend (keep secret!)

## Step 2: Install Stripe (Backend)

Add to `backend/requirements.txt`:
```
stripe>=7.0.0
```

Then install:
```bash
cd backend
pip install stripe
```

## Step 3: Add Environment Variables

Add to your `.env` file (backend):
```
STRIPE_SECRET_KEY=sk_test_...  # Use sk_test_ for testing, sk_live_ for production
STRIPE_PUBLISHABLE_KEY=pk_test_...  # For frontend (optional, can fetch from backend)
STRIPE_WEBHOOK_SECRET=whsec_...  # Get this after setting up webhook endpoint
```

## Step 4: Create Stripe Products & Prices

In Stripe Dashboard:
1. Go to Products → Add Product
2. Create products for each plan:
   - **Free Plan**: $0/month (or skip, handle in code)
   - **Pro Plan**: $X/month (set your price)
   - **Enterprise Plan**: Custom pricing (handle separately)

Or create via API (recommended for consistency):

```python
# Run this once to create products in Stripe
import stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Create Pro plan product
pro_product = stripe.Product.create(
    name="Pro Plan",
    description="3 workspaces, unlimited categories & walkthroughs, 25 GB storage"
)

pro_price = stripe.Price.create(
    product=pro_product.id,
    unit_amount=2900,  # $29.00 in cents
    currency='usd',
    recurring={'interval': 'month'}
)

# Store price_id in your plans collection
```

## Step 5: Update Plans Collection

Add `stripe_price_id` to your plans:

```python
# In backend/server.py, update initialize_default_plans()
plans = [
    {
        "id": "plan_pro",
        "name": "pro",
        "display_name": "Pro",
        "stripe_price_id": "price_xxxxx",  # From Step 4
        "price_cents": 2900,  # $29.00
        # ... rest of plan data
    }
]
```

## Step 6: Backend API Endpoints

Add to `backend/server.py`:

```python
import stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

@api_router.post("/billing/create-checkout-session")
async def create_checkout_session(
    plan_name: str = Query(..., description="Plan name to subscribe to"),
    current_user: User = Depends(get_current_user)
):
    """Create Stripe Checkout session for plan upgrade."""
    
    # Get plan from database
    plan = await db.plans.find_one({"name": plan_name}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")
    
    # Free plan doesn't need payment
    if plan_name == "free":
        # Just change plan directly
        await change_user_plan(plan_name, current_user)
        return {"success": True, "message": "Plan changed to Free"}
    
    # Get Stripe price ID
    stripe_price_id = plan.get('stripe_price_id')
    if not stripe_price_id:
        raise HTTPException(status_code=400, detail="Plan not configured for payments")
    
    # Create Checkout Session
    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=current_user.email,
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='subscription',  # For recurring subscriptions
            # mode='payment',  # For one-time payments
            success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/billing/cancel",
            metadata={
                'user_id': current_user.id,
                'plan_name': plan_name,
                'plan_id': plan['id']
            },
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        logging.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@api_router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session['metadata']['user_id']
        plan_name = session['metadata']['plan_name']
        plan_id = session['metadata']['plan_id']
        
        # Update user's plan
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"plan_id": plan_id}}
        )
        
        # Create or update subscription
        subscription = await get_user_subscription(user_id)
        if subscription:
            await db.subscriptions.update_one(
                {"id": subscription.id},
                {"$set": {
                    "plan_id": plan_id,
                    "status": SubscriptionStatus.ACTIVE,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            new_sub = Subscription(
                user_id=user_id,
                plan_id=plan_id,
                status=SubscriptionStatus.ACTIVE
            )
            sub_dict = new_sub.model_dump()
            sub_dict['started_at'] = sub_dict['started_at'].isoformat()
            sub_dict['created_at'] = sub_dict['created_at'].isoformat()
            sub_dict['updated_at'] = sub_dict['updated_at'].isoformat()
            await db.subscriptions.insert_one(sub_dict)
        
        logging.info(f"User {user_id} subscribed to {plan_name} via Stripe")
    
    elif event['type'] == 'customer.subscription.deleted':
        # Handle cancellation
        subscription_obj = event['data']['object']
        # Find user by customer_id or metadata
        # Downgrade to free plan
        # ...
    
    return {"status": "success"}
```

## Step 7: Frontend Integration

Update `frontend/src/lib/api.js`:

```javascript
// Add to api object
createCheckoutSession: async (planName) => {
  const response = await axios.post(
    `${API_BASE}/billing/create-checkout-session?plan_name=${planName}`,
    {},
    { headers: getAuthHeaders() }
  );
  return response.data;
},
```

Update `frontend/src/components/UpgradePrompt.jsx`:

```javascript
const handleUpgrade = async (planName) => {
  if (planName === 'free') {
    // Free plan - no payment needed
    await api.changePlan(planName);
    toast.success('Plan changed to Free');
    onOpenChange(false);
    window.location.reload();
    return;
  }
  
  if (planName === 'enterprise') {
    // Enterprise - contact form
    window.open('mailto:support@example.com?subject=Enterprise Plan Inquiry', '_blank');
    return;
  }
  
  try {
    setSelecting(true);
    const { checkout_url } = await api.createCheckoutSession(planName);
    // Redirect to Stripe Checkout
    window.location.href = checkout_url;
  } catch (error) {
    toast.error(error.response?.data?.detail || 'Failed to start checkout');
    setSelecting(false);
  }
};
```

## Step 8: Set Up Webhook Endpoint

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. For local testing:
   ```bash
   stripe listen --forward-to localhost:8000/api/billing/webhook
   ```
3. Copy the webhook secret (starts with `whsec_`) to your `.env`
4. For production, add webhook endpoint in Stripe Dashboard:
   - URL: `https://your-backend.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`

## Step 9: Success/Cancel Pages

Create `frontend/src/pages/BillingSuccessPage.js`:

```javascript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const BillingSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    if (sessionId) {
      toast.success('Payment successful! Your plan has been upgraded.');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
  }, [sessionId, navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Payment Successful!</h1>
        <p>Redirecting to dashboard...</p>
      </div>
    </div>
  );
};
```

## Step 10: Testing

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Any future expiry date, any CVC

## Cost Breakdown

- **Stripe fees**: 2.9% + $0.30 per transaction
- **No monthly fees**
- **No setup costs**
- **Free test mode**

## Next Steps (Optional Enhancements)

1. **Customer Portal**: Let users manage subscriptions
   ```python
   portal_session = stripe.billing_portal.Session.create(
       customer=customer_id,
       return_url='https://yourapp.com/settings'
   )
   ```

2. **Cancel Subscriptions**: Handle via webhook `customer.subscription.deleted`

3. **Trial Periods**: Add `subscription_data={'trial_period_days': 14}` to checkout

4. **Coupons**: Use Stripe coupons for discounts

## Security Notes

- ✅ Never expose secret key in frontend
- ✅ Always verify webhook signatures
- ✅ Use environment variables for keys
- ✅ Test in test mode before going live

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Stripe Webhooks: https://stripe.com/docs/webhooks
