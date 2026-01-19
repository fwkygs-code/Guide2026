# InterGuide Logo Setup

## Required Files

To complete the logo setup, please add the following file to this directory (`frontend/public/`):

### 1. Main Logo
- **File name:** `interguide-logo.png`
- **Recommended size:** 512x512 pixels (or higher, square format)
- **Format:** PNG with transparent background
- **Usage:** This logo will be used throughout the application in headers, navigation, and branding

### 2. Open Graph Image (Optional but Recommended)
- **File name:** `og-image.png` (or use `interguide-logo.png` if you prefer)
- **Recommended size:** 1200x630 pixels
- **Format:** PNG
- **Usage:** This image appears when sharing links on social media (Facebook, Twitter, LinkedIn, etc.)

### 3. Favicon (Optional)
- **File name:** `favicon.ico`
- **Recommended size:** 32x32 or 16x16 pixels
- **Format:** ICO
- **Usage:** Browser tab icon

## Current Configuration

The application is configured to use:
- Logo path: `/interguide-logo.png`
- Open Graph image: `/interguide-logo.png` (can be changed to `/og-image.png` in `index.html`)
- Favicon: `/interguide-logo.png` (can be changed to `/favicon.ico` in `index.html`)

## Where the Logo Appears

The InterGuide logo is now used in:
1. **DashboardLayout** - Main navigation header (when no workspace logo is set)
2. **LandingPage** - Homepage navigation
3. **LoginPage** - Login page header
4. **SignupPage** - Signup page header
5. **index.html** - Favicon and Open Graph meta tags for social sharing

## Notes

- The logo file must be placed in `frontend/public/` directory
- After adding the file, rebuild the application for changes to take effect
- The logo uses `object-contain` CSS class to maintain aspect ratio
- If the logo fails to load, the application will gracefully handle the error
