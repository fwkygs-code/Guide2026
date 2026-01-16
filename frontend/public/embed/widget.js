/**
 * InterGuide Embed Widget
 * Automatically embeds walkthroughs or portal into your website
 * 
 * Usage:
 * <script src="https://your-domain.com/embed/widget.js" data-slug="workspace-slug"></script>
 * 
 * Options:
 * - data-slug: Workspace slug (required)
 * - data-walkthrough-id: Specific walkthrough ID (optional, if not provided shows portal)
 * - data-width: Width of iframe (default: 100%)
 * - data-height: Height of iframe (default: 600px)
 * - data-container: CSS selector for container (default: creates new div)
 */

(function() {
  'use strict';
  
  // Get script tag
  const script = document.currentScript || document.querySelector('script[data-slug]');
  if (!script) return;
  
  const slug = script.getAttribute('data-slug');
  const walkthroughId = script.getAttribute('data-walkthrough-id');
  const width = script.getAttribute('data-width') || '100%';
  const height = script.getAttribute('data-height') || '600px';
  const containerSelector = script.getAttribute('data-container');
  
  if (!slug) {
    console.error('InterGuide: data-slug attribute is required');
    return;
  }
  
  // Build embed URL
  const baseUrl = window.location.origin;
  let embedUrl = `${baseUrl}/embed/portal/${slug}`;
  if (walkthroughId) {
    embedUrl = `${baseUrl}/embed/portal/${slug}/${walkthroughId}`;
  }
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.width = width;
  iframe.height = height;
  iframe.frameBorder = '0';
  iframe.allowFullscreen = true;
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.setAttribute('title', 'InterGuide Portal');
  
  // Find or create container
  let container;
  if (containerSelector) {
    container = document.querySelector(containerSelector);
    if (!container) {
      console.error(`InterGuide: Container "${containerSelector}" not found`);
      return;
    }
  } else {
    container = document.createElement('div');
    container.className = 'interguide-embed';
    script.parentNode.insertBefore(container, script);
  }
  
  // Append iframe
  container.appendChild(iframe);
  
  // Handle responsive height (optional)
  if (height === 'auto' || height.includes('auto')) {
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'interguide-height' && event.data.slug === slug) {
        iframe.style.height = event.data.height + 'px';
      }
    });
  }
  
  console.log('InterGuide: Widget loaded successfully');
})();
