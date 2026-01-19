# How to Verify Admin Endpoints Are Accessible

## Method 1: Check Server Health First

### Step 1: Verify Server is Running
```bash
# Check if server is responding
curl https://guide2026-backend.onrender.com/health

# Should return: {"status": "healthy"} or similar
```

### Step 2: Check Server Logs
- Go to your Render dashboard
- Check the backend service logs
- Look for: "Default plans initialized" (indicates startup completed)
- Look for any error messages about admin endpoints

## Method 2: Test Admin Endpoints Directly

### Option A: Using Browser Developer Tools

1. **Open your admin dashboard** in the browser
2. **Open Developer Tools** (F12)
3. **Go to Network tab**
4. **Try to load the admin page**
5. **Check the requests**:
   - Look for: `GET /api/admin/users?page=1&limit=50`
   - Look for: `GET /api/admin/stats`
   - Check the **Status Code**:
     - ✅ **200** = Endpoint works
     - ❌ **404** = Endpoint not found (server needs restart)
     - ❌ **403** = Not admin (check user role)
     - ❌ **401** = Not authenticated (check token)

### Option B: Using curl (Command Line)

```bash
# Replace YOUR_TOKEN with your actual JWT token
# Get token from browser: Application > Local Storage > token

# Test admin stats endpoint
curl -X GET "https://guide2026-backend.onrender.com/api/admin/stats" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Test admin users endpoint
curl -X GET "https://guide2026-backend.onrender.com/api/admin/users?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response (200 OK)**:
```json
{
  "users": {
    "total": 10,
    "verified": 8,
    "admins": 1,
    ...
  },
  "plans": {...},
  ...
}
```

**If you get 404**:
- Server hasn't restarted yet
- Wait a few minutes and try again
- Check Render dashboard for deployment status

**If you get 403**:
- Your user doesn't have `role: "admin"` in database
- Run: `python backend/set_admin.py your-email@example.com`

**If you get 401**:
- Token is expired or invalid
- Log out and log back in

## Method 3: Test from Frontend Console

1. **Open browser console** (F12 > Console tab)
2. **Run this JavaScript**:

```javascript
// Test admin stats
fetch('https://guide2026-backend.onrender.com/api/admin/stats', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('Stats:', data);
})
.catch(err => console.error('Error:', err));

// Test admin users
fetch('https://guide2026-backend.onrender.com/api/admin/users?page=1&limit=50', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('Users:', data);
})
.catch(err => console.error('Error:', err));
```

## Method 4: Check Render Deployment Status

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Select your backend service**
3. **Check "Events" or "Logs" tab**:
   - Look for recent deployment
   - Check if it completed successfully
   - Look for any errors during startup
4. **Check "Metrics" tab**:
   - Verify service is running (green status)
   - Check CPU/Memory usage

## Method 5: Verify Endpoint Registration (Advanced)

If you have SSH access to the server:

```bash
# Check if endpoints are registered
curl https://guide2026-backend.onrender.com/docs

# This opens FastAPI Swagger UI
# Look for "/api/admin/users" and "/api/admin/stats" in the list
```

Or check the OpenAPI schema:
```bash
curl https://guide2026-backend.onrender.com/openapi.json | grep -i "admin"
```

## Quick Verification Checklist

- [ ] Server health endpoint returns 200: `/health`
- [ ] Admin stats endpoint returns 200 (not 404): `/api/admin/stats`
- [ ] Admin users endpoint returns 200 (not 404): `/api/admin/users`
- [ ] User has `role: "admin"` in database
- [ ] JWT token is valid and not expired
- [ ] Frontend admin dashboard loads without 404 errors
- [ ] Users list appears in admin dashboard
- [ ] Statistics appear in admin dashboard

## Common Issues & Solutions

### Issue: Still getting 404 after restart
**Solution**: 
- Wait 2-3 minutes for Render to fully restart
- Check Render logs for startup errors
- Verify the code was actually deployed (check git commit)

### Issue: Getting 403 Forbidden
**Solution**:
- Your user is not admin
- Run: `python backend/set_admin.py your-email@example.com`
- Log out and log back in to refresh token

### Issue: Getting 401 Unauthorized
**Solution**:
- Token expired
- Log out and log back in
- Check token in browser: `localStorage.getItem('token')`

### Issue: Endpoints work but no data
**Solution**:
- This is normal if you have no users yet
- Check that `users` array is returned (even if empty)
- Verify database connection is working

## Expected Behavior After Fix

✅ **Admin Dashboard loads successfully**
✅ **Users tab shows user list (or empty if no users)**
✅ **Statistics tab shows system stats**
✅ **No 404 errors in browser console**
✅ **No yellow colors in UI**
