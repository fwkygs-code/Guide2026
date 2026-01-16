# Cloudinary Account Setup - Complete Step-by-Step Guide

## Part 1: Account Creation (You've Done This! ✅)

You've already created your Cloudinary account. Great! Now let's continue.

## Part 2: Understanding Cloudinary Dashboard

After creating your account, you'll be taken to the **Dashboard** (also called **Console**).

### What You'll See

The Cloudinary dashboard has several sections:
- **Dashboard/Console** - Main overview with your credentials
- **Media Library** - Where your uploaded files will appear
- **Settings** - Account configuration
- **Analytics** - Usage statistics

## Part 3: Finding Your Credentials

### Step 1: Navigate to Dashboard

1. If you're not already there, go to: https://cloudinary.com/console
2. You should see your **Dashboard** (main page)

### Step 2: Locate Account Details

On the Dashboard, look for a section that shows your account information. It might be labeled as:
- **"Account Details"**
- **"Dashboard"** (with account info)
- **"Product Environment Credentials"** (newer interface)

### Step 3: Find Your Three Credentials

You need to find these **3 values**:

#### 1. Cloud Name
- **What it looks like**: Usually starts with a letter, like `dxxxxx` or `yourname`
- **Example**: `dabc123` or `mycompany`
- **Where to find**: Usually at the top of the dashboard, next to your account name
- **Format**: Alphanumeric, lowercase, no spaces

#### 2. API Key
- **What it looks like**: A long number, like `123456789012345`
- **Example**: `987654321098765`
- **Where to find**: In the "Account Details" section
- **Format**: Numbers only, usually 15-16 digits

#### 3. API Secret
- **What it looks like**: Hidden by default (shown as dots or asterisks)
- **Where to find**: In the "Account Details" section, next to API Key
- **How to reveal**: Click the **"Reveal"** or **"Show"** button/eye icon
- **Format**: Mix of letters and numbers, longer than API Key
- **⚠️ Important**: Keep this secret! Don't share it publicly.

### Visual Guide: What You're Looking For

```
┌─────────────────────────────────────────┐
│  Cloudinary Dashboard                  │
├─────────────────────────────────────────┤
│                                         │
│  Account Details                        │
│  ────────────────────────────────────  │
│                                         │
│  Cloud Name:                            │
│  [dabc123                          ]   │ ← Copy this
│                                         │
│  API Key:                               │
│  [987654321098765                   ]   │ ← Copy this
│                                         │
│  API Secret:                            │
│  [••••••••••••••••••••••••••••••]      │
│  [Reveal]                               │ ← Click to show
│                                         │
│  After clicking "Reveal":               │
│  [aBc123XyZ456DeF789GhI012JkL345]      │ ← Copy this
│                                         │
└─────────────────────────────────────────┘
```

## Part 4: SDK Selection

### Which SDK Do You Need?

For your **backend** (Python/FastAPI), you need:

✅ **Python SDK** - This is what we've already added to your code!

### SDK Options (For Reference)

Cloudinary offers SDKs for different languages:

1. **Python** ✅ (What you need - already in requirements.txt)
   - Package: `cloudinary`
   - Already added to your `backend/requirements.txt`
   - Version: `>=1.36.0`

2. **Node.js/JavaScript** (For frontend if needed later)
   - Package: `cloudinary`
   - Not needed for your current setup

3. **Ruby, PHP, Java, etc.** (Other languages)
   - Not relevant for your project

### You Don't Need to Install Anything!

The Python SDK is already configured in your code:
- ✅ Added to `backend/requirements.txt`
- ✅ Imported in `backend/server.py`
- ✅ Will install automatically when you deploy

**You don't need to install anything manually!** Render will install it during deployment.

## Part 5: Copying Your Credentials

### Step-by-Step: Getting All Three Values

#### Step 1: Get Cloud Name
1. Look at the top of your Cloudinary dashboard
2. Find "Cloud Name" or look next to your account name
3. **Copy the entire value** (e.g., `dabc123`)
4. **Paste it somewhere safe** (like a text file) - you'll need it for Render

#### Step 2: Get API Key
1. In the Dashboard, find "API Key"
2. It's usually a long number
3. **Copy the entire value**
4. **Paste it somewhere safe**

#### Step 3: Get API Secret
1. Find "API Secret" in the Dashboard
2. It will be hidden (dots/asterisks)
3. **Click "Reveal"** or the eye icon 👁️
4. **Copy the revealed value** (it's long, make sure you get it all)
5. **Paste it somewhere safe**
6. ⚠️ **Keep this secret!** Don't share it publicly.

### Example of What You Should Have

After copying, you should have something like:

```
Cloud Name:    dabc123
API Key:       987654321098765
API Secret:    aBc123XyZ456DeF789GhI012JkL345MnOp678QrSt901
```

## Part 6: Verifying Your Account

### Check Your Account Status

1. **Free Tier Limits**: Check that you're on the free tier
   - Should show: "Free" or "Free Plan"
   - Includes: 25GB storage, 25GB bandwidth/month

2. **Account Verified**: Make sure your email is verified
   - Check your email for verification link
   - If not verified, you might have limited access

3. **Dashboard Access**: You should be able to see:
   - Your Cloud Name
   - API Key
   - API Secret (after revealing)
   - Media Library (empty for now)

## Part 7: Understanding Cloudinary Structure

### How Cloudinary Organizes Files

When you upload files, Cloudinary organizes them like this:

```
https://res.cloudinary.com/{cloud-name}/image/upload/{folder}/{file-id}.{ext}
```

Example:
```
https://res.cloudinary.com/dabc123/image/upload/guide2026/abc123.jpg
```

Where:
- `dabc123` = Your Cloud Name
- `guide2026` = Folder (we set this in code)
- `abc123.jpg` = Your file

### Folders in Cloudinary

- Files are organized in folders
- Our code uses folder: `guide2026`
- You can see folders in the Media Library later

## Part 8: Testing Your Credentials (Optional)

### Test Upload via Cloudinary Console

You can test that your credentials work:

1. Go to **Media Library** in Cloudinary dashboard
2. Click **"Upload"** button
3. Select an image file
4. Click **"Upload"**
5. If it uploads successfully, your account is working! ✅

### What You'll See After Upload

- File appears in Media Library
- You'll see the file URL
- URL format: `https://res.cloudinary.com/{cloud-name}/...`

## Part 9: Security Best Practices

### Keep Your Credentials Safe

1. ✅ **Never commit secrets to Git**
   - Don't put them in `render.yaml` if repo is public
   - Use Render's environment variables instead

2. ✅ **Don't Share Publicly**
   - API Secret is especially sensitive
   - Only share with trusted team members

3. ✅ **Use Environment Variables**
   - Add to Render (not in code)
   - Render masks/hides the values

4. ✅ **Rotate if Compromised**
   - If you suspect a leak, regenerate API Secret
   - Go to Settings → Security → Regenerate API Secret

## Part 10: Next Steps

Now that you have your credentials:

### Immediate Next Steps:

1. ✅ **You have your 3 credentials** (Cloud Name, API Key, API Secret)
2. ⏭️ **Next**: Add them to Render (see `RENDER_ENV_VARS_SETUP.md`)
3. ⏭️ **Then**: Deploy and test

### What Happens Next:

1. Add credentials to Render → Files will upload to Cloudinary
2. Upload a test file → Should get Cloudinary URL
3. Redeploy → File should still be accessible

## Troubleshooting

### Problem: Can't Find Credentials

**Solution:**
- Look for "Dashboard" or "Console" link in top navigation
- Try: https://cloudinary.com/console
- Check if you're logged in (top right corner)

### Problem: API Secret Won't Reveal

**Solution:**
- Make sure your email is verified
- Try refreshing the page
- Check browser console for errors
- Try a different browser

### Problem: Credentials Look Wrong

**Solution:**
- Cloud Name: Should be short, alphanumeric, lowercase
- API Key: Should be numbers only, 15-16 digits
- API Secret: Should be long mix of letters/numbers
- If they look different, check you're in the right account

### Problem: Account Not Verified

**Solution:**
- Check your email for verification link
- Click the link to verify
- Refresh Cloudinary dashboard
- Some features might be limited until verified

## Quick Reference

### Where to Find Credentials
- **URL**: https://cloudinary.com/console
- **Section**: Dashboard / Account Details
- **Look for**: Cloud Name, API Key, API Secret

### What You Need
- ✅ Cloud Name (e.g., `dabc123`)
- ✅ API Key (e.g., `987654321098765`)
- ✅ API Secret (click Reveal first)

### SDK You Need
- ✅ **Python SDK** (already configured in your code)
- ✅ Package: `cloudinary>=1.36.0`
- ✅ No manual installation needed

### Next Step
- ⏭️ Add credentials to Render (see `RENDER_ENV_VARS_SETUP.md`)

## Summary Checklist

- [x] Created Cloudinary account ✅
- [ ] Navigated to Dashboard/Console
- [ ] Found Cloud Name
- [ ] Found API Key
- [ ] Found API Secret (clicked Reveal)
- [ ] Copied all 3 values to a safe place
- [ ] Verified account is on free tier
- [ ] (Optional) Tested upload in Media Library
- [ ] Ready to add to Render

Once you have all 3 credentials copied, you're ready for the next step: adding them to Render!

## Need Help?

If you're stuck:
1. **Check Cloudinary Support**: https://support.cloudinary.com
2. **Cloudinary Docs**: https://cloudinary.com/documentation
3. **Verify Account**: Make sure email is verified
4. **Try Different Browser**: Sometimes helps with display issues

---

**You're almost there!** Once you have your 3 credentials, the next step is adding them to Render. See `RENDER_ENV_VARS_SETUP.md` for that guide.
