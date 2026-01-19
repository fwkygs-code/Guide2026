# Admin Tools Implementation Guide

## Overview

A comprehensive admin system has been implemented to manage users, subscriptions, and system operations.

## Features

### 1. Admin Authentication
- **Dependency**: `require_admin` - Ensures only users with `role: "admin"` can access admin endpoints
- **Location**: `backend/server.py:746-758`

### 2. User Management Endpoints

#### List Users
- **Endpoint**: `GET /api/admin/users`
- **Query Parameters**:
  - `page` (default: 1)
  - `limit` (default: 50, max: 100)
  - `search` (optional, searches email and name)
- **Returns**: Paginated list of users with plan, subscription, and storage info

#### Get User Details
- **Endpoint**: `GET /api/admin/users/{user_id}`
- **Returns**: Detailed user info including workspaces, walkthroughs, and quota

#### Update User Role
- **Endpoint**: `PUT /api/admin/users/{user_id}/role`
- **Body**: `{"role": "admin" | "owner" | "editor" | "viewer"}`
- **Returns**: Success confirmation

#### Update User Plan (Admin Override)
- **Endpoint**: `PUT /api/admin/users/{user_id}/plan`
- **Body**: `{"plan_name": "free" | "pro" | "enterprise"}`
- **Note**: Bypasses PayPal subscription requirement - use for testing or manual upgrades

### 3. Subscription Management Endpoints

#### Create Manual Subscription
- **Endpoint**: `POST /api/admin/users/{user_id}/subscription/manual`
- **Body**:
  ```json
  {
    "plan_name": "pro",
    "duration_days": 365  // Optional, null = permanent
  }
  ```
- **Returns**: Subscription details with expiration date

#### Cancel User Subscription
- **Endpoint**: `DELETE /api/admin/users/{user_id}/subscription`
- **Note**: Automatically downgrades user to Free plan
- **Returns**: Success confirmation

### 4. System Statistics
- **Endpoint**: `GET /api/admin/stats`
- **Returns**: Comprehensive system stats including:
  - User counts (total, verified, admins)
  - Plan distribution
  - Subscription stats
  - Workspace and walkthrough counts
  - File and storage statistics

### 5. Existing Admin Endpoints (Now Protected)

All existing admin endpoints now use `require_admin` dependency:
- `POST /api/admin/reconcile-quota` - Reconcile quota usage
- `POST /api/admin/cleanup-files` - Cleanup old files
- `GET /api/admin/email/config` - Email configuration status
- `POST /api/admin/email/test` - Test email sending
- `GET /api/admin/paypal/audit/{subscription_id}` - PayPal audit logs
- `GET /api/admin/paypal/state/{subscription_id}` - PayPal subscription state

## Setting Up Admin Access

### Method 1: Using the Script (Recommended)

```bash
cd backend
python set_admin.py k.ygs@icloud.com
```

This will:
1. Find the user by email
2. Set their role to "admin"
3. Confirm the change

### Method 2: Direct Database Update

If you have MongoDB access:

```javascript
db.users.updateOne(
  { "email": "k.ygs@icloud.com" },
  { 
    "$set": { 
      "role": "admin",
      "updated_at": new Date().toISOString()
    }
  }
)
```

### Method 3: Using Admin API (if you're already admin)

```bash
curl -X PUT "https://your-api.com/api/admin/users/{user_id}/role" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## User Model Changes

The `User` model now includes:
```python
role: UserRole = UserRole.OWNER  # Default to OWNER, can be ADMIN, EDITOR, VIEWER
```

Available roles:
- `admin` - Full admin access
- `owner` - Default role for regular users
- `editor` - Reserved for future use
- `viewer` - Reserved for future use

## Security Notes

1. **Admin endpoints are protected** - Only users with `role: "admin"` can access them
2. **Audit logging** - All admin actions are logged with the admin user's ID
3. **No password exposure** - User passwords are never returned in API responses
4. **Manual subscriptions** - Can bypass PayPal for testing/promotions, but should be used carefully

## Example Usage

### Make a user admin:
```bash
python backend/set_admin.py k.ygs@icloud.com
```

### List all users:
```bash
curl -X GET "https://your-api.com/api/admin/users?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Upgrade a user to Pro manually:
```bash
curl -X POST "https://your-api.com/api/admin/users/{user_id}/subscription/manual" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_name": "pro", "duration_days": 365}'
```

### Get system stats:
```bash
curl -X GET "https://your-api.com/api/admin/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Next Steps

1. **Frontend Admin Dashboard** (Optional):
   - Create an admin dashboard page
   - Add admin navigation/routes
   - Implement user management UI
   - Add subscription management UI

2. **Additional Features** (Optional):
   - User deletion endpoint
   - Bulk operations
   - Export functionality
   - Activity logs

## Files Modified

- `backend/server.py`:
  - Added `role` field to `User` model
  - Added `require_admin` dependency function
  - Added admin endpoints for user/subscription management
  - Updated existing admin endpoints to use `require_admin`

- `backend/set_admin.py`:
  - New script to set users as admin

## Testing

After setting a user as admin, test admin access:

```bash
# Should succeed (if you're admin)
curl -X GET "https://your-api.com/api/admin/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Should fail with 403 (if you're not admin)
curl -X GET "https://your-api.com/api/admin/stats" \
  -H "Authorization: Bearer NON_ADMIN_TOKEN"
```
