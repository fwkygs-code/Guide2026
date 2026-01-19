# Email Setup Guide - Resend (Free)

This guide will help you set up email verification using Resend, a free email service.

## Step 1: Create Resend Account

1. Go to **https://resend.com**
2. Click **"Sign Up"** or **"Get Started"**
3. Sign up with your email (free account)
4. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to **https://resend.com/api-keys**
2. Click **"Create API Key"**
3. Give it a name (e.g., "Guide2026 Production")
4. Select permissions: **"Sending access"**
5. Click **"Add"**
6. **Copy the API key** (you'll only see it once!)

## Step 3: Add Domain (Optional but Recommended)

For production, you should verify your domain:

1. Go to **https://resend.com/domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `guide2026.com`)
4. Add the DNS records Resend provides to your domain registrar
5. Wait for verification (usually a few minutes)

**Note:** For testing, you can use Resend's default domain, but emails may go to spam.

## Step 4: Configure Render Environment Variables

1. Go to your **Render Dashboard**: https://dashboard.render.com
2. Select your **backend service** (`guide2026-backend`)
3. Click on **"Environment"** tab
4. Click **"Add Environment Variable"** and add these:

### Required Variables:

```
RESEND_API_KEY = <YOUR_RESEND_API_KEY>
RESEND_FROM_EMAIL = auth@interguide.app
FRONTEND_URL = https://guide2026-frontend.onrender.com
```

**Note:** The application uses Resend HTTP API (not SMTP). Make sure to verify the `interguide.app` domain in Resend before using `auth@interguide.app`.

## Step 5: Save and Redeploy

1. Click **"Save Changes"** in Render
2. Render will automatically redeploy your backend
3. Wait for deployment to complete (2-3 minutes)

## Step 6: Test Email Verification

1. Create a new test account
2. Check your email inbox
3. You should receive a verification email
4. Click the verification link

## Troubleshooting

### Emails Not Sending?

1. **Check Render logs**: Go to your backend service → "Logs" tab
2. Look for errors like:
   - `Failed to send verification email`
   - `SMTP authentication failed`
   - `Connection refused`

3. **Verify API Key**: Make sure you copied the full API key (starts with `re_`)

4. **Check SMTP Settings**: Verify all environment variables are correct

### Emails Going to Spam?

- Use a verified domain (use `auth@interguide.app` after verifying interguide.app domain in Resend)
- Add SPF/DKIM records from Resend to your domain
- Wait 24-48 hours for domain reputation to build

### Alternative: Use Gmail SMTP (Not Recommended for Production)

If you want to test with Gmail:

```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASSWORD = your-app-password  # NOT your regular password!
SMTP_FROM_EMAIL = your-email@gmail.com
SMTP_FROM_NAME = Guide2026
```

**Note:** Gmail requires an "App Password" - enable 2FA and generate one at https://myaccount.google.com/apppasswords

## Free Tier Limits

**Resend Free Tier:**
- 3,000 emails/month
- 100 emails/day
- Perfect for testing and small apps

**Upgrade when needed:**
- $20/month for 50,000 emails/month
- Scales automatically

## Security Notes

- ✅ Never commit API keys to Git
- ✅ Use environment variables only
- ✅ Rotate API keys periodically
- ✅ Use verified domains in production

## Next Steps

After setup:
1. Test signup → should receive verification email
2. Test resend → click "Resend Email" button
3. Test verification → click link in email
4. Verify banner disappears after verification

Your email verification system is now ready! 🎉