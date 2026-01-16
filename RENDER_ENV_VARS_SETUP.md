# Adding Environment Variables to Render - Step-by-Step Guide

## Overview

Environment variables in Render are used to configure your application without hardcoding sensitive information like API keys, database URLs, etc. This guide shows you exactly how to add Cloudinary credentials to your Render backend service.

## Step-by-Step Instructions

### Step 1: Log into Render Dashboard

1. Go to https://dashboard.render.com
2. Log in with your Render account
3. You'll see your dashboard with all your services

### Step 2: Navigate to Your Backend Service

1. In the dashboard, find your **`guide2026-backend`** service
2. Click on the service name to open its details page
3. You'll see tabs at the top: **Overview**, **Logs**, **Events**, **Environment**, **Settings**, etc.

### Step 3: Open the Environment Tab

1. Click on the **"Environment"** tab (usually the 4th or 5th tab)
2. You'll see a page with:
   - A list of existing environment variables (if any)
   - An **"Add Environment Variable"** button or form
   - A search/filter box

### Step 4: Add Cloudinary Environment Variables

You need to add **3 environment variables**:

#### Variable 1: CLOUDINARY_CLOUD_NAME

1. Click **"Add Environment Variable"** or the **"+"** button
2. In the **"Key"** field, enter: `CLOUDINARY_CLOUD_NAME`
3. In the **"Value"** field, enter your Cloudinary Cloud Name (from Cloudinary dashboard)
4. Click **"Save Changes"** or **"Add"**

#### Variable 2: CLOUDINARY_API_KEY

1. Click **"Add Environment Variable"** again
2. In the **"Key"** field, enter: `CLOUDINARY_API_KEY`
3. In the **"Value"** field, enter your Cloudinary API Key
4. Click **"Save Changes"** or **"Add"**

#### Variable 3: CLOUDINARY_API_SECRET

1. Click **"Add Environment Variable"** again
2. In the **"Key"** field, enter: `CLOUDINARY_API_SECRET`
3. In the **"Value"** field, enter your Cloudinary API Secret
4. Click **"Save Changes"** or **"Add"**

### Step 5: Verify Variables Are Added

After adding all three, you should see them in the list:

```
CLOUDINARY_CLOUD_NAME    [your-cloud-name]
CLOUDINARY_API_KEY       [your-api-key]
CLOUDINARY_API_SECRET    [your-api-secret]
```

**Important Notes:**
- Values are hidden/masked for security (shown as dots or asterisks)
- You can click on a variable to edit or delete it
- Changes take effect after the next deployment

### Step 6: Trigger Redeployment (Automatic or Manual)

Render will **automatically redeploy** your service when you save environment variables. However, you can also manually trigger it:

1. Go to the **"Events"** tab
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for deployment to complete (usually 2-5 minutes)

### Step 7: Verify Deployment

1. Go to the **"Logs"** tab
2. Look for a log message that says:
   ```
   Cloudinary configured for persistent file storage
   ```
3. If you see this, Cloudinary is working! ✅
4. If you see:
   ```
   Cloudinary not configured - using local storage
   ```
   Then check that all 3 environment variables are set correctly

## Visual Guide (What You'll See)

### Environment Tab Layout

```
┌─────────────────────────────────────────────────┐
│  guide2026-backend                              │
├─────────────────────────────────────────────────┤
│  [Overview] [Logs] [Events] [Environment] [Settings] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Environment Variables                         │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Key                          Value       │  │
│  ├──────────────────────────────────────────┤  │
│  │ MONGO_URI                   [••••••••]  │  │
│  │ DB_NAME                     guide2026    │  │
│  │ JWT_SECRET                  [••••••••]  │  │
│  │ CORS_ORIGINS                [••••••••]  │  │
│  │                                             │  │
│  │ [+ Add Environment Variable]              │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Adding a Variable Dialog

```
┌─────────────────────────────────────┐
│  Add Environment Variable          │
├─────────────────────────────────────┤
│                                     │
│  Key:                               │
│  [CLOUDINARY_CLOUD_NAME        ]   │
│                                     │
│  Value:                             │
│  [your-cloud-name-here          ]   │
│                                     │
│  [Cancel]  [Save Changes]           │
│                                     │
└─────────────────────────────────────┘
```

## Getting Your Cloudinary Credentials

If you don't have Cloudinary credentials yet:

### Step 1: Create Account
1. Go to https://cloudinary.com/users/register/free
2. Sign up (free tier is fine)
3. Verify your email

### Step 2: Get Credentials
1. Go to https://cloudinary.com/console
2. You'll see a dashboard with your account info
3. Look for a section that shows:
   - **Cloud Name**: `dxxxxx` (usually starts with 'd')
   - **API Key**: A long number like `123456789012345`
   - **API Secret**: Click "Reveal" to show it (starts with letters/numbers)

### Step 3: Copy Values
- Copy each value exactly as shown
- Don't add extra spaces
- Keep them secret (don't share publicly)

## Common Issues & Solutions

### Issue 1: "Variable Not Found" Error

**Problem:** Backend can't find the environment variable

**Solution:**
- Check spelling: `CLOUDINARY_CLOUD_NAME` (not `CLOUDINARY_CLOUD` or `CLOUD_NAME`)
- Make sure you're adding to the **backend** service, not frontend
- Verify the variable is saved (check the Environment tab)

### Issue 2: "Invalid Credentials" Error

**Problem:** Cloudinary rejects the credentials

**Solution:**
- Double-check you copied the values correctly
- Make sure there are no extra spaces before/after
- Verify in Cloudinary dashboard that credentials are correct
- Try regenerating API Secret in Cloudinary (if needed)

### Issue 3: Still Using Local Storage

**Problem:** Logs show "using local storage" even after adding variables

**Solution:**
- Make sure all **3** variables are added (not just 1 or 2)
- Check that deployment completed successfully
- Look at logs to see if there are any errors
- Try manually redeploying

### Issue 4: Can't See Environment Tab

**Problem:** Environment tab is missing or grayed out

**Solution:**
- Make sure you're logged in as the service owner/admin
- Check that you're viewing the correct service
- Try refreshing the page

## Alternative: Using render.yaml (Advanced)

If you prefer to manage environment variables in code:

### Option A: Add to render.yaml (Not Recommended for Secrets)

```yaml
envVars:
  - key: CLOUDINARY_CLOUD_NAME
    value: "your-cloud-name"  # ⚠️ Don't commit secrets to Git!
  - key: CLOUDINARY_API_KEY
    value: "your-api-key"     # ⚠️ Don't commit secrets to Git!
  - key: CLOUDINARY_API_SECRET
    sync: false  # ✅ This means "set manually in dashboard"
```

**Warning:** Don't put actual secrets in `render.yaml` if it's in a public Git repo!

### Option B: Use sync: false (Recommended)

```yaml
envVars:
  - key: CLOUDINARY_CLOUD_NAME
    sync: false  # Set manually in dashboard
  - key: CLOUDINARY_API_KEY
    sync: false  # Set manually in dashboard
  - key: CLOUDINARY_API_SECRET
    sync: false  # Set manually in dashboard
```

This tells Render: "These variables exist, but get their values from the dashboard, not from this file."

## Security Best Practices

1. ✅ **Never commit secrets to Git**
   - Don't put API keys in `render.yaml` if repo is public
   - Use `sync: false` for sensitive variables

2. ✅ **Use Render's Secret Management**
   - Render automatically masks secret values
   - Only authorized users can see/edit them

3. ✅ **Rotate Secrets Regularly**
   - Change API secrets every 90 days
   - Update in Render dashboard when you rotate

4. ✅ **Limit Access**
   - Only give service access to team members who need it
   - Use Render's team permissions

## Testing After Setup

### Test 1: Check Logs
```bash
# In Render dashboard → Logs tab
# Look for: "Cloudinary configured for persistent file storage"
```

### Test 2: Upload a File
1. Go to your app
2. Upload an image
3. Check the URL - should be `https://res.cloudinary.com/...`
4. If it's `/api/media/...`, Cloudinary isn't configured yet

### Test 3: Redeploy Test
1. After uploading, trigger a manual redeploy
2. Check if the image still loads
3. If yes → Cloudinary is working! ✅

## Quick Reference

### Required Variables
```
CLOUDINARY_CLOUD_NAME    = Your Cloudinary cloud name
CLOUDINARY_API_KEY       = Your Cloudinary API key  
CLOUDINARY_API_SECRET    = Your Cloudinary API secret
```

### Where to Find Them
- Cloudinary Dashboard: https://cloudinary.com/console
- Look for "Account Details" or "Dashboard" section

### Where to Add Them
- Render Dashboard: https://dashboard.render.com
- Service: `guide2026-backend`
- Tab: **Environment**

## Need Help?

If you're stuck:

1. **Check Render Logs**: Look for error messages
2. **Check Cloudinary Dashboard**: Verify credentials are correct
3. **Verify All 3 Variables**: Make sure none are missing
4. **Try Manual Redeploy**: Sometimes helps refresh config

## Summary Checklist

- [ ] Created Cloudinary account
- [ ] Got Cloudinary credentials (Cloud Name, API Key, API Secret)
- [ ] Logged into Render dashboard
- [ ] Opened `guide2026-backend` service
- [ ] Went to Environment tab
- [ ] Added `CLOUDINARY_CLOUD_NAME`
- [ ] Added `CLOUDINARY_API_KEY`
- [ ] Added `CLOUDINARY_API_SECRET`
- [ ] Verified all 3 variables are saved
- [ ] Waited for auto-redeploy (or triggered manual deploy)
- [ ] Checked logs for "Cloudinary configured" message
- [ ] Tested file upload
- [ ] Verified uploaded file URL is from Cloudinary

Once all checkboxes are done, your files will persist across deployments! 🎉
