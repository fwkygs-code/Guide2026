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
  let isPickerMode = false;
  let pickerOverlay = null;
  let pickerCallback = null;

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
          
        case 'START_PICKER':
          startPickerMode(message.callback);
          break;
          
        case 'STOP_PICKER':
          stopPickerMode();
          break;
          
        case 'CREATE_TARGET':
          createTargetFromPicker(message.data);
          break;
          
        case 'REHIGHLIGHT_ELEMENT':
          rehighlightElement(message.selector);
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

  // Show toast notification on the page when element is picked
  function showPickerToast(message) {
    const toast = document.createElement('div');
    toast.id = 'ig-picker-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: ig-toast-in 0.3s ease;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 24px; height: 24px; background: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">✓</div>
        <div>${message}</div>
      </div>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ig-toast-in {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      toast.style.animation = 'ig-toast-in 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  }

  // Re-highlight element when popup reopens for visual confirmation
  function rehighlightElement(selector) {
    if (!selector) return;
    
    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.log('[IG Content] Element not found for rehighlight:', selector);
        return;
      }
      
      // Create highlight overlay
      const rect = element.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.id = 'ig-confirm-highlight';
      highlight.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 3px solid #4f46e5;
        background: rgba(79, 70, 229, 0.3);
        z-index: 2147483646;
        pointer-events: none;
        animation: ig-pulse 2s ease-in-out 3;
      `;
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes ig-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(highlight);
      
      // Remove after 6 seconds (3 pulse cycles)
      setTimeout(() => {
        highlight.remove();
      }, 6000);
      
    } catch (e) {
      console.warn('[IG Content] Failed to rehighlight element:', e);
    }
  }

  // Element Picker Mode for creating targets
  function startPickerMode() {
    if (isPickerMode) return;
    isPickerMode = true;
    
    // Create picker overlay UI
    pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'ig-picker-overlay';
    pickerOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483646;
      cursor: crosshair;
      background: rgba(79, 70, 229, 0.1);
    `;
    
    // Add instruction tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600;">Click any element to create a target</span>
        <button id="ig-picker-cancel" style="margin-left: 12px; padding: 4px 12px; background: #4f46e5; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">Cancel</button>
      </div>
    `;
    pickerOverlay.appendChild(tooltip);
    
    document.body.appendChild(pickerOverlay);
    
    // Cancel button handler
    document.getElementById('ig-picker-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      stopPickerMode();
      // Notify popup that picker was cancelled
      chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
    });
    
    // Highlight element under cursor
    let highlightedElement = null;
    let highlightBox = null;
    
    pickerOverlay.addEventListener('mousemove', (e) => {
      if (!isPickerMode) return;
      
      // Get element under cursor (ignoring our overlay)
      pickerOverlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      pickerOverlay.style.pointerEvents = 'auto';
      
      if (element && element !== highlightedElement) {
        highlightedElement = element;
        
        if (highlightBox) {
          highlightBox.remove();
        }
        
        const rect = element.getBoundingClientRect();
        highlightBox = document.createElement('div');
        highlightBox.style.cssText = `
          position: fixed;
          top: ${rect.top}px;
          left: ${rect.left}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 2px solid #4f46e5;
          background: rgba(79, 70, 229, 0.2);
          z-index: 2147483645;
          pointer-events: none;
          transition: all 0.1s ease;
        `;
        document.body.appendChild(highlightBox);
      }
    });
    
    // Click handler to select element
    pickerOverlay.addEventListener('click', (e) => {
      if (!isPickerMode) return;
      e.preventDefault();
      e.stopPropagation();
      
      // Get element under click
      pickerOverlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      pickerOverlay.style.pointerEvents = 'auto';
      
      if (element) {
        const { selector, confidence, confidenceLabel } = generateSelector(element);
        const url = window.location.href;
        
        stopPickerMode();
        
        // Store picked data temporarily (popup may be closed)
        const pickedData = {
          selector: selector,
          confidence: confidence,
          confidenceLabel: confidenceLabel,
          url: url,
          elementTag: element.tagName.toLowerCase(),
          elementText: element.textContent?.substring(0, 50) || ''
        };
        
        // Show toast on page to guide user back to popup
        showPickerToast('Element selected! Open the Interguide extension to finish creating the target.');
        
        // Try to send to popup directly
        try {
          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKED',
            data: pickedData
          });
        } catch (e) {
          console.log('[IG Content] Popup not available, storing data');
        }
        
        // Also store for when popup reopens
        chrome.storage.local.set({ pending_picked_data: pickedData });
      }
    });
    
    console.log('[IG Content] Picker mode started');
  }
  
  function stopPickerMode() {
    if (!isPickerMode) return;
    isPickerMode = false;
    
    if (pickerOverlay) {
      pickerOverlay.remove();
      pickerOverlay = null;
    }
    
    // Remove highlight box
    const highlightBox = document.querySelector('[style*="z-index: 2147483645"]');
    if (highlightBox) highlightBox.remove();
    
    console.log('[IG Content] Picker mode stopped');
  }
  
  // Generate a CSS selector for an element with confidence score
  function generateSelector(element) {
    let selector = '';
    let confidence = 'very-low';
    let confidenceLabel = '⚠️ Very Low - May break on page updates';
    
    // Try ID first (highest confidence)
    if (element.id) {
      selector = '#' + element.id;
      confidence = 'high';
      confidenceLabel = '✓ High - Stable across updates';
      return { selector, confidence, confidenceLabel };
    }
    
    // Try data-testid (medium-high confidence)
    if (element.getAttribute('data-testid')) {
      selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
      confidence = 'medium';
      confidenceLabel = '~ Medium - Test IDs may vary by environment';
      return { selector, confidence, confidenceLabel };
    }
    
    // Try data-id (medium confidence)
    if (element.getAttribute('data-id')) {
      selector = `[data-id="${element.getAttribute('data-id')}"]`;
      confidence = 'medium';
      confidenceLabel = '~ Medium - Data IDs may vary by environment';
      return { selector, confidence, confidenceLabel };
    }
    
    // Try unique class (low confidence)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c && !c.startsWith('ig-'));
      for (const cls of classes) {
        // Skip hashed classes (common in React/Vue/Angular)
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls) && !cls.match(/^[a-f0-9]{5,}$/i)) {
          const testSelector = '.' + cls;
          if (document.querySelectorAll(testSelector).length === 1) {
            selector = testSelector;
            confidence = 'low';
            confidenceLabel = '⚠️ Low - CSS classes may change';
            return { selector, confidence, confidenceLabel };
          }
        }
      }
    }
    
    // Build path from body (very low confidence)
    const path = [];
    let current = element;
    
    while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
      let sel = current.tagName.toLowerCase();
      
      if (current.id) {
        sel = '#' + current.id;
        path.unshift(sel);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('ig-'));
        if (classes.length > 0) {
          sel += '.' + classes[0];
        }
      }
      
      // Add nth-child if needed
      const siblings = Array.from(current.parentNode?.children || []).filter(
        sibling => sibling.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        sel += `:nth-of-type(${index})`;
      }
      
      path.unshift(sel);
      current = current.parentElement;
    }
    
    selector = path.join(' > ');
    confidence = 'very-low';
    confidenceLabel = '⚠️ Very Low - Position-based selectors break easily';
    
    return { selector, confidence, confidenceLabel };
  }
  
  async function createTargetFromPicker(data) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_TARGET',
        data: data
      });
      
      if (response?.success) {
        // Refresh targets to show the new one
        resolveTargets(window.location.href);
      }
    } catch (e) {
      console.error('[IG Content] Failed to create target:', e);
    }
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
