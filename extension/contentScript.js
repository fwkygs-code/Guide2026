// Interguide Extension Content Script
// Capability-based binding: renders walkthroughs from background-provided data
// Walkthrough Engine: Active overlay and interaction blocking system
// ZERO AUTH LOGIC HERE - all auth handled by background service worker

console.log('[IG Content] Script loading - version 2025-02-08-13:28');

// URL SAFETY CONSTANTS
const URL_TIMEOUTS = {
  NAVIGATION: 5000,    // Max time for page navigation
  FETCH: 5000,         // Max time for network requests
  MUTATION: 3000,      // Max time for DOM changes
  ACTIVATION: 3000     // Max time for step activation
};

// Message allowlist for security
const ALLOWED_MESSAGE_TYPES = new Set([
  'PING',
  'GET_AVAILABLE_GUIDE',
  'GET_WALKTHROUGHS',
  'GET_WALKTHROUGH_STATUS',
  'GET_WALKTHROUGH_PROGRESS',
  'START_WALKTHROUGH',
  'WALKTHROUGH_ABORT',
  'WALKTHROUGH_COMPLETE',
  'ACTIVATE_OVERLAY',
  'DEACTIVATE_OVERLAY',
  'STEP_ADVANCE',
  'STEP_RETRY',
  'STATE_UPDATE',
  'GET_BINDING_STATUS',
  'RESOLVE_TARGETS',
  'CLEAR_PICKER',
  'START_PICKER',
  'STOP_PICKER',
  'REHIGHLIGHT_ELEMENT',
  'ENTER_AUTHORING_MODE',
  'EDIT_WALKTHROUGH',
  'TEST_WALKTHROUGH',
  'CAN_RESOLVE_STEP'
]);

// Session nonce validation
let currentSessionNonce = null;

function validateMessage(message) {
  // Check message type allowlist
  if (!ALLOWED_MESSAGE_TYPES.has(message.type)) {
    console.warn('[IG Content] Rejected unknown message type:', message.type);
    return false;
  }
  
  // Validate session nonce for walkthrough messages
  if (message.type.startsWith('WALKTHROUGH_') || 
      (message.type.startsWith('ACTIVATE_') && message.type !== 'ACTIVATE_OVERLAY') || 
      message.type.startsWith('DEACTIVATE_') ||
      message.type.startsWith('STEP_')) {
    if (!message.sessionNonce) {
      console.warn('[IG Content] Rejected message without session nonce:', message.type);
      return false;
    }
    
    if (currentSessionNonce && message.sessionNonce !== currentSessionNonce) {
      console.warn('[IG Content] Rejected message with invalid session nonce:', message.type);
      return false;
    }
  }
  
  return true;
}

// Payload schema validation
function assertValidStep(step, context) {
  if (!step || typeof step !== 'object' || !step.id) {
    throw new Error(`Invalid step payload in ${context}: missing or invalid 'id'`);
  }
}

// Centralized step message validation gate
function validateStepMessage(message, context) {
  if ('step' in message) {
    assertValidStep(message.step, context);
  }
}

// URL SAFETY HELPERS
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return ALLOWED_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

// Centralized timer registration for authoritative cleanup
function igSetTimeout(fn, ms) {
  const id = setTimeout(() => {
    try { 
      fn(); 
    } finally {
      // Deregister timer on fire
      window.__ig_timers?.delete(id);
    }
  }, ms);
  
  window.__ig_timers ??= new Set();
  window.__ig_timers.add(id);
  return id;
}

function createTimeout(ms, reason) {
  return new Promise((_, reject) => {
    igSetTimeout(() => reject(new Error(reason)), ms);
  });
}

function createAbortableFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUTS.FETCH);
  
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

// Global kill switch - Shift+Escape for emergency reset
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.shiftKey) {
    console.log('[IG Content] Emergency reset triggered');
    hardResetAll();
  }
});

// Monotonic cleanup guard
let teardownInProgress = false;

// Expose for overlay access
window.__ig_content_script = {
  teardownInProgress: () => teardownInProgress
};

async function hardResetAll() {
  if (teardownInProgress) return;
  teardownInProgress = true;
  
  try {
    // Remove overlays
    const overlay = document.getElementById('ig-walkthrough-overlay');
    if (overlay) overlay.remove();
    
    // Remove highlights
    const highlights = document.querySelectorAll('[style*="z-index: 2147483645"]');
    highlights.forEach(el => el.remove());
    
    // Clear any active timers
    if (window.__ig_timers) {
      for (const id of window.__ig_timers) {
        clearTimeout(id);
      }
      window.__ig_timers.clear();
    }
    
    // Reset walkthrough state
    if (window.walkthroughState) {
      window.walkthroughState.isActive = false;
      window.walkthroughState.overlay = null;
      window.walkthroughState.targetElement = null;
    }
    
    // Clear URL polling
    if (typeof urlPollTimer !== 'undefined' && urlPollTimer) {
      clearTimeout(urlPollTimer);
      urlPollTimer = null;
    }
    
    console.log('[IG Content] Hard reset complete');
  } finally {
    teardownInProgress = false;
  }
}

(function() {
  'use strict';

  // Prevent double-injection
  if (window.__IG_EXTENSION_LOADED__) return;
  window.__IG_EXTENSION_LOADED__ = true;

  const PORT_NAME = 'ig-content-script';
  const isTopFrame = window.top === window;
  
  // =========================================================================
  // WALKTHROUGH ENGINE INTEGRATION
  // =========================================================================
  
  // Walkthrough state (managed by walkthrough-overlay.js if loaded)
  let walkthroughActive = false;
  let walkthroughSession = null;
  
  // Register message listener FIRST (before any frame checks)
  // This ensures all frames can respond to PING
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[IG Content] Received message:', message.type, message);
    
    // Response-once guard to prevent double responses and survive teardown
    let responded = false;
    const safeRespond = (payload) => {
      if (responded) return;
      responded = true;
      try {
        sendResponse(payload);
      } catch (e) {
        // Ignore errors from closed ports or invalid contexts
        console.debug('[IG Content] Response failed (likely teardown):', e.message);
      }
    };
    
    // Validate message for security
    if (!validateMessage(message)) {
      safeRespond({ success: false, error: 'Message validation failed' });
      return true;
    }
    
    // Validate step payload if present
    validateStepMessage(message, message.type);
    
    // Handle message asynchronously but keep channel open
    (async () => {
      try {
        if (!message?.type) {
          safeRespond({ success: false, error: 'No message type' });
          return;
        }
        
        // Abort guard - check teardown before walkthrough state changes only
        const isWalkthroughMutation = message.type.startsWith('WALKTHROUGH_') || 
                                    message.type.startsWith('ACTIVATE_') || 
                                    message.type.startsWith('DEACTIVATE_') ||
                                    message.type.startsWith('STEP_') ||
                                    message.type === 'STATE_UPDATE';
        
        if (teardownInProgress && isWalkthroughMutation) {
          safeRespond({ success: false, error: 'Teardown in progress' });
          return;
        }
        
        // Handle CLEAR_PICKER message
        if (message.type === 'CLEAR_PICKER') {
          console.log('[IG Content] Received CLEAR_PICKER message');
          // Force clear picker state and overlay
          setPickerState('IDLE', 'FORCE');
          lockedPickerData = null;
          stopPickerMode('FORCE');
          // Also remove any toast
          const toast = document.getElementById('ig-picker-toast');
          if (toast) toast.remove();
          safeRespond({ success: true });
          return;
        }
        
        // PING is handled by ALL frames
        if (message.type === 'PING') {
          console.log('[IG Content] PING handler - teardownInProgress:', teardownInProgress);
          safeRespond({ 
            ready: true, 
            url: window.location.href, 
            isTopFrame: isTopFrame,
            frameId: isTopFrame ? 'top' : 'iframe',
            walkthroughActive: walkthroughActive
          });
          return;
        }
        
        // WALKTHROUGH MESSAGES - handled by top frame only
        if (message.type.startsWith('ACTIVATE_') || 
            message.type.startsWith('DEACTIVATE_') ||
            message.type.startsWith('STEP_') ||
            message.type === 'WALKTHROUGH_ABORT' ||
            message.type === 'WALKTHROUGH_COMPLETE' ||
            message.type === 'STATE_UPDATE') {
          
          console.log('[IG Content] Processing walkthrough message:', message.type);
          console.log('[IG Content] Is top frame:', isTopFrame);
          
          if (!isTopFrame) {
            console.log('[IG Content] Not top frame, ignoring');
            safeRespond({ success: false, error: 'Not top frame' });
            return;
          }
          
          switch (message.type) {
            case 'ACTIVATE_OVERLAY':
              // Activate walkthrough overlay system
              console.log('[IG Content] ACTIVATE_OVERLAY received', message);
              console.log('[IG Content] Message data:', message);
              console.log('[IG Content] activateWalkthrough function exists:', typeof activateWalkthrough === 'function');
              console.log('[IG Content] activateStep function exists:', typeof activateStep === 'function');
              
              if (typeof activateWalkthrough === 'function') {
                // Track session nonce
                if (message.sessionNonce) {
                  currentSessionNonce = message.sessionNonce;
                }
                
                walkthroughActive = true;
                walkthroughSession = message.session;
                console.log('[IG Content] Calling activateWalkthrough with session:', message.session);
                activateWalkthrough(message.session);
                
                if (message.step) {
                  console.log('[IG Content] Calling activateStep with step:', message.step);
                  // Add try-catch guard with watchdog timeout
                  try {
                    const ACTIVATION_TIMEOUT = 3000; // 3 seconds
                    let timeoutId;
                    const activationPromise = activateStep(message.step, 0);
                    const timeoutPromise = new Promise((_, reject) => {
                      timeoutId = igSetTimeout(() => reject(new Error('Step activation timeout')), ACTIVATION_TIMEOUT);
                    });
                    
                    const stepSuccess = await Promise.race([activationPromise, timeoutPromise]);
                    
                    // Clear timeout if activation succeeded
                    clearTimeout(timeoutId);
                    
                    if (stepSuccess === false) {
                      console.error('[IG Content] Step activation failed - aborting walkthrough');
                      walkthroughActive = false;
                      walkthroughSession = null;
                      // Notify background of failure
                      try {
                        chrome.runtime.sendMessage({
                          type: 'WALKTHROUGH_ABORT',
                          reason: 'STEP_ACTIVATION_FAILED'
                        });
                      } catch (e) {
                        // Extension context invalidated
                      }
                      safeRespond({ success: false, error: 'Step activation failed' });
                    } else {
                      safeRespond({ success: true });
                    }
                  } catch (error) {
                    console.error('[IG Content] Step activation threw exception - aborting walkthrough:', error);
                    walkthroughActive = false;
                    walkthroughSession = null;
                    // Clean up any partial state
                    if (typeof deactivateWalkthrough === 'function') {
                      deactivateWalkthrough('STEP_ACTIVATION_EXCEPTION');
                    }
                    // Notify background of failure
                    try {
                      chrome.runtime.sendMessage({
                        type: 'WALKTHROUGH_ABORT',
                        reason: error.message.includes('timeout') ? 'STEP_ACTIVATION_TIMEOUT' : 'STEP_ACTIVATION_EXCEPTION'
                      });
                    } catch (e) {
                      // Extension context invalidated
                    }
                    safeRespond({ success: false, error: error.message });
                  }
                } else {
                  safeRespond({ success: true });
                }
              } else {
                console.error('[IG Content] Walkthrough overlay not loaded');
                safeRespond({ success: false, error: 'Walkthrough overlay not loaded' });
              }
              break;
              
            case 'START_WALKTHROUGH':
              // Start walkthrough rendering (called explicitly from background)
              console.log('[IG Content] START_WALKTHROUGH received', message.walkthrough);
              console.log('[IG Content] Message data:', message);
              console.log('[IG Content] activateWalkthrough function exists:', typeof activateWalkthrough === 'function');
              
              if (typeof activateWalkthrough === 'function') {
                walkthroughActive = true;
                walkthroughSession = message.walkthrough;
                console.log('[IG Content] Starting walkthrough with:', message.walkthrough);
                activateWalkthrough(message.walkthrough);
                safeRespond({ success: true });
              } else {
                // Overlay not ready yet - queue for later
                console.log('[IG Content] Overlay not ready, queuing START_WALKTHROUGH');
                pendingWalkthroughStart = message;
                safeRespond({ success: true }); // Don't fail, just queue
              }
              break;
              
            case 'CAN_RESOLVE_STEP':
              // Check if step target can be resolved
              console.log('[IG Content] CAN_RESOLVE_STEP received', message.step);
              
              try {
                const step = message.step;
                
                // Floating step (no selector) = always resolvable
                if (!step?.targetSelectors?.primary && !step?.targetSelector) {
                  console.log('[IG Content] Floating step - always resolvable');
                  safeRespond({ ok: true });
                  return;
                }
                
                if (typeof SelectorEngine !== 'undefined' && SelectorEngine.resolve) {
                  const selectorSet = step?.targetSelectors || {
                    primary: { type: 'css_path', value: step?.targetSelector }
                  };
                  
                  const resolution = await SelectorEngine.resolve(selectorSet, document, step?.id);
                  const canResolve = resolution.success;
                  
                  console.log('[IG Content] Step resolution result:', canResolve, resolution);
                  safeRespond({ ok: canResolve });
                } else {
                  console.warn('[IG Content] SelectorEngine not available for CAN_RESOLVE_STEP');
                  safeRespond({ ok: false });
                }
              } catch (error) {
                console.error('[IG Content] CAN_RESOLVE_STEP failed:', error);
                safeRespond({ ok: false });
              }
              break;
              
            case 'DEACTIVATE_OVERLAY':
              if (typeof deactivateWalkthrough === 'function') {
                deactivateWalkthrough(message.reason);
                walkthroughActive = false;
                walkthroughSession = null;
              }
              safeRespond({ success: true });
              break;
              
            case 'STEP_ADVANCE':
              if (typeof activateStep === 'function' && message.step) {
                await activateStep(message.step, message.stepIndex);
              }
              safeRespond({ success: true });
              break;
              
            case 'STEP_RETRY':
              if (typeof activateStep === 'function' && message.step) {
                try {
                  await activateStep(message.step, message.stepIndex || 0);
                  safeRespond({ success: true });
                } catch (error) {
                  console.error('[IG Content] Step activation failed:', error);
                  // If extension context invalidated, abort walkthrough gracefully
                  if (error.message?.includes('Extension context invalidated') || 
                      error.message?.includes('context invalidated')) {
                    console.warn('[IG Content] Extension context lost during step retry, aborting walkthrough');
                    if (typeof deactivateWalkthrough === 'function') {
                      deactivateWalkthrough('EXTENSION_CONTEXT_LOST');
                    }
                    safeRespond({ success: false, error: 'Extension context lost' });
                  } else {
                    safeRespond({ success: false, error: error.message });
                  }
                }
              } else {
                safeRespond({ success: false, error: 'activateStep not available' });
              }
              break;
              
            case 'WALKTHROUGH_ABORT':
              if (typeof deactivateWalkthrough === 'function') {
                deactivateWalkthrough('abort');
              }
              walkthroughActive = false;
              safeRespond({ success: true });
              break;
              
            case 'WALKTHROUGH_COMPLETE':
              if (typeof deactivateWalkthrough === 'function') {
                deactivateWalkthrough('complete');
              }
              walkthroughActive = false;
              // Show completion notification
              showCompletionNotification(message.progress);
              safeRespond({ success: true });
              break;
              
            case 'STATE_UPDATE':
              // Handle state updates (pause/resume)
              handleWalkthroughStateUpdate(message.state);
              safeRespond({ success: true });
              break;
              
            default:
              safeRespond({ success: false, error: 'Unknown walkthrough message' });
          }
          return;
        }
        
        // All other commands are TOP FRAME ONLY
        if (!isTopFrame) {
          // Silently ignore picker commands in iframes
          safeRespond({ success: false, error: 'Not top frame' });
          return;
        }
        
        // Top frame handlers
        switch (message.type) {
          case 'START_PICKER':
            startPickerMode();
            safeRespond({ success: true });
            break;
            
          case 'STOP_PICKER':
            stopPickerMode();
            safeRespond({ success: true });
            break;
            
          case 'REHIGHLIGHT_ELEMENT':
            rehighlightElement(message.selector);
            safeRespond({ success: true });
            break;
            
          // Walkthrough Authoring Messages
          case 'ENTER_AUTHORING_MODE':
            enterAuthoringMode();
            safeRespond({ success: true });
            break;
            
          case 'EDIT_WALKTHROUGH':
            editWalkthrough(message.walkthroughId);
            safeRespond({ success: true });
            break;
            
          case 'TEST_WALKTHROUGH':
            testWalkthrough(message.walkthroughId);
            safeRespond({ success: true });
            break;
            
          default:
            safeRespond({ success: false, error: 'Unknown message type' });
        }
        
      } catch (error) {
        console.error('[IG Content] Message handler error:', error);
        safeRespond({ success: false, error: error.message });
      }
    })();
    
    // 🔒 REQUIRED: Keep message channel open for async response
    return true;
  });
  
  // Handle walkthrough state updates
  function handleWalkthroughStateUpdate(state) {
    const overlay = document.getElementById('ig-walkthrough-overlay');
    if (!overlay) return;
    
    switch (state) {
      case 'PAUSED':
        overlay.style.opacity = '0.5';
        overlay.style.pointerEvents = 'none';
        break;
      case 'ACTIVE':
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        break;
    }
  }
  
  // Show walkthrough completion notification
  function showCompletionNotification(progress) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 300px;
      animation: ig-toast-in 0.5s ease;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">✓</div>
        <div style="font-weight: 600; font-size: 16px;">Walkthrough Complete!</div>
      </div>
      <div style="font-size: 14px; opacity: 0.9;">
        You've completed all ${progress?.total || ''} steps.
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'ig-toast-in 0.5s ease reverse';
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }
  
  // Walkthrough Authoring Functions
  let pendingWalkthroughStart = null;
  let overlayReady = false;

  function enterAuthoringMode() {
    console.log('[IG Content] Entering authoring mode');
    
    // Initialize authoring controller if available
    if (window.AuthoringController) {
      window.AuthoringController.enterAuthoringMode();
    } else {
      console.warn('[IG Content] AuthoringController not available');
    }
  }
  
  function editWalkthrough(walkthroughId) {
    console.log('[IG Content] Editing walkthrough:', walkthroughId);
    
    if (window.AuthoringController) {
      window.AuthoringController.editWalkthrough(walkthroughId);
    } else {
      console.warn('[IG Content] AuthoringController not available');
    }
  }
  
  function processPendingWalkthroughStart() {
    if (pendingWalkthroughStart && typeof activateWalkthrough === 'function') {
      console.log('[IG Content] Processing queued START_WALKTHROUGH');
      walkthroughActive = true;
      walkthroughSession = pendingWalkthroughStart.walkthrough;
      console.log('[IG Content] Starting queued walkthrough with:', pendingWalkthroughStart.walkthrough);
      activateWalkthrough(pendingWalkthroughStart.walkthrough);
      pendingWalkthroughStart = null;
    }
  }
  
  // Make this available globally for overlay to call
  window.processPendingWalkthroughStart = processPendingWalkthroughStart;
  
  // If this is an iframe, stop here - don't run full content script logic
  if (!isTopFrame) {
    console.log('[IG Content] Running in iframe - minimal mode only');
    return;
  }
  
  // State (top frame only)
  let port = null;
  let currentWalkthroughs = [];
  let isBound = false;
  let isPickerMode = false;
  let pickerOverlay = null;
  let pickerCallback = null;
  let connectionRetries = 0;
  const MAX_CONNECTION_RETRIES = 5;
  
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
    try {
      if (port) return;
      if (connectionRetries >= MAX_CONNECTION_RETRIES) {
        console.log('[IG Content] Max connection retries reached, stopping retry attempts');
        return;
      }
      
      connectionRetries++;
      
      try {
        port = chrome.runtime.connect({ name: PORT_NAME });
        connectionRetries = 0; // Reset on successful connection
        
        try {
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
        } catch (e) {
          console.log('[IG Content] Extension context invalidated during message listener setup');
        }

        try {
          port.onDisconnect.addListener(() => {
            port = null;
            connectionRetries = 0; // Reset retry counter for reconnection
            // Background restarted (MV3) — reconnect faster
            console.log('[IG Content] Port disconnected, reconnecting...');
            try {
              setTimeout(ensurePort, 500);
            } catch (e) {
              console.log('[IG Content] Extension context invalidated during disconnect retry setup');
            }
          });
        } catch (e) {
          console.log('[IG Content] Extension context invalidated during disconnect listener setup');
        }
      } catch (error) {
        // Extension context invalidated (extension was reloaded)
        console.warn('[IG Content] Extension context invalidated, will retry... (attempt ' + connectionRetries + '/' + MAX_CONNECTION_RETRIES + ')');
        if (connectionRetries < MAX_CONNECTION_RETRIES) {
          try {
            setTimeout(ensurePort, 1000);
          } catch (e) {
            console.log('[IG Content] Extension context invalidated during retry scheduling');
          }
        }
      }
    } catch (e) {
      // Catch-all for any other unexpected errors
      console.log('[IG Content] Unexpected error in ensurePort:', e.message);
    }
  }
  
  // Initialize connection - exactly once
  ensurePort();

  // Check initial binding status
  async function checkBinding() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_BINDING_STATUS' });
      isBound = response?.bound || false;
      console.log('[IG Content] Binding status:', isBound);
    } catch (e) {
      console.log('[IG Content] Extension context invalidated during binding check');
      isBound = false;
    }
    if (isBound) {
      try {
        await resolveTargets(window.location.href);
      } catch (e) {
        console.log('[IG Content] Background not ready yet:', e.message);
      }
    }
  }

  // Load walkthroughs from background
  async function loadWalkthroughs() {
    try {
      console.log('[IG Content] Loading walkthroughs...');
      
      // First try to load from API (bound mode)
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGHS' });
        let walkthroughs = response?.walkthroughs || [];
        console.log('[IG Content] Loaded walkthroughs from API:', walkthroughs.length, walkthroughs);
        
        // Load from local storage (both published and drafts)
      const stored = await chrome.storage.local.get(['ig_published_walkthroughs', 'ig_draft_walkthrough_']);
      const published = stored.ig_published_walkthroughs || {};
      const publishedWalkthroughs = Object.values(published).filter(w => w.status === 'published');
      
      // Load all draft walkthroughs
      const draftWalkthroughs = [];
      for (const key in stored) {
        if (key.startsWith('ig_draft_walkthrough_') && stored[key]) {
          draftWalkthroughs.push(stored[key]);
        }
      }
      
      console.log('[IG Content] Loaded walkthroughs from local storage:', {
        published: publishedWalkthroughs.length,
        drafts: draftWalkthroughs.length
      });
      
      // Only combine published walkthroughs for rendering overlays
      // Draft walkthroughs are only for admin mode, not for users
      currentWalkthroughs = [...walkthroughs, ...publishedWalkthroughs];
      console.log('[IG Content] Total walkthroughs loaded for overlays:', currentWalkthroughs.length, currentWalkthroughs);
      
      // Store drafts separately for admin mode access
      window.__IG_DRAFT_WALKTHROUGHS__ = draftWalkthroughs;
      } catch (apiError) {
        console.log('[IG Content] Extension context invalidated during API call, using local storage only');
        walkthroughs = [];
        
        // Load from local storage (both published and drafts)
        const stored = await chrome.storage.local.get(['ig_published_walkthroughs', 'ig_draft_walkthrough_']);
        const published = stored.ig_published_walkthroughs || {};
        const publishedWalkthroughs = Object.values(published).filter(w => w.status === 'published');
        
        // Load all draft walkthroughs
        const draftWalkthroughs = [];
        for (const key in stored) {
          if (key.startsWith('ig_draft_walkthrough_') && stored[key]) {
            draftWalkthroughs.push(stored[key]);
          }
        }
        
        currentWalkthroughs = [...publishedWalkthroughs];
        window.__IG_DRAFT_WALKTHROUGHS__ = draftWalkthroughs;
        console.log('[IG Content] Fallback: Loaded walkthroughs from local storage:', currentWalkthroughs.length);
      }
    } catch (e) {
      console.error('[IG Content] Failed to load walkthroughs:', e);
      
      // Fallback to local storage only
      try {
        const stored = await chrome.storage.local.get(['ig_published_walkthroughs', 'ig_draft_walkthrough_']);
        const published = stored.ig_published_walkthroughs || {};
        const publishedWalkthroughs = Object.values(published).filter(w => w.status === 'published');
        
        // Load all draft walkthroughs
        const draftWalkthroughs = [];
        for (const key in stored) {
          if (key.startsWith('ig_draft_walkthrough_') && stored[key]) {
            draftWalkthroughs.push(stored[key]);
          }
        }
        
        currentWalkthroughs = [...publishedWalkthroughs];
        window.__IG_DRAFT_WALKTHROUGHS__ = draftWalkthroughs;
        console.log('[IG Content] Fallback: Loaded walkthroughs from local storage:', currentWalkthroughs.length);
      } catch (fallbackError) {
        console.error('[IG Content] Failed to load from local storage:', fallbackError);
        currentWalkthroughs = [];
      }
    }
  }

  // Resolve targets for current URL
  async function resolveTargets(url) {
    try {
      // Validate URL first
      if (!isValidUrl(url)) {
        console.warn('[IG Content] Invalid URL, skipping target resolution:', url);
        return;
      }
      
      console.log('[IG Content] Resolving targets for URL:', url);
      
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: 'RESOLVE_TARGETS', url }),
        createTimeout(URL_TIMEOUTS.FETCH, 'Target resolution timeout')
      ]).catch(e => {
        console.log('[IG Content] Extension context invalidated during target resolution');
        return { matches: [] };
      });
      
      console.log('[IG Content] Resolve response:', response);
      const matches = response?.matches || [];
      console.log('[IG Content] Matches:', matches.length, matches);
      
      // Show walkthrough indicators if walkthroughs are available
      if (matches.length > 0 && typeof showWalkthroughIndicators === 'function') {
        showWalkthroughIndicators(matches);
      }
    } catch (e) {
      console.error('[IG Content] Failed to resolve targets:', e);
      // Cleanup on failure
      hardResetAll();
    }
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

  // Element Picker Mode for creating targets - DISABLED
  function startPickerMode() {
    console.log('[IG Content] Picker mode disabled');
    return;
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
      }).catch(e => {
        console.log('[IG Content] Extension context invalidated during target creation');
        return null;
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

  // SPA navigation detection with timeout and polling guard
  let lastUrl = window.location.href;
  let urlPollTimer = null;

  function pollUrlChanges() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      
      // Validate new URL
      if (!isValidUrl(lastUrl)) {
        console.warn('[IG Content] Invalid URL detected, skipping:', lastUrl);
        return;
      }
      
      console.log('[IG Content] URL change detected (polling):', lastUrl);
      
      // Cleanup previous state
      hardResetAll();
      
      if (isBound && port) {
        try {
          Promise.race([
            resolveTargets(lastUrl),
            createTimeout(URL_TIMEOUTS.NAVIGATION, 'Navigation timeout')
          ]).catch(error => {
            console.error('[IG Content] Navigation resolution failed:', error);
            hardResetAll();
          });
        } catch (error) {
          console.error('[IG Content] Navigation resolution error:', error);
          hardResetAll();
        }
      }
    }
    
    // Schedule next poll only if not already scheduled
    if (!urlPollTimer) {
      urlPollTimer = igSetTimeout(() => {
        urlPollTimer = null;
        pollUrlChanges();
      }, 500);
    }
  }

  // Start polling
  pollUrlChanges();

  const observer = new MutationObserver(async (mutations) => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      // Validate new URL
      if (!isValidUrl(currentUrl)) {
        console.warn('[IG Content] Invalid URL detected, skipping:', currentUrl);
        return;
      }
      
      // Cleanup previous state
      hardResetAll();
      
      if (isBound && port) {
        try {
          await Promise.race([
            resolveTargets(currentUrl),
            createTimeout(URL_TIMEOUTS.NAVIGATION, 'Navigation timeout')
          ]);
        } catch (error) {
          console.error('[IG Content] Navigation resolution failed:', error);
          hardResetAll();
        }
      }
      return;
    }
  });

  // Initialize
  checkBinding();
  observer.observe(document, { subtree: true, childList: true });

  // Handle page unload - FORCE clear on unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    hardResetAll();
    if (pickerState !== 'IDLE') {
      stopPickerMode('FORCE');
      setPickerState('IDLE', 'FORCE');
      lockedPickerData = null;
    }
    if (port) {
      try {
        port.disconnect();
      } catch (e) {
        // Extension context invalidated - ignore during reload/update
        console.log('[Content Script] Extension context invalidated during disconnect');
      }
    }
  });

  console.log('[IG Content] Loaded - capability binding mode');
})();
