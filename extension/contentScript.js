// Interguide Extension Content Script
// Capability-based binding: renders walkthroughs from background-provided data
// ZERO AUTH LOGIC HERE - all auth handled by background service worker

(function() {
  'use strict';

  // Prevent double-injection
  if (window.__IG_EXTENSION_LOADED__) return;
  window.__IG_EXTENSION_LOADED__ = true;

  const PORT_NAME = 'ig-content-script';
  const isTopFrame = window.top === window;
  
  // Register message listener FIRST (before any frame checks)
  // This ensures all frames can respond to PING
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) return false;
    
    // PING is handled by ALL frames
    if (message.type === 'PING') {
      sendResponse({ 
        ready: true, 
        url: window.location.href, 
        isTopFrame: isTopFrame,
        frameId: isTopFrame ? 'top' : 'iframe'
      });
      return true;
    }
    
    // All other commands are TOP FRAME ONLY
    if (!isTopFrame) {
      // Silently ignore picker commands in iframes
      return false;
    }
    
    // Top frame handlers
    switch (message.type) {
      case 'START_PICKER':
        startPickerMode();
        sendResponse({ success: true });
        break;
        
      case 'STOP_PICKER':
        stopPickerMode();
        sendResponse({ success: true });
        break;
        
      case 'REHIGHLIGHT_ELEMENT':
        rehighlightElement(message.selector);
        sendResponse({ success: true });
        break;
        
      default:
        return false;
    }
    
    return true;
  });
  
  // If this is an iframe, stop here - don't run full content script logic
  if (!isTopFrame) {
    console.log('[IG Content] Running in iframe - minimal mode only');
    return;
  }
  
  // State (top frame only)
  let port = null;
  let currentWalkthroughs = [];
  let activeOverlays = [];
  let isBound = false;
  let isPickerMode = false;
  let pickerOverlay = null;
  let pickerCallback = null;
  
  // Picker state machine: IDLE -> ACTIVE -> SELECTED_LOCKED
  // SELECTED_LOCKED persists until explicit STOP_PICKER, Cancel, or Publish
  let pickerState = 'IDLE';
  let lockedPickerData = null;

  // State transition guard - prevents downgrading from SELECTED_LOCKED unless FORCE or CANCEL
  function setPickerState(next, reason) {
    if (
      pickerState === 'SELECTED_LOCKED' &&
      next !== 'SELECTED_LOCKED' &&
      !['FORCE', 'CANCEL'].includes(reason)
    ) {
      console.warn('[IG Content] State change blocked:', pickerState, '→', next, 'reason:', reason);
      return;
    }
    pickerState = next;
  }

  // Connect to background script with automatic reconnection for MV3
  function ensurePort() {
    if (port) return;
    
    port = chrome.runtime.connect({ name: PORT_NAME });
    
    port.onMessage.addListener((message) => {
      switch (message.type) {
        case 'TOKEN_BOUND':
          isBound = true;
          (async () => {
            await loadWalkthroughs();
            await resolveTargets(window.location.href);
          })();
          break;
          
        case 'TOKEN_REVOKED':
          isBound = false;
          clearAllOverlays();
          break;
          
        case 'PAGE_CHANGED':
          if (isBound) {
            (async () => {
              // Ensure walkthroughs are loaded before resolving
              if (currentWalkthroughs.length === 0) {
                await loadWalkthroughs();
              }
              await resolveTargets(message.url);
            })();
          }
          break;
          
        case 'START_PICKER':
          startPickerMode(message.callback);
          break;
          
        case 'STOP_PICKER':
          // STOP_PICKER from background only stops if not locked
          stopPickerMode('BACKGROUND');
          break;
          
        case 'CREATE_TARGET':
          createTargetFromPicker(message.data);
          break;
          
        case 'REHIGHLIGHT_ELEMENT':
          rehighlightElement(message.selector);
          break;
          
        case 'CLEAR_PICKER':
          // Force clear picker state and overlay after successful save
          setPickerState('IDLE', 'FORCE');
          lockedPickerData = null;
          stopPickerMode('FORCE');
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      // Background restarted (MV3) — reconnect faster
      console.log('[IG Content] Port disconnected, reconnecting...');
      setTimeout(ensurePort, 500);
    });
  }
  
  // Initialize connection - exactly once
  ensurePort();

  // Listen for direct messages from popup (not through port)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLEAR_PICKER') {
      console.log('[IG Content] Received CLEAR_PICKER message');
      // Force clear picker state and overlay
      setPickerState('IDLE', 'FORCE');
      lockedPickerData = null;
      stopPickerMode('FORCE');
      // Also remove any toast
      const toast = document.getElementById('ig-picker-toast');
      if (toast) toast.remove();
      sendResponse({ success: true });
    }
    return true; // Keep channel open for async response
  });

  // Check initial binding status
  async function checkBinding() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_BINDING_STATUS' });
      isBound = response?.bound || false;
      console.log('[IG Content] Binding status:', isBound);
      if (isBound) {
        await loadWalkthroughs();  // MUST await before resolving targets
        await resolveTargets(window.location.href);
      }
    } catch (e) {
      console.log('[IG Content] Background not ready yet');
    }
  }

  // Load walkthroughs from background
  async function loadWalkthroughs() {
    try {
      console.log('[IG Content] Loading walkthroughs...');
      const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGHS' });
      currentWalkthroughs = response?.walkthroughs || [];
      console.log('[IG Content] Loaded walkthroughs:', currentWalkthroughs.length, currentWalkthroughs);
    } catch (e) {
      console.error('[IG Content] Failed to load walkthroughs:', e);
    }
  }

  // Resolve targets for current URL
  async function resolveTargets(url) {
    try {
      console.log('[IG Content] Resolving targets for URL:', url);
      const response = await chrome.runtime.sendMessage({ type: 'RESOLVE_TARGETS', url });
      console.log('[IG Content] Resolve response:', response);
      const matches = response?.matches || [];
      console.log('[IG Content] Matches:', matches.length, matches);
      renderOverlays(matches);
    } catch (e) {
      console.error('[IG Content] Failed to resolve targets:', e);
    }
  }

  // Render walkthrough overlays
  function renderOverlays(matches) {
    // Clear existing overlays
    clearAllOverlays();
    
    console.log('[IG Content] renderOverlays called with', matches.length, 'matches');
    console.log('[IG Content] currentWalkthroughs:', currentWalkthroughs.length, currentWalkthroughs);
    
    if (!matches.length) {
      console.log('[IG Content] No matches to render');
      return;
    }

    matches.forEach((match, idx) => {
      console.log(`[IG Content] Processing match ${idx}:`, match);
      const walkthrough = currentWalkthroughs.find(w => w.id === match.walkthrough_id);
      console.log(`[IG Content] Found walkthrough:`, walkthrough);
      if (!walkthrough) {
        console.warn(`[IG Content] Walkthrough not found for id:`, match.walkthrough_id);
        return;
      }

      // Get step if specified
      const step = match.step_id 
        ? walkthrough.steps?.find(s => (s.step_id || s.id) === match.step_id)
        : walkthrough.steps?.[0];
      console.log(`[IG Content] Found step:`, step, 'for step_id:', match.step_id);

      if (!step) {
        console.warn(`[IG Content] Step not found`);
        return;
      }

      // Find target element (with retry for dynamic content)
      let targetElement = null;
      if (match.selector) {
        try {
          targetElement = document.querySelector(match.selector);
          console.log(`[IG Content] Target element for selector "${match.selector}":`, targetElement);
        } catch (e) {
          console.warn('[IG Content] Invalid selector:', match.selector);
        }
      }

      // Create overlay
      const overlay = createOverlay(walkthrough, step, targetElement, match.selector);
      
      // If element not found, set up observer to find it when it appears
      if (!targetElement && match.selector) {
        setupElementWatcher(overlay, match.selector);
      }
    });
  }
  
  // Watch for element appearance and reposition indicator
  function setupElementWatcher(overlay, selector) {
    if (!overlay || !selector) return;
    
    console.log(`[IG Content] Setting up watcher for selector: ${selector}`);
    
    // Try to find element with retry
    let attempts = 0;
    const maxAttempts = 100; // Try for 10 seconds (100ms * 100)
    
    const tryFindElement = () => {
      if (attempts >= maxAttempts) {
        console.log(`[IG Content] Gave up finding element after ${maxAttempts} attempts: ${selector}`);
        return;
      }
      
      attempts++;
      const element = document.querySelector(selector);
      
      if (element) {
        console.log(`[IG Content] Found element after ${attempts} attempts:`, element);
        // Update overlay with found element
        overlay.targetElement = element;
        overlay.indicator.style.display = 'block'; // Show indicator now that element is found
        positionIndicator(overlay.indicator, element);
        
        // Also update popup positioning
        overlay.indicator.removeEventListener('click', overlay._clickHandler);
        overlay._clickHandler = (e) => {
          e.stopPropagation();
          positionPopup(overlay.popup, element, overlay.indicator);
          overlay.popup.style.display = 'block';
        };
        overlay.indicator.addEventListener('click', overlay._clickHandler);
        
        // Mark as found
        overlay._elementFound = true;
      } else {
        // Try again in 100ms
        setTimeout(tryFindElement, 100);
      }
    };
    
    // Start trying immediately
    setTimeout(tryFindElement, 100);
    
    // Also set up mutation observer as backup
    const observer = new MutationObserver((mutations) => {
      if (overlay._elementFound) {
        observer.disconnect();
        return;
      }
      
      const element = document.querySelector(selector);
      if (element) {
        console.log(`[IG Content] Found element via mutation observer:`, element);
        overlay.targetElement = element;
        overlay.indicator.style.display = 'block'; // Show indicator now that element is found
        positionIndicator(overlay.indicator, element);
        overlay._elementFound = true;
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Store observer for cleanup
    overlay._observer = observer;
    
    // Stop observing after 30 seconds regardless (longer for modal/dialog content)
    setTimeout(() => {
      if (observer && !overlay._elementFound) {
        observer.disconnect();
        console.log(`[IG Content] Mutation observer timeout for: ${selector}`);
      }
    }, 30000);
  }

  // Create a single overlay with blue dot indicator
  function createOverlay(walkthrough, step, targetElement, selector) {
    // Create blue dot indicator
    const indicator = document.createElement('div');
    indicator.className = 'ig-indicator';
    indicator.style.cssText = `
      position: absolute;
      width: 12px;
      height: 12px;
      background: #4f46e5;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 2147483646;
      transition: transform 0.2s ease;
      display: none; /* Hidden by default, shown when element found */
    `;
    indicator.addEventListener('mouseenter', () => {
      indicator.style.transform = 'scale(1.2)';
    });
    indicator.addEventListener('mouseleave', () => {
      indicator.style.transform = 'scale(1)';
    });
    
    // Position indicator at top-right corner of target element (only if element exists now)
    if (targetElement) {
      indicator.style.display = 'block';
      positionIndicator(indicator, targetElement);
    }
    // If no targetElement, indicator stays hidden until watcher finds it
    
    // Create popup (hidden by default)
    const popup = document.createElement('div');
    popup.className = 'ig-walkthrough-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      max-width: 400px;
      max-height: 500px;
      overflow-y: auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1f2937;
      display: none;
    `;
    
    // Build content from step blocks or legacy content
    const contentHtml = renderStepContent(step);
    
    popup.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">IG</div>
          <div style="font-weight: 600; color: #111827; font-size: 16px;">${escapeHtml(step.title || walkthrough.title || 'Walkthrough')}</div>
          <button class="ig-close-popup" style="margin-left: auto; background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280; font-size: 18px; line-height: 1;">×</button>
        </div>
        <div class="ig-step-content">${contentHtml}</div>
      </div>
    `;
    
    // Click indicator to show popup
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      positionPopup(popup, targetElement, indicator);
      popup.style.display = 'block';
    });
    
    // Close popup handler
    popup.querySelector('.ig-close-popup').addEventListener('click', () => {
      popup.style.display = 'none';
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (popup.style.display === 'block' && !popup.contains(e.target) && !indicator.contains(e.target)) {
        popup.style.display = 'none';
      }
    });
    
    document.body.appendChild(indicator);
    document.body.appendChild(popup);
    activeOverlays.push({ indicator, popup, targetElement, selector });
  }
  
  // Render step content from blocks or legacy fields
  function renderStepContent(step) {
    // If step has blocks, render them
    if (step.blocks && Array.isArray(step.blocks) && step.blocks.length > 0) {
      return step.blocks.map(block => renderBlock(block)).join('');
    }
    
    // Legacy: render content field as HTML (don't escape - content is already HTML)
    if (step.content) {
      return `<div style="color: #4b5563;">${step.content}</div>`;
    }
    
    // Fallback
    return '<div style="color: #9ca3af; font-style: italic;">No content available</div>';
  }
  
  // Render a single block
  function renderBlock(block) {
    if (!block || typeof block !== 'object') return '';
    
    const type = block.type || 'text';
    const data = block.data || {};
    const settings = block.settings || {};
    
    switch (type) {
      case 'text':
        const text = data.text || data.content || '';
        const textAlign = settings.textAlign || 'left';
        return `<div style="color: #374151; margin-bottom: 12px; text-align: ${textAlign};">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
        
      case 'heading':
        const headingText = data.text || data.content || '';
        const level = data.level || settings.level || 'h2';
        const fontSize = level === 'h1' ? '24px' : level === 'h2' ? '20px' : '16px';
        return `<${level} style="color: #111827; margin: 16px 0 12px 0; font-size: ${fontSize}; font-weight: 600;">${escapeHtml(headingText)}</${level}>`;
        
      case 'image':
        const imageUrl = data.url || data.src || '';
        const imageAlt = data.alt || '';
        const maxWidth = settings.maxWidth || '100%';
        if (!imageUrl) return '';
        return `<div style="margin: 12px 0;"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" style="max-width: ${maxWidth}; border-radius: 8px; display: block;"></div>`;
        
      case 'video':
        const videoUrl = data.url || data.src || '';
        if (!videoUrl) return '';
        return `<div style="margin: 12px 0;"><video src="${escapeHtml(videoUrl)}" controls style="max-width: 100%; border-radius: 8px; display: block;"></video></div>`;
        
      case 'link':
        const linkUrl = data.url || data.href || '#';
        const linkText = data.text || data.label || linkUrl;
        const linkStyle = settings.style || 'button';
        if (linkStyle === 'button') {
          return `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 8px 0;">${escapeHtml(linkText)}</a>`;
        } else {
          return `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener" style="color: #4f46e5; text-decoration: underline;">${escapeHtml(linkText)}</a>`;
        }
        
      case 'list':
        const items = data.items || data.list || [];
        const listType = settings.listType || data.listType || 'bullet';
        const listStyle = listType === 'numbered' ? 'decimal' : 'disc';
        const tag = listType === 'numbered' ? 'ol' : 'ul';
        return `<${tag} style="margin: 12px 0; padding-left: 24px; color: #374151;">${items.map(item => `<li style="margin-bottom: 4px;">${escapeHtml(item)}</li>`).join('')}</${tag}>`;
        
      case 'divider':
        return '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">';
        
      default:
        return `<div style="color: #9ca3af; margin: 8px 0;">Unknown block type: ${escapeHtml(type)}</div>`;
    }
  }
  
  // Position indicator at element corner
  function positionIndicator(indicator, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Position at top-right corner of element
    indicator.style.position = 'absolute';
    indicator.style.top = `${rect.top + scrollY - 6}px`;
    indicator.style.left = `${rect.right + scrollX - 6}px`;
  }
  
  // Position popup near indicator
  function positionPopup(popup, targetElement, indicator) {
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      // Position to the right of the element
      let left = rect.right + scrollX + 16;
      let top = rect.top + scrollY;
      
      // Check if goes off screen to right
      if (left + 400 > window.innerWidth + scrollX) {
        // Position to the left instead
        left = rect.left + scrollX - 416;
      }
      
      // Check if goes off screen to bottom
      if (top + 300 > window.innerHeight + scrollY) {
        top = Math.max(16, window.innerHeight + scrollY - 300);
      }
      
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    } else {
      // Center in viewport
      popup.style.left = '50%';
      popup.style.top = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
    }
  }

  // Clear all overlays
  function clearAllOverlays() {
    activeOverlays.forEach(overlay => {
      if (overlay.indicator && overlay.indicator.parentNode) {
        overlay.indicator.parentNode.removeChild(overlay.indicator);
      }
      if (overlay.popup && overlay.popup.parentNode) {
        overlay.popup.parentNode.removeChild(overlay.popup);
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
    // If picker is already locked with selection, don't restart
    if (pickerState === 'SELECTED_LOCKED') {
      console.log('[IG Content] Picker locked with selection - not restarting');
      return;
    }
    
    // If picker is already active, don't restart
    if (isPickerMode || pickerState === 'ACTIVE') {
      console.log('[IG Content] Picker already active - not restarting');
      return;
    }
    
    isPickerMode = true;
    setPickerState('ACTIVE', 'START');
    
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
      stopPickerMode('CANCEL');
      // Clear locked state on cancel
      setPickerState('IDLE', 'CANCEL');
      lockedPickerData = null;
      // Notify popup that picker was cancelled
      chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
    });
    
    // Highlight element under cursor
    let highlightedElement = null;
    let highlightBox = null;
    
    pickerOverlay.addEventListener('mousemove', (e) => {
      if (!isPickerMode || pickerState !== 'ACTIVE') return;
      
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
      if (!isPickerMode || pickerState !== 'ACTIVE') return;
      e.preventDefault();
      e.stopPropagation();
      
      // Get element under click
      pickerOverlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      pickerOverlay.style.pointerEvents = 'auto';
      
      if (element) {
        const { selector, confidence, confidenceLabel } = generateSelector(element);
        const url = window.location.href;
        
        // Transition to locked state
        setPickerState('SELECTED_LOCKED', 'SELECT');
        lockedPickerData = {
          selector: selector,
          confidence: confidence,
          confidenceLabel: confidenceLabel,
          url: url,
          elementTag: element.tagName.toLowerCase(),
          elementText: element.textContent?.substring(0, 50) || ''
        };
        
        // Keep picker overlay but change UI to show selection is locked
        if (pickerOverlay) {
          pickerOverlay.style.cursor = 'default';
          pickerOverlay.style.background = 'rgba(79, 70, 229, 0.05)';
          const tooltipEl = pickerOverlay.querySelector('div');
          if (tooltipEl) {
            tooltipEl.innerHTML = `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600;">Element selected! Open popup to save target.</span>
                <button id="ig-picker-cancel-locked" style="margin-left: 12px; padding: 4px 12px; background: #4f46e5; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">Cancel</button>
              </div>
            `;
            document.getElementById('ig-picker-cancel-locked').addEventListener('click', (e) => {
              e.stopPropagation();
              stopPickerMode('CANCEL');
              setPickerState('IDLE', 'CANCEL');
              lockedPickerData = null;
              chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
            });
          }
        }
        
        // Show toast on page to guide user back to popup
        showPickerToast('Element selected! Open the Interguide extension to finish creating the target.');
        
        // Try to send to popup directly
        try {
          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKED',
            data: lockedPickerData
          });
        } catch (e) {
          console.log('[IG Content] Popup not available, storing data');
        }
        
        // Also store for when popup reopens
        chrome.storage.local.set({ pending_picked_data: lockedPickerData });
      }
    });
    
    console.log('[IG Content] Picker mode started - state: ACTIVE');
  }
  
  function stopPickerMode(reason = 'UNKNOWN') {
    // Hard gate: if locked, only specific reasons may clear
    if (pickerState === 'SELECTED_LOCKED' && !['FORCE', 'CANCEL'].includes(reason)) {
      console.warn('[IG Content] Cleanup blocked:', reason, '- picker is locked');
      return;
    }
    
    isPickerMode = false;
    
    if (pickerOverlay) {
      pickerOverlay.remove();
      pickerOverlay = null;
    }
    
    // Remove highlight box
    const highlightBox = document.querySelector('[style*="z-index: 2147483645"]');
    if (highlightBox) highlightBox.remove();
    
    // Note: pickerState and lockedPickerData are NOT cleared here unless FORCE
    // They persist until explicit cancel, publish, or page unload
    // This allows popup to reopen and find the selection still active
    
    console.log('[IG Content] Picker mode stopped - reason:', reason, 'state:', pickerState);
  }
  
  // Generate a CSS selector for an element with confidence score
  function generateSelector(element) {
    let selector = '';
    let confidence = 'very-low';
    let confidenceLabel = '⚠️ Very Low - May break on page updates';
    
    // Helper to detect .NET WebForms dynamic IDs
    function isDotNetDynamicId(id) {
      if (!id) return false;
      // Patterns: ctl00_, ContentPlaceHolder, _ctl00_, etc.
      return /ctl\d+_|_ctl\d+_|ContentPlaceHolder|MasterPage|__VIEWSTATE/.test(id);
    }
    
    // Helper to detect hashed classes (React/Vue/Angular scoped styles)
    function isHashedClass(cls) {
      return /^[a-f0-9]{5,}$/i.test(cls) || /_[a-z0-9]{5,}$/i.test(cls);
    }
    
    // Try ID first (highest confidence) - but NOT if it's a .NET dynamic ID
    if (element.id && !isDotNetDynamicId(element.id)) {
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
    
    // Try aria-label (medium confidence)
    if (element.getAttribute('aria-label')) {
      selector = `[aria-label="${element.getAttribute('aria-label')}"]`;
      confidence = 'medium';
      confidenceLabel = '~ Medium - ARIA labels may change';
      return { selector, confidence, confidenceLabel };
    }
    
    // Try name attribute (medium confidence)
    if (element.name) {
      selector = `[name="${element.name}"]`;
      confidence = 'medium';
      confidenceLabel = '~ Medium - Names may vary';
      return { selector, confidence, confidenceLabel };
    }
    
    // Try unique class (low confidence)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c && !c.startsWith('ig-') && !isHashedClass(c));
      for (const cls of classes) {
        // Skip numeric-only classes and very short classes
        if (/^[a-zA-Z][a-zA-Z0-9_-]{2,}$/.test(cls)) {
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
    
    // Try text content for links and buttons
    if ((element.tagName === 'A' || element.tagName === 'BUTTON') && element.textContent) {
      const text = element.textContent.trim().substring(0, 30);
      if (text && text.length > 2) {
        // Check if text is unique
        const textSelector = `${element.tagName.toLowerCase()}:contains("${text}")`;
        // Note: :contains is not standard CSS, but useful for reference
        // Store the text for potential JavaScript matching
        element._igTextContent = text;
      }
    }
    
    // Build path from body (very low confidence)
    const path = [];
    let current = element;
    
    while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
      let sel = current.tagName.toLowerCase();
      
      if (current.id && !isDotNetDynamicId(current.id)) {
        // Found a stable ID in parent - use it as anchor
        sel = '#' + current.id;
        path.unshift(sel);
        break;
      }
      
      // Add stable classes (skip dynamic/hashed ones)
      if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .split(' ')
          .filter(c => c && !c.startsWith('ig-') && !isHashedClass(c) && /^[a-zA-Z][a-zA-Z0-9_-]{2,}$/.test(c));
        if (classes.length > 0) {
          // Use first stable class
          sel += '.' + classes[0];
        }
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(current.parentNode?.children || []).filter(
        sibling => sibling.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        sel += `:nth-of-type(${index})`;
      }
      
      path.unshift(sel);
      current = current.parentElement;
      
      // Limit path length to avoid extremely long selectors
      if (path.length >= 6) {
        break;
      }
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
        // Clear picker state and locked data
        setPickerState('IDLE', 'FORCE');
        lockedPickerData = null;
        stopPickerMode('FORCE');
        // Refresh targets to show the new one
        await resolveTargets(window.location.href);
      }
    } catch (e) {
      console.error('[IG Content] Failed to create target:', e);
    }
  }

  // SPA navigation detection - also detects significant DOM changes (tab switches)
  let lastUrl = window.location.href;
  let lastTargetElements = new Set();
  
  function checkTargets() {
    // Check if any target elements have appeared/disappeared
    let changed = false;
    activeOverlays.forEach(overlay => {
      if (overlay.selector) {
        const element = document.querySelector(overlay.selector);
        const hadElement = overlay.targetElement !== null;
        const hasElement = element !== null;
        if (hadElement !== hasElement) {
          changed = true;
        }
      }
    });
    
    // If significant changes detected, re-resolve targets
    if (changed && isBound) {
      console.log('[IG Content] Target elements changed, re-resolving');
      resolveTargets(window.location.href);
    }
  }
  
  const observer = new MutationObserver((mutations) => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (isBound && port) {
        resolveTargets(currentUrl);
      }
      return;
    }
    
    // Check for significant DOM changes (modal/tab content appearing)
    // Use debounce to avoid excessive checks
    if (window._targetCheckTimeout) {
      clearTimeout(window._targetCheckTimeout);
    }
    window._targetCheckTimeout = setTimeout(checkTargets, 500);
  });

  // Initialize
  checkBinding();
  observer.observe(document, { subtree: true, childList: true });

  // Handle page unload - FORCE clear on unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    clearAllOverlays();
    if (pickerState !== 'IDLE') {
      stopPickerMode('FORCE');
      setPickerState('IDLE', 'FORCE');
      lockedPickerData = null;
    }
    if (port) {
      port.disconnect();
    }
  });

  console.log('[IG Content] Loaded - capability binding mode');
})();
