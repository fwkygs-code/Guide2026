# InterGuide Landing Page

A beautiful, futuristic landing page for InterGuide featuring glass morphism design and smooth animations.

## Features

- ✨ **Glass Morphism Design**: Modern, frosted glass effects with backdrop blur
- 🎨 **Futuristic UI**: Gradient backgrounds, smooth animations, and elegant typography
- 📱 **Responsive**: Optimized for all devices and screen sizes
- ⚡ **Fast Loading**: Minimal dependencies, optimized for performance
- 🎯 **Conversion Focused**: Clear CTAs and compelling copy

## Local Development

```bash
# Open index.html in your browser
open index.html
# or
python -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

This is a static HTML page that can be deployed to any static hosting service:

### Netlify (Recommended)
1. Connect your GitHub repository
2. Set build command: (not needed - static)
3. Set publish directory: `landing-page/`
4. Deploy!

### Vercel
1. Import your project
2. Set root directory to `landing-page/`
3. Deploy automatically

### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Set source to `main` branch and `/landing-page` folder
3. Your site will be available at `https://[username].github.io/[repo]/landing-page/`

### Other Platforms
- AWS S3 + CloudFront
- Firebase Hosting
- Render (static site)
- Cloudflare Pages

## Customization

### Colors
Edit the CSS variables in the `<style>` section to customize colors:
- Primary gradient: `#6366f1, #a855f7`
- Background gradients in `.glass` and `.glass-dark` classes
- Text colors and opacity values

### Content
Update the HTML content in the respective sections:
- Hero section text and CTAs
- Feature descriptions and icons
- Stats numbers and labels
- Footer links and copyright

### Animations
Modify the `@keyframes float` animation or add new animations in the CSS.

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with gradients, backdrop-filter, and animations
- **Google Fonts**: Inter font family
- **Vanilla JavaScript**: Smooth scrolling and interactive effects

## Browser Support

- Chrome 76+
- Firefox 70+
- Safari 9+
- Edge 79+

*Note: Backdrop-filter effects may not work in older browsers, but the design gracefully degrades.*