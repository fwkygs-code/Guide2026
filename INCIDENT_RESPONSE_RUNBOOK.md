# PayPal Subscription System - Incident Response Runbook

## Emergency Contacts

- **PayPal Support:** https://www.paypal.com/us/smarthelp/contact-us
- **PayPal API Status:** https://www.paypal-status.com/
- **System Admin:** [Your contact info]

---

## Quick Reference: Kill Switch Commands

### Emergency: Stop All PayPal Processing
```bash
curl -X POST "https://your-api.com/api/admin/kill-switch?action=disable_except_scheduled" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Re-enable After Incident
```bash
curl -X POST "https://your-api.com/api/admin/kill-switch?action=enable_all" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check System Status
```bash
curl "https://your-api.com/api/metrics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Incident Scenarios

### 1. PayPal API Outage

**Symptoms:**
- High reconciliation failure rate (>10%)
- Metrics show `reconcile_failed` spiking
- Logs show PayPal API timeouts/errors

**Response:**
1. **Verify PayPal Status:** Check https://www.paypal-status.com/
2. **Enable Kill Switch (Optional):**
   - If outage >30 min: Disable frontend polling to reduce load
   - Scheduled reconciliation will continue (eventual consistency)
3. **Monitor Metrics:** Watch `reconcile_failed` count
4. **Post-Recovery:**
   - Re-enable kill switch
   - Verify reconciliation success rate returns to normal
   - Check for pending subscriptions that need manual reconciliation

**Commands:**
```bash
# During outage (reduce load)
curl -X POST ".../api/admin/kill-switch?action=disable_except_scheduled" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# After recovery
curl -X POST ".../api/admin/kill-switch?action=enable_all" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### 2. Webhook Flood / DDoS

**Symptoms:**
- High webhook receipt rate
- Duplicate webhooks being processed
- CPU/memory spikes

**Response:**
1. **Check Metrics:** `webhook_received_total` vs `reconcile_total`
2. **Verify Idempotency:** Check `processed_webhook_events` collection for duplicates
3. **If Attack Confirmed:**
   - Disable webhook processing temporarily
   - Rely on frontend polling + scheduled job
4. **Investigate:** Check webhook signatures, verify PayPal source
5. **Re-enable:** After attack subsides

**Commands:**
```bash
# Disable webhooks (frontend polling compensates)
curl -X POST ".../api/admin/kill-switch?action=disable_except_scheduled"

# Check metrics
curl ".../api/metrics" -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.metrics.webhook_received_total'
```

---

### 3. Access Granted Without Timestamps 🚨

**Symptoms:**
- **CRITICAL ALERT** in logs: `access_granted_no_timestamps > 0`
- Metrics endpoint shows `access_granted_no_timestamps > 0`

**Response:**
1. **Immediate Investigation (P0):**
   - This should NEVER happen (code violation)
   - Check audit logs for affected subscriptions
   - Review PayPal API responses (raw_paypal_response in logs)
2. **Containment:**
   - Identify affected users
   - Manually verify their PayPal subscription status
   - If incorrect access granted: revoke immediately
3. **Root Cause:**
   - Review recent code changes
   - Check if PayPal API schema changed
   - Verify timestamp parsing logic
4. **Prevention:**
   - Add unit tests for affected code path
   - Consider adding assertion in reconciliation function

**Query Audit Logs:**
```javascript
// MongoDB query
db.paypal_audit_log.find({
  action: "reconcile_complete",
  // Find reconciliations where access granted but no timestamps
  $expr: {
    $and: [
      { $eq: ["$verified", true] },
      { $or: [
        { $eq: ["$raw_paypal_response.billing_info.next_billing_time", null] },
        { $eq: ["$raw_paypal_response.billing_info.final_payment_time", null] }
      ]}
    ]
  }
}).sort({ created_at: -1 }).limit(10)
```

---

### 4. Polling Beyond Terminal State 🚨

**Symptoms:**
- Alert: `poll_after_terminal > 0`
- Frontend continues polling after ACTIVE/CANCELLED/EXPIRED/SUSPENDED

**Response:**
1. **Check Metrics:** How many occurrences?
2. **Frontend Bug:**
   - Likely frontend not checking `is_terminal_for_polling`
   - Check browser console for frontend errors
   - Review recent frontend deployments
3. **Temporary Fix:**
   - Backend will still respond correctly (idempotent)
   - Not a data integrity issue, but wastes resources
4. **Permanent Fix:**
   - Fix frontend polling logic
   - Add frontend unit test for terminal state handling

**Monitor:**
```bash
# Check if frontend respects terminal states
curl ".../api/metrics" | jq '.metrics.poll_after_terminal'
```

---

### 5. Subscription Stuck in PENDING

**Symptoms:**
- User reports subscription not activating
- Subscription status = PENDING for >5 minutes
- No recent reconciliation for subscription

**Response:**
1. **Manual Reconciliation:**
   ```bash
   # As admin, trigger reconciliation for user
   # (requires admin endpoint or database access)
   ```
2. **Check PayPal Status:**
   - Log into PayPal dashboard
   - Verify subscription status
   - Check for payment issues
3. **Billing Timestamps:**
   - If PayPal shows ACTIVE but no `next_billing_time`:
     - PayPal may still be processing
     - Reconciliation will auto-retry via scheduled job
4. **Manual Override (Last Resort):**
   - Only if PayPal confirms active + billing schedule
   - Manually update subscription in database
   - Document reason in notes

---

### 6. Rate Limiting (429 Errors)

**Symptoms:**
- Metrics show high `reconcile_failed` due to 429s
- PayPal API returns rate limit errors
- Frontend exponential backoff triggering

**Response:**
1. **Identify Source:**
   - Scheduled job: Should rate-limit internally (100ms delay)
   - Frontend polling: Should backoff exponentially
   - Webhook flood: See "Webhook Flood" scenario
2. **Adjust Rate Limits:**
   - Increase delay in scheduled job if needed
   - Verify frontend backoff working correctly
3. **Contact PayPal:**
   - If legitimate traffic hitting limits
   - Request rate limit increase

**Check Scheduled Job Rate:**
```python
# In server.py, line ~10262
await asyncio.sleep(0.1)  # 100ms = max 600/min
```

---

### 7. Cancelled Subscription Still Has Access

**Expected Behavior:** This is CORRECT if `final_payment_time > now`

**Verification:**
1. **Check Reconciliation Result:**
   ```bash
   # Manually reconcile subscription
   curl -X POST ".../api/billing/reconcile" -H "Authorization: Bearer $USER_TOKEN"
   ```
2. **Verify Timestamps:**
   - If `final_payment_time` in future: Access should persist
   - If `final_payment_time` in past: Access should be revoked
3. **If Incorrect:**
   - Check reconciliation logs
   - Verify timestamp parsing
   - Manually verify with PayPal dashboard

**Not a Bug If:**
- Subscription status = CANCELLED
- `final_payment_time = 2026-02-15`
- Current date = 2026-01-27
- **Result:** User retains access until 2026-02-15 ✅

---

### 8. Webhook Delays (Eventual Consistency)

**Expected Behavior:** System designed to handle webhook delays

**How It Works:**
1. Webhook arrives late (or never)
2. Frontend polling discovers state (within 60s during active use)
3. Scheduled job enforces state (within 24h even if user inactive)

**No Action Required** - System is eventually consistent

**Verify:**
- Check metrics: `webhook_received_total` vs `reconcile_success`
- Verify scheduled job ran: Check logs for `[SCHEDULED_RECONCILE]`

---

## Manual Reconciliation Procedure

### Single User
```bash
# User triggers own reconciliation
curl -X POST "https://your-api.com/api/billing/reconcile" \
  -H "Authorization: Bearer USER_TOKEN"
```

### Admin: Reconcile Specific User
```javascript
// MongoDB: Get user's subscription
db.subscriptions.findOne({user_id: "USER_ID", provider: "paypal"})

// Then call reconciliation endpoint as admin
// (requires admin bypass or custom admin endpoint)
```

### Bulk Reconciliation
```bash
# Trigger scheduled job immediately (requires server access)
# Option 1: Restart server (job runs on startup)
# Option 2: Call scheduled job endpoint (if added)
```

---

## Audit Log Interpretation

### Log Format
```
[RECONCILE] Completed for subscription abc123:
  paypal_status=ACTIVE → internal_status=ACTIVE,
  access_granted=True, plan=pro,
  reason='Access until next_billing_time: 2026-02-15T00:00:00Z'
```

### Key Fields
- `paypal_status`: What PayPal returned
- `internal_status`: How we mapped it
- `access_granted`: Final access decision
- `reason`: Why access granted/denied (must reference timestamps)

### Red Flags
- `reason` doesn't mention timestamps → **BUG**
- `access_granted=True` but `paypal_status=EXPIRED` → **BUG**
- `access_granted=False` but `paypal_status=ACTIVE` with future `next_billing_time` → **BUG**

---

## Metrics Dashboard (Setup Required)

### Key Metrics to Monitor
1. **Reconciliation Rate:**
   - `reconcile_total` (counter)
   - `reconcile_success` (counter)
   - `reconcile_failed` (counter)
   - Success rate = `success / total * 100`

2. **Access Decisions:**
   - `access_granted_total` (counter)
   - `access_denied_total` (counter)
   - `access_granted_next_billing` (timestamp source)
   - `access_granted_final_payment` (timestamp source)

3. **Alert Metrics (MUST be zero):**
   - `access_granted_no_timestamps` **→ MUST BE 0**
   - `poll_after_terminal` **→ SHOULD BE 0**

4. **PayPal API:**
   - `reconcile_timestamp_parse_error` (schema change detector)
   - Webhook event counts by type

5. **Scheduled Job:**
   - `scheduled_reconcile_run` (daily increment)

### Grafana Dashboard Example
```
Panel 1: Reconciliation Success Rate (gauge, alert if <90%)
Panel 2: Access Grant Rate (time series)
Panel 3: Critical Alerts (table, filter access_granted_no_timestamps > 0)
Panel 4: Webhook vs Reconciliation Delta (time series)
```

---

## Post-Incident Checklist

After resolving any incident:

- [ ] Document timeline in incident report
- [ ] Verify metrics returned to normal
- [ ] Re-enable any disabled features (kill switch)
- [ ] Check for pending subscriptions needing reconciliation
- [ ] Review audit logs for anomalies during incident
- [ ] Update runbook if new procedures discovered
- [ ] Conduct post-mortem if P0/P1 incident

---

## Emergency Rollback

If production issues require immediate rollback:

```bash
# Revert to previous commit
git log --oneline -10  # Find stable commit
git reset --hard <STABLE_COMMIT>
git push --force

# Verify: Old webhook logic is commented out (lines 7647-8078)
# Verify: Can uncomment if needed for emergency rollback
```

**Note:** Current code has deprecated old webhook logic preserved in comments for emergency rollback.
