# Admin Setup Instructions

## Issue: Can't see admin actions at https://www.interguide.app/admin

### Solution: Set k.ygs@icloud.com as Admin

---

## ✅ What Was Fixed

1. **Added missing backend endpoint**: `PUT /admin/users/{user_id}/restore`
   - The frontend was calling this endpoint but it didn't exist!
   - "Restore User" button now works correctly

2. **Rich-text support**: All new editor blocks now support formatting
   - Checklist items
   - Callout content
   - Section titles
   - Confirmation messages
   - External link text

---

## 🔧 How to Set Yourself as Admin

You need to run a script on your **Render deployment** environment where MongoDB is accessible.

### Option 1: Using Render Shell (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com/
2. Find your backend service
3. Click "Shell" tab
4. Run this command:

```bash
cd backend
python set_admin.py k.ygs@icloud.com
```

### Option 2: Using MongoDB Connection String Locally

If you have the MongoDB connection string, run locally:

```bash
cd backend
python set_admin.py k.ygs@icloud.com --mongo-uri "your_mongodb_connection_string"
```

### Option 3: Direct MongoDB Update

Connect to your MongoDB database and run:

```javascript
db.users.updateOne(
  { email: "k.ygs@icloud.com" },
  { 
    $set: { 
      role: "admin",
      updated_at: new Date().toISOString()
    } 
  }
)
```

---

## 📊 Current Admin Actions Available

Once you're set as admin, you'll see these actions in the admin panel:

### User Management
- ✅ Edit user role
- ✅ Edit user plan
- ✅ Create manual subscription
- ✅ Cancel subscription
- ✅ Disable user
- ✅ Enable user
- ✅ Soft delete user
- ✅ **Restore user** (NOW WORKING!)
- ✅ Hard delete user (permanent)
- ✅ View user memberships

### Billing & Quotas
- ✅ Force downgrade to Free
- ✅ Force upgrade to Pro
- ✅ Set grace period
- ✅ Set custom quotas (storage, workspaces, walkthroughs)

---

## 🚀 After Setting Admin Role

1. **Refresh the page**: https://www.interguide.app/admin
2. **Check you see the actions dropdown** (three dots icon) for each user
3. **Try the restore function** - it should work now!

---

## 🔍 Verify It Worked

After running the script, you should see:

```
✓ Successfully set user k.ygs@icloud.com (user_id) as admin.
  Previous role: owner
  New role: admin
```

Then when you visit https://www.interguide.app/admin, you should see:
- Full user list
- Stats dashboard
- Actions dropdown for each user
- All admin functions working

---

## ⚠️ Troubleshooting

### "User not found"
- Check that k.ygs@icloud.com has signed up and verified email
- Check spelling of email address

### "Already an admin"
- You're already set as admin!
- Try logging out and back in
- Clear browser cache
- Check if you're logged in with the correct account

### "MongoDB connection failed"
- Script must run where MongoDB is accessible
- Use Render Shell (Option 1) instead of running locally
- Or provide MongoDB connection string (Option 2)

---

## 📝 Next Steps (Future Enhancements)

The audit identified these missing features for future implementation:

### High Priority
- [ ] Force logout user (all sessions)
- [ ] Revoke refresh tokens
- [ ] Temporary account lock
- [ ] Super-admin role (for ownership transfers)

### Medium Priority
- [ ] Remove user from workspace
- [ ] Transfer workspace ownership
- [ ] View/manage invitations

### Low Priority
- [ ] Send system notifications
- [ ] Override max upload size per user
- [ ] Admin audit log viewer

---

**Current Status**: Basic admin panel is fully functional with restore endpoint fixed!
