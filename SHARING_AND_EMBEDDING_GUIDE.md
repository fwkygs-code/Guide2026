# Sharing & Embedding Guide

## Overview
The portal and walkthroughs can now be shared and embedded in any website, CRM, or application.

## Features Implemented

### 1. Portal Sharing
- **Share Link**: Direct link to the portal
- **Embed Code**: iFrame code for embedding the entire portal
- **API Endpoint**: JSON API for custom integrations

### 2. Walkthrough Sharing
- **Share Link**: Direct link to individual walkthroughs
- **Embed Code**: iFrame code for embedding specific walkthroughs
- **Auto-detection**: Works seamlessly in iframes

### 3. Embedding Methods

#### Method 1: iFrame Embed (Recommended)
```html
<!-- Embed entire portal -->
<iframe 
  src="https://your-domain.com/embed/portal/workspace-slug" 
  width="100%" 
  height="800" 
  frameborder="0" 
  allowfullscreen>
</iframe>

<!-- Embed specific walkthrough -->
<iframe 
  src="https://your-domain.com/embed/portal/workspace-slug/walkthrough-id" 
  width="100%" 
  height="600" 
  frameborder="0" 
  allowfullscreen>
</iframe>
```

#### Method 2: JavaScript Widget
```html
<!-- Embed portal -->
<script 
  src="https://your-domain.com/embed/widget.js" 
  data-slug="workspace-slug">
</script>

<!-- Embed specific walkthrough -->
<script 
  src="https://your-domain.com/embed/widget.js" 
  data-slug="workspace-slug"
  data-walkthrough-id="walkthrough-id">
</script>

<!-- Custom container and size -->
<script 
  src="https://your-domain.com/embed/widget.js" 
  data-slug="workspace-slug"
  data-container="#my-container"
  data-width="100%"
  data-height="800px">
</script>
```

### 4. CRM Integration

#### Salesforce
1. Create a Visualforce Page or Lightning Web Component
2. Use the iframe embed code
3. Set proper CSP (Content Security Policy) to allow your domain

#### HubSpot
1. Go to Content > Website Pages
2. Add HTML module
3. Paste the iframe embed code

#### Zendesk
1. Go to Guide > Themes
2. Edit your theme
3. Add the embed code to the appropriate section

#### Custom CRM Integration
Use the API endpoint:
```
GET https://your-domain.com/api/portal/{slug}
```
Returns JSON with workspace, categories, and walkthroughs data.

## How to Access Sharing Features

### From Settings Page
1. Navigate to Workspace Settings
2. Go to "Public Portal" section
3. Use tabs: Share, Embed, Integration

### From Walkthroughs Page
1. Find a published walkthrough
2. Click the Share button (📤 icon)
3. Choose "Share Link" or "Embed Code"

## Technical Details

### CORS Configuration
- Backend supports CORS for all origins (configurable)
- Headers exposed for embedding
- Methods and headers allowed for cross-origin requests

### Iframe Detection
- Portal and walkthrough pages detect iframe mode
- Header and footer hidden in iframe
- Responsive height adjustment (optional)
- Clean, borderless appearance

### Security
- Only published walkthroughs can be shared
- Private walkthroughs are not accessible
- Password-protected walkthroughs require authentication
- All data sanitized for public access

## Best Practices

1. **Responsive Design**: Use `width="100%"` for responsive embedding
2. **Height**: Set appropriate height (600-800px recommended)
3. **Security**: Only share published, public walkthroughs
4. **Testing**: Test embeds in your target platform before sharing
5. **CSP**: Configure Content Security Policy if needed

## Troubleshooting

### Iframe not loading
- Check CORS settings
- Verify the URL is correct
- Ensure walkthrough is published
- Check browser console for errors

### Widget not working
- Ensure script tag has `data-slug` attribute
- Check that widget.js is accessible
- Verify container element exists (if using data-container)

### Images not showing
- Images are normalized to absolute URLs
- Ensure CORS allows image loading
- Check that image URLs are accessible
