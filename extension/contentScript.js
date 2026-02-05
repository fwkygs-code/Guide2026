// Interguide Extension Content Script
// Capability-based binding: renders walkthroughs from background-provided data
// ZERO AUTH LOGIC HERE - all auth handled by background service worker

(function() {
  'use strict';

  // Prevent double-injection
  if (window.__IG_EXTENSION_LOADED__) return;
  window.__IG_EXTENSION_LOADED__ = true;

  const PORT_NAME = 'ig-content-script';
  
  // State
  let port = null;
  let currentWalkthroughs = [];
  let activeOverlays = [];
  let isBound = false;

  // Connect to background script
  function connect() {
    port = chrome.runtime.connect({ name: PORT_NAME });
    
    port.onMessage.addListener((message) => {
      switch (message.type) {
        case 'TOKEN_BOUND':
          isBound = true;
          loadWalkthroughs();
          break;
          
        case 'TOKEN_REVOKED':
          isBound = false;
          clearAllOverlays();
          break;
          
        case 'PAGE_CHANGED':
          if (isBound) {
            resolveTargets(message.url);
          }
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      // Attempt reconnect after short delay
      setTimeout(connect, 1000);
    });
  }

  // Check initial binding status
  async function checkBinding() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_BINDING_STATUS' });
      isBound = response?.bound || false;
      if (isBound) {
        loadWalkthroughs();
        resolveTargets(window.location.href);
      }
    } catch (e) {
      console.log('[IG Content] Background not ready yet');
    }
  }

  // Load walkthroughs from background
  async function loadWalkthroughs() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGHS' });
      currentWalkthroughs = response?.walkthroughs || [];
    } catch (e) {
      console.error('[IG Content] Failed to load walkthroughs:', e);
    }
  }

  // Resolve targets for current URL
  async function resolveTargets(url) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RESOLVE_TARGETS', url });
      const matches = response?.matches || [];
      renderOverlays(matches);
    } catch (e) {
      console.error('[IG Content] Failed to resolve targets:', e);
    }
  }

  // Render walkthrough overlays
  function renderOverlays(matches) {
    // Clear existing overlays
    clearAllOverlays();
    
    if (!matches.length) return;

    matches.forEach((match) => {
      const walkthrough = currentWalkthroughs.find(w => w.id === match.walkthrough_id);
      if (!walkthrough) return;

      // Get step if specified
      const step = match.step_id 
        ? walkthrough.steps?.find(s => (s.id || s.step_id) === match.step_id)
        : walkthrough.steps?.[0];

      if (!step) return;

      // Find target element
      let targetElement = null;
      if (match.selector) {
        try {
          targetElement = document.querySelector(match.selector);
        } catch (e) {
          console.warn('[IG Content] Invalid selector:', match.selector);
        }
      }

      // Create overlay
      createOverlay(walkthrough, step, targetElement, match.selector);
    });
  }

  // Create a single overlay
  function createOverlay(walkthrough, step, targetElement, selector) {
    const overlay = document.createElement('div');
    overlay.className = 'ig-walkthrough-overlay';
    overlay.setAttribute('data-walkthrough-id', walkthrough.id);
    overlay.setAttribute('data-step-id', step.id || step.step_id);
    
    // Styles
    overlay.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      max-width: 320px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      padding: 16px;
      pointer-events: auto;
    `;

    // Content
    const title = step.title || walkthrough.title || 'Walkthrough';
    const content = step.content || step.description || '';
    
    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 24px; height: 24px; background: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">IG</div>
        <div style="font-weight: 600; color: #111827;">${escapeHtml(title)}</div>
        <button class="ig-close-btn" style="margin-left: auto; background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;">×</button>
      </div>
      <div style="color: #4b5563;">${escapeHtml(content)}</div>
    `;

    // Position
    if (targetElement) {
      positionOverlay(overlay, targetElement);
    } else {
      // Default position: bottom-right
      overlay.style.right = '16px';
      overlay.style.bottom = '16px';
    }

    // Close handler
    overlay.querySelector('.ig-close-btn').addEventListener('click', () => {
      overlay.remove();
      activeOverlays = activeOverlays.filter(o => o !== overlay);
    });

    document.body.appendChild(overlay);
    activeOverlays.push(overlay);
  }

  // Position overlay near target element
  function positionOverlay(overlay, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Position below element by default
    let top = rect.bottom + scrollY + 8;
    let left = rect.left + scrollX;
    
    // Check if it goes off screen
    const overlayRect = overlay.getBoundingClientRect();
    if (left + 320 > window.innerWidth) {
      left = rect.right + scrollX - 320;
    }
    if (top + 200 > window.innerHeight + scrollY) {
      top = rect.top + scrollY - overlayRect.height - 8;
    }
    
    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
  }

  // Clear all overlays
  function clearAllOverlays() {
    activeOverlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    activeOverlays = [];
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // SPA navigation detection
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (isBound && port) {
        resolveTargets(currentUrl);
      }
    }
  });

  // Initialize
  connect();
  checkBinding();
  observer.observe(document, { subtree: true, childList: true });

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    clearAllOverlays();
    if (port) {
      port.disconnect();
    }
  });

  console.log('[IG Content] Loaded - capability binding mode');
})();
