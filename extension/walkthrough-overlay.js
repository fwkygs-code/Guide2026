/**
 * Walkthrough Engine - Content Script Overlay & Interaction Blocking
 * 
 * Handles:
 * - Full-page overlay blocking all non-step interactions
 * - Target element highlighting with multiple visual styles
 * - Event capture and filtering (only step-relevant events pass)
 * - State persistence across page reloads
 * - Navigation prevention within scope
 * 
 * This is NOT a tooltip system - it's a controlled onboarding engine.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const WALKTHROUGH_CONFIG = {
  // Z-index layers (must be above everything on page)
  zIndex: {
    overlay: 2147483640,
    highlight: 2147483645,
    tooltip: 2147483650,
    modal: 2147483655,
    pulse: 2147483646
  },
  
  // CSS Classes for styling
  classes: {
    overlay: 'ig-walkthrough-overlay',
    overlayHole: 'ig-walkthrough-hole',
    highlightBox: 'ig-walkthrough-highlight',
    highlightPulse: 'ig-walkthrough-pulse',
    tooltip: 'ig-walkthrough-tooltip',
    blockedEvent: 'ig-walkthrough-blocked',
    navigationBlocker: 'ig-walkthrough-nav-blocker'
  },
  
  // Event types to block (by default)
  blockedEvents: [
    'click', 'mousedown', 'mouseup',
    'submit', 'change', 'input',
    'focus', 'blur', 'contextmenu',
    'dblclick', 'dragstart', 'drop'
  ],
  
  // Event types to capture for step validation
  captureEvents: [
    'click', 'input', 'change', 'submit',
    'keydown', 'scroll'
  ],
  
  // Keyboard keys that are always allowed (even on non-target)
  allowedKeys: ['Escape'], // Escape for abort request
  
  // Keys that are only allowed on target element
  allowedOnTarget: ['Enter', 'Space', 'Tab'],
  
  // Modifiers that are always blocked
  blockedModifiers: ['ctrlKey', 'metaKey', 'altKey']
};

// ============================================================================
// STATE
// ============================================================================

const walkthroughState = {
  isActive: false,
  sessionId: null,
  currentStep: null,
  stepIndex: -1,
  targetElement: null,
  targetSelector: null,
  
  // Selector resolution state
  selectorResolution: {
    attempts: [],
    currentStrategy: null,
    isWaitingForMutation: false,
    observer: null
  },
  
  // Failure handling state
  failureState: {
    type: null, // 'element_not_found', 'validation_failed', 'navigation_blocked', 'timeout'
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    isRecovering: false
  },
  
  // Admin debug state
  debugMode: false,
  eventLog: [],
  debugPanel: null,
  
  // DOM elements
  overlay: null,
  highlightElement: null,
  tooltipElement: null,
  holeElement: null,
  failureUI: null,
  
  // Event handlers (stored for cleanup)
  eventHandlers: new Map(),
  
  // Mutation observer for target tracking
  targetObserver: null,
  
  // Validation state
  validationPending: false,
  collectedData: {}
};

/**
 * SELECTOR ROBUSTNESS ENGINE
 * Layered selector resolution with fallbacks and stability scoring
 */

const SelectorEngine = {
  config: {
    maxRetries: 10,
    retryInterval: 500,
    mutationTimeout: 5000,
    stabilityThreshold: 0.5
  },

  // Cancellation token for current resolution
  currentToken: null,

  /**
   * Generate unique cancellation token for this resolution
   */
  createToken(stepId) {
    return {
      stepId,
      nonce: Math.random().toString(36).substring(2, 15),
      timestamp: Date.now()
    };
  },

  /**
   * Check if token is still valid (not cancelled)
   */
  isValid(token) {
    return token && 
           this.currentToken && 
           token.nonce === this.currentToken.nonce &&
           token.stepId === this.currentToken.stepId;
  },

  /**
   * Cancel any in-progress resolution
   */
  cancel() {
    this.currentToken = null;
  },

  /**
   * Resolve a SelectorSet to a DOM element
   */
  async resolve(selectorSet, context = document, stepId = null) {
    // Cancel any previous resolution
    this.cancel();
    
    // Create new cancellation token for this resolution
    const token = this.createToken(stepId);
    this.currentToken = token;
    
    const startTime = performance.now();
    const attempts = [];
    
    // Update state
    walkthroughState.selectorResolution.attempts = attempts;
    walkthroughState.selectorResolution.isWaitingForMutation = false;
    walkthroughState.selectorResolution.token = token;
    
    // Phase 1: Try primary selector (with cancellation check)
    const primaryResult = this._trySelector(selectorSet.primary, context, 'primary', token);
    attempts.push(primaryResult);
    
    if (primaryResult.success && this.isValid(token)) {
      return this._buildResult(true, primaryResult.element, selectorSet.primary, 
        attempts, performance.now() - startTime);
    }
    
    // Phase 2: Try fallback selectors
    for (const fallback of selectorSet.fallbacks || []) {
      if (!this.isValid(token)) {
        return this._buildResult(false, null, null, attempts, 
          performance.now() - startTime, 'Resolution cancelled');
      }
      
      const result = this._trySelector(fallback, context, 'fallback', token);
      attempts.push(result);
      
      if (result.success && this.isValid(token)) {
        return this._buildResult(true, result.element, fallback, 
          attempts, performance.now() - startTime);
      }
    }
    
    // Phase 3: Try text match
    if (selectorSet.textMatch && this.isValid(token)) {
      const textResult = this._tryTextMatch(selectorSet.textMatch, context, token);
      attempts.push(textResult);
      
      if (textResult.success && this.isValid(token)) {
        return this._buildResult(true, textResult.element, 
          { type: 'text_match', ...selectorSet.textMatch }, 
          attempts, performance.now() - startTime);
      }
    }
    
    // Phase 4: Try structural fallback
    if (selectorSet.structural && this.isValid(token)) {
      const structResult = this._tryStructural(selectorSet.structural, context, token);
      attempts.push(structResult);
      
      if (structResult.success && this.isValid(token)) {
        return this._buildResult(true, structResult.element,
          { type: 'structural', ...selectorSet.structural },
          attempts, performance.now() - startTime);
      }
    }
    
    // Phase 5: Wait for DOM mutations
    if (!this.isValid(token)) {
      return this._buildResult(false, null, null, attempts, 
        performance.now() - startTime, 'Resolution cancelled before mutation wait');
    }
    
    walkthroughState.selectorResolution.isWaitingForMutation = true;
    showFailureUI('RETRYING', 'Page changed, looking for element...', { isCancellable: true });
    
    const mutationResult = await this._waitForMutation(selectorSet, context, token);
    walkthroughState.selectorResolution.isWaitingForMutation = false;
    
    if (!this.isValid(token)) {
      hideFailureUI();
      return this._buildResult(false, null, null, attempts, 
        performance.now() - startTime, 'Resolution cancelled during mutation wait');
    }
    
    if (mutationResult.success) {
      hideFailureUI();
      return this._buildResult(true, mutationResult.element, 
        mutationResult.selectorUsed, attempts, performance.now() - startTime);
    }
    
    // All attempts failed
    return this._buildResult(false, null, null, attempts, 
      performance.now() - startTime, 'All selector strategies failed');
  },

  _trySelector(selector, context, strategyType, token) {
    // Check cancellation before attempting
    if (!this.isValid(token)) {
      return { strategy: strategyType, selector, success: false, cancelled: true };
    }
    
    const startTime = performance.now();
    
    try {
      let element = null;
      
      switch (selector.type) {
        case 'css_id':
        case 'css_class':
        case 'css_attr':
        case 'css_path':
          element = context.querySelector(selector.value);
          break;
        case 'xpath':
          element = this._evaluateXPath(selector.value, context);
          break;
        case 'test_id':
          element = context.querySelector(`[data-testid="${selector.value}"]`);
          break;
        case 'aria_label':
          element = context.querySelector(`[aria-label="${selector.value}"]`);
          break;
      }
      
      // Check cancellation after finding element
      if (!this.isValid(token)) {
        return { strategy: strategyType, selector, success: false, cancelled: true };
      }
      
      if (element && this._isValidTarget(element)) {
        return {
          strategy: strategyType,
          selector: selector,
          success: true,
          element: element,
          timeMs: performance.now() - startTime
        };
      }
    } catch (e) {
      // Selector error
    }
    
    return {
      strategy: strategyType,
      selector: selector,
      success: false,
      timeMs: performance.now() - startTime
    };
  },

  _tryTextMatch(textMatch, context, token) {
    if (!this.isValid(token)) return { success: false, cancelled: true };
    
    const startTime = performance.now();
    const searchContext = textMatch.context 
      ? context.querySelector(textMatch.context) || context
      : context;
    
    const elements = Array.from(searchContext.querySelectorAll('*'));
    
    if (textMatch.exact && this.isValid(token)) {
      const match = elements.find(el => 
        el.textContent?.trim() === textMatch.exact &&
        this._isValidTarget(el)
      );
      if (match && this.isValid(token)) {
        return { success: true, element: match, timeMs: performance.now() - startTime };
      }
    }
    
    if (textMatch.contains && this.isValid(token)) {
      const match = elements.find(el =>
        el.textContent?.includes(textMatch.contains) &&
        this._isValidTarget(el)
      );
      if (match && this.isValid(token)) {
        return { success: true, element: match, timeMs: performance.now() - startTime };
      }
    }
    
    return { success: false, timeMs: performance.now() - startTime };
  },

  _tryStructural(structural, context, token) {
    if (!this.isValid(token)) return { success: false, cancelled: true };
    
    try {
      const parent = context.querySelector(structural.parentSelector);
      if (!parent) return { success: false };
      
      const children = Array.from(parent.children);
      const filtered = structural.tagName 
        ? children.filter(c => c.tagName.toLowerCase() === structural.tagName.toLowerCase())
        : children;
      
      const element = filtered[structural.childIndex];
      if (element && this._isValidTarget(element) && this.isValid(token)) {
        return { success: true, element };
      }
    } catch (e) {}
    
    return { success: false };
  },

  _waitForMutation(selectorSet, context, token) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = this.config.maxRetries;
      let observer = null;
      let intervalId = null;
      let timeoutId = null;
      
      const tryFind = async () => {
        // Check cancellation before each attempt
        if (!this.isValid(token)) {
          cleanup();
          return resolve({ success: false, cancelled: true });
        }
        
        attempts++;
        
        // Try primary and fallbacks
        const primary = this._trySelector(selectorSet.primary, context, 'primary', token);
        if (primary.success && this.isValid(token)) {
          cleanup();
          return resolve({ success: true, element: primary.element, selectorUsed: selectorSet.primary });
        }
        
        for (const fallback of selectorSet.fallbacks || []) {
          if (!this.isValid(token)) {
            cleanup();
            return resolve({ success: false, cancelled: true });
          }
          
          const result = this._trySelector(fallback, context, 'fallback', token);
          if (result.success && this.isValid(token)) {
            cleanup();
            return resolve({ success: true, element: result.element, selectorUsed: fallback });
          }
        }
        
        if (attempts >= maxAttempts) {
          cleanup();
          return resolve({ success: false, timedOut: true });
        }
        
        // Update retry UI
        updateRetryUI(attempts, maxAttempts);
      };
      
      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      // Mutation observer
      observer = new MutationObserver(() => {
        if (this.isValid(token)) {
          tryFind();
        } else {
          cleanup();
          resolve({ success: false, cancelled: true });
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Polling fallback
      intervalId = setInterval(() => {
        if (this.isValid(token)) {
          tryFind();
        } else {
          cleanup();
          resolve({ success: false, cancelled: true });
        }
      }, this.config.retryInterval);
      
      // Timeout
      timeoutId = setTimeout(() => {
        if (this.isValid(token)) {
          cleanup();
          resolve({ success: false, timedOut: true });
        }
      }, this.config.mutationTimeout);
      
      // First attempt
      tryFind();
    });
  },

  _isValidTarget(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    if (rect.width === 0 || rect.height === 0) return false;
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    
    return true;
  },

  _evaluateXPath(xpath, context) {
    try {
      const result = document.evaluate(xpath, context, null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) {
      return null;
    }
  },

  _buildResult(success, element, selectorUsed, attempts, totalTimeMs, error = null) {
    return {
      success,
      element,
      selectorUsed,
      attempts,
      totalTimeMs: Math.round(totalTimeMs),
      retryCount: attempts.filter(a => !a.success).length,
      error,
      suggestions: error ? [
        'Wait for the page to fully load',
        'Check if the target is inside an iframe',
        'Verify the page URL matches the expected scope',
        'Try refreshing the page'
      ] : []
    };
  },

  // Stability scoring for author-time validation
  scoreStability(selector, type) {
    const scores = {
      'css_id': 1.0,
      'test_id': 1.0,
      'aria_label': 0.95,
      'css_class': /[a-zA-Z0-9]{5,}/.test(selector) && !selector.includes(' ') ? 0.3 : 0.7,
      'css_path': selector.split('>').length > 3 ? 0.3 : 0.5,
      'xpath': /\[\d+\]/.test(selector) ? 0.3 : 0.4,
      'text_match': 0.4
    };
    return scores[type] || 0.5;
  }
};

/**
 * Activate the walkthrough overlay system
 * Called when walkthrough starts or resumes
 */
function activateWalkthrough(session) {
  if (walkthroughState.isActive) {
    console.warn('[IG Walkthrough] Already active, reactivating');
    deactivateWalkthrough();
  }
  
  walkthroughState.isActive = true;
  walkthroughState.sessionId = session.id;
  
  // Create the blocking overlay
  createOverlay();
  
  // Block all non-walkthrough interactions
  installInteractionBlockers();
  
  // Install navigation prevention
  installNavigationBlocker(session.walkthrough?.scope);
  
  console.log('[IG Walkthrough] Overlay activated for session:', session.id);
  
  // If there's a current step, activate it
  if (session.progress && session.progress.stepId) {
    // Step will be activated via separate message
  }
}

/**
 * Deactivate and clean up walkthrough overlay
 */
function deactivateWalkthrough(reason = 'complete') {
  if (!walkthroughState.isActive) return;
  
  // CRITICAL: Cancel any pending selector resolution to prevent stale activation
  if (SelectorEngine && typeof SelectorEngine.cancel === 'function') {
    SelectorEngine.cancel();
    console.log('[IG Walkthrough] Cancelled pending selector resolution');
  }
  
  // Remove all DOM elements
  removeOverlay();
  removeHighlight();
  removeTooltip();
  hideFailureUI();
  
  // Remove all event blockers
  removeInteractionBlockers();
  removeNavigationBlocker();
  
  // Disconnect observers
  if (walkthroughState.targetObserver) {
    walkthroughState.targetObserver.disconnect();
    walkthroughState.targetObserver = null;
  }
  
  // Clear state
  walkthroughState.isActive = false;
  walkthroughState.sessionId = null;
  walkthroughState.currentStep = null;
  walkthroughState.stepIndex = -1;
  walkthroughState.targetElement = null;
  walkthroughState.targetSelector = null;
  walkthroughState.eventHandlers.clear();
  walkthroughState.validationPending = false;
  walkthroughState.collectedData = {};
  walkthroughState.selectorResolution = {
    attempts: [],
    currentStrategy: null,
    isWaitingForMutation: false,
    observer: null,
    token: null
  };
  walkthroughState.failureState = {
    type: null,
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    isRecovering: false
  };
  
  console.log('[IG Walkthrough] Overlay deactivated:', reason);
}

/**
 * Create the full-page blocking overlay
 * Uses a "hole" cutout technique to allow interaction only with target
 */
function createOverlay() {
  // Main overlay - blocks all interactions except through hole
  const overlay = document.createElement('div');
  overlay.className = WALKTHROUGH_CONFIG.classes.overlay;
  overlay.id = 'ig-walkthrough-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    z-index: ${WALKTHROUGH_CONFIG.zIndex.overlay};
    pointer-events: auto;
    transition: opacity 0.3s ease;
  `;
  
  // Add visual elements
  overlay.innerHTML = `
    <div class="ig-walkthrough-header" style="
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: ${WALKTHROUGH_CONFIG.zIndex.overlay + 1};
      display: flex;
      align-items: center;
      gap: 16px;
    ">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">IG</div>
        <span style="font-weight: 600; color: #1f2937;">Guided Walkthrough</span>
      </div>
      <div id="ig-walkthrough-progress" style="color: #6b7280; font-size: 13px;">Loading...</div>
    </div>
    
    <div id="ig-walkthrough-hole" class="${WALKTHROUGH_CONFIG.classes.overlayHole}" style="
      position: absolute;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
      border-radius: 8px;
      pointer-events: none;
      transition: all 0.3s ease;
      z-index: ${WALKTHROUGH_CONFIG.zIndex.overlay + 2};
      display: none;
    "></div>
  `;
  
  document.body.appendChild(overlay);
  walkthroughState.overlay = overlay;
  
  // Store reference to hole element
  walkthroughState.holeElement = overlay.querySelector('#ig-walkthrough-hole');
}

function removeOverlay() {
  if (walkthroughState.overlay) {
    walkthroughState.overlay.remove();
    walkthroughState.overlay = null;
  }
}

/**
 * Update the hole position to match target element
 * This creates a visual "cutout" where the target is clickable
 */
function updateHolePosition(element) {
  if (!walkthroughState.holeElement || !element) return;
  
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  
  // Add padding around element for better UX
  const padding = 8;
  
  walkthroughState.holeElement.style.cssText = `
    position: absolute;
    top: ${rect.top + scrollY - padding}px;
    left: ${rect.left + scrollX - padding}px;
    width: ${rect.width + padding * 2}px;
    height: ${rect.height + padding * 2}px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
    border-radius: 8px;
    pointer-events: none;
    transition: all 0.3s ease;
    z-index: ${WALKTHROUGH_CONFIG.zIndex.overlay + 2};
    display: block;
  `;
}

// ============================================================================
// INTERACTION BLOCKING
// ============================================================================

/**
 * Install event blockers to prevent non-step interactions
 * PSEUDOCODE: Capture all events at document level, check if target is allowed
 */
function installInteractionBlockers() {
  const blockedEvents = WALKTHROUGH_CONFIG.blockedEvents;
  
  blockedEvents.forEach(eventType => {
    const handler = (event) => {
      // If walkthrough not active, don't block
      if (!walkthroughState.isActive) return;
      
      // Check if this event is on the target element
      if (isEventOnTarget(event)) {
        // Allow the event, but capture it for validation
        captureEvent(event);
        return;
      }
      
      // Check if event is on a walkthrough UI element
      if (isEventOnWalkthroughUI(event)) {
        return; // Allow
      }
      
      // BLOCK the event
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Show visual feedback
      showBlockedFeedback(event);
      
      // Report blocked interaction to background
      reportBlockedInteraction(event);
      
      return false;
    };
    
    // Use capture phase to intercept before page handlers
    document.addEventListener(eventType, handler, true);
    walkthroughState.eventHandlers.set(eventType, handler);
  });
  
  // Install STRICT keyboard blocker (separate handling for better control)
  installStrictKeyboardBlocker();
}

/**
 * STRICT keyboard blocking - blocks ALL keys except:
 * 1. Escape (always allowed for abort request)
 * 2. Keys explicitly allowed on target element
 * 3. Typing in input fields that ARE the target
 */
function installStrictKeyboardBlocker() {
  const keyHandler = (event) => {
    if (!walkthroughState.isActive) return;
    
    // Always allow Escape (for abort request)
    if (event.key === 'Escape') {
      // Optional: trigger abort confirmation
      return;
    }
    
    // Check if on target element
    if (isEventOnTarget(event)) {
      // On target - check if key is allowed for this step's action
      if (isKeyAllowedForStep(event)) {
        // Capture for validation and allow
        captureEvent(event);
        return;
      }
      // Key not allowed for this step's action - block it
    }
    
    // Check if on walkthrough UI
    if (isEventOnWalkthroughUI(event)) {
      // Allow interaction with walkthrough UI
      return;
    }
    
    // STRICT BLOCK: Not on target and not allowed key
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Block modifier combinations (Ctrl+S, Cmd+L, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      console.warn('[IG Walkthrough] Blocked keyboard shortcut:', 
        `${event.ctrlKey ? 'Ctrl+' : ''}${event.metaKey ? 'Cmd+' : ''}${event.altKey ? 'Alt+' : ''}${event.key}`);
    }
    
    return false;
  };
  
  // Block all keyboard events in capture phase
  document.addEventListener('keydown', keyHandler, true);
  document.addEventListener('keyup', keyHandler, true);
  document.addEventListener('keypress', keyHandler, true);
  
  walkthroughState.eventHandlers.set('__keydown_blocker', keyHandler);
  walkthroughState.eventHandlers.set('__keyup_blocker', keyHandler);
  walkthroughState.eventHandlers.set('__keypress_blocker', keyHandler);
}

/**
 * Check if a key is allowed for the current step's required action
 */
function isKeyAllowedForStep(event) {
  if (!walkthroughState.currentStep) return false;
  
  const action = walkthroughState.currentStep.requiredAction;
  const target = event.target;
  
  switch (action) {
    case 'input':
      // Allow typing in input/textareas when input action required
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow printable characters, navigation, editing
        if (event.key.length === 1 || // Printable
            ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 
             'Home', 'End', 'Tab', 'Enter'].includes(event.key)) {
          return true;
        }
      }
      return false;
      
    case 'check':
    case 'select':
      // Allow Space for checkbox, Enter for select
      if (target.tagName === 'INPUT' && target.type === 'checkbox' && event.key === ' ') {
        return true;
      }
      return false;
      
    case 'click':
    case 'submit':
      // Allow Enter/Space for buttons
      if ((target.tagName === 'BUTTON' || target.tagName === 'A') && 
          (event.key === 'Enter' || event.key === ' ')) {
        return true;
      }
      return false;
      
    case 'keypress':
      // Custom keypress action - check against configured allowed keys
      const allowedKeys = walkthroughState.currentStep.actionConfig?.allowedKeys || [];
      return allowedKeys.includes(event.key);
      
    default:
      // For other actions, be restrictive
      return ['Enter', ' '].includes(event.key);
  }
}

function removeInteractionBlockers() {
  walkthroughState.eventHandlers.forEach((handler, eventType) => {
    if (eventType.startsWith('__')) {
      // Custom handlers
      if (eventType === '__keydown_blocker') {
        document.removeEventListener('keydown', handler, true);
      } else if (eventType === '__keyup_blocker') {
        document.removeEventListener('keyup', handler, true);
      } else if (eventType === '__keypress_blocker') {
        document.removeEventListener('keypress', handler, true);
      }
    } else {
      document.removeEventListener(eventType, handler, true);
    }
  });
  walkthroughState.eventHandlers.clear();
}

/**
 * Check if event target is the current step's target element
 */
function isEventOnTarget(event) {
  if (!walkthroughState.targetElement) return false;
  
  return event.target === walkthroughState.targetElement ||
         walkthroughState.targetElement.contains(event.target);
}

/**
 * Check if event is on walkthrough UI elements
 */
function isEventOnWalkthroughUI(event) {
  return event.target.closest('.ig-walkthrough') !== null ||
         event.target.closest('#ig-walkthrough-overlay') !== null;
}

/**
 * Capture step-relevant events for validation
 */
function captureEvent(event) {
  if (!walkthroughState.currentStep) return;
  
  const step = walkthroughState.currentStep;
  
  // Check if this event type matches required action
  const eventMatchesAction = checkEventMatchesAction(event, step.requiredAction);
  
  if (eventMatchesAction) {
    // Collect data based on action type
    const eventData = collectEventData(event, step.requiredAction);
    
    // Send to background for validation
    requestValidation(eventData);
  }
}

/**
 * Show visual feedback when interaction is blocked
 */
function showBlockedFeedback(event) {
  // Create ripple effect at click position
  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    width: 40px;
    height: 40px;
    margin-left: -20px;
    margin-top: -20px;
    background: rgba(239, 68, 68, 0.5);
    border-radius: 50%;
    pointer-events: none;
    z-index: ${WALKTHROUGH_CONFIG.zIndex.modal};
    animation: ig-blocked-ripple 0.4s ease-out forwards;
  `;
  
  // Add animation if not exists
  if (!document.getElementById('ig-walkthrough-styles')) {
    const style = document.createElement('style');
    style.id = 'ig-walkthrough-styles';
    style.textContent = `
      @keyframes ig-blocked-ripple {
        0% { transform: scale(0); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
      @keyframes ig-pulse-highlight {
        0%, 100% { box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.3); }
        50% { box-shadow: 0 0 0 12px rgba(79, 70, 229, 0.1); }
      }
      .ig-walkthrough-highlight {
        animation: ig-pulse-highlight 2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 400);
}

// ============================================================================
// NAVIGATION PREVENTION
// ============================================================================

/**
 * Install navigation prevention
 * Prevents: link clicks, form submissions, history changes
 * Handles: FORCE_REDIRECT from background
 * MONKEY-PATCH: history.pushState/replaceState to relay to background
 */
function installNavigationBlocker(scope) {
  // Block link clicks
  const clickHandler = (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return; // Allow anchor links
    
    // Check if URL is in allowed scope
    if (scope && !isUrlInScope(href, scope)) {
      event.preventDefault();
      event.stopPropagation();
      
      showNavigationBlockedModal(href);
      reportBlockedNavigation(href);
    }
  };
  
  document.addEventListener('click', clickHandler, true);
  walkthroughState.eventHandlers.set('__nav_click', clickHandler);
  
  // Block form submissions
  const submitHandler = (event) => {
    // Only block if not the target form
    if (!walkthroughState.targetElement || 
        !walkthroughState.targetElement.contains(event.target)) {
      event.preventDefault();
      showBlockedFeedback(event);
    }
  };
  
  document.addEventListener('submit', submitHandler, true);
  walkthroughState.eventHandlers.set('__nav_submit', submitHandler);
  
  // MONKEY-PATCH: history.pushState and replaceState
  // This catches SPA router navigation immediately, before polling detects it
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  function patchedPushState(data, title, url) {
    if (walkthroughState.isActive && url) {
      // Immediately notify background of navigation attempt
      chrome.runtime.sendMessage({
        type: 'SPA_NAVIGATION_ATTEMPT',
        method: 'pushState',
        url: url,
        currentUrl: window.location.href,
        stepId: walkthroughState.currentStep?.id
      });
      
      const currentStep = walkthroughState.currentStep;
      
      // Check if this navigation is allowed for current step
      if (currentStep?.expectedUrl || currentStep?.urlPattern) {
        const expectedUrl = currentStep.expectedUrl || currentStep.urlPattern;
        if (isUrlMatching(url, expectedUrl)) {
          console.log('[IG Walkthrough] Allowing SPA navigation to expected URL:', url);
          return originalPushState.apply(this, arguments);
        }
      }
      
      // For navigation steps, allow all navigations
      if (currentStep?.requiredAction === 'navigated') {
        console.log('[IG Walkthrough] Allowing SPA navigation for navigation step:', url);
        return originalPushState.apply(this, arguments);
      }
      
      console.warn('[IG Walkthrough] Navigation blocked: pushState to', url);
      // Don't call original - silently swallow the navigation
      return;
    }
    return originalPushState.apply(this, arguments);
  }
  
  function patchedReplaceState(data, title, url) {
    if (walkthroughState.isActive && url) {
      // Immediately notify background
      chrome.runtime.sendMessage({
        type: 'SPA_NAVIGATION_ATTEMPT',
        method: 'replaceState',
        url: url,
        currentUrl: window.location.href
      });
      
      const currentStep = walkthroughState.currentStep;
      if (currentStep?.requiredAction === 'navigated') {
        return originalReplaceState.apply(this, arguments);
      }
      
      console.warn('[IG Walkthrough] Navigation blocked: replaceState to', url);
      return;
    }
    return originalReplaceState.apply(this, arguments);
  }
  
  // Apply patches
  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;
  
  // Store originals for cleanup
  walkthroughState._originalPushState = originalPushState;
  walkthroughState._originalReplaceState = originalReplaceState;
  
  // Handle beforeunload
  const beforeUnloadHandler = (event) => {
    if (walkthroughState.isActive) {
      event.preventDefault();
      event.returnValue = 'A walkthrough is in progress. Are you sure you want to leave?';
    }
  };
  
  window.addEventListener('beforeunload', beforeUnloadHandler);
  walkthroughState.eventHandlers.set('__beforeunload', beforeUnloadHandler);
  
  // Listen for FORCE_REDIRECT messages from background
  const messageHandler = (event) => {
    if (event.data?.type === 'FORCE_REDIRECT' && event.data?.url) {
      console.log('[IG Walkthrough] Force redirect received:', event.data.url);
      window.location.href = event.data.url;
    }
  };
  window.addEventListener('message', messageHandler);
  walkthroughState.eventHandlers.set('__force_redirect', messageHandler);
}

/**
 * Check if URL matches expected pattern
 */
function isUrlMatching(url, expected) {
  if (!expected) return true;
  
  if (expected.startsWith('regex:')) {
    const pattern = expected.slice(6);
    return new RegExp(pattern).test(url);
  } else if (expected.startsWith('glob:')) {
    const pattern = expected.slice(5).replace(/\*/g, '.*');
    return new RegExp(pattern).test(url);
  } else {
    return url.includes(expected);
  }
}

function removeNavigationBlocker() {
  // Restore history methods
  if (walkthroughState._originalPushState) {
    history.pushState = walkthroughState._originalPushState;
    delete walkthroughState._originalPushState;
  }
  if (walkthroughState._originalReplaceState) {
    history.replaceState = walkthroughState._originalReplaceState;
    delete walkthroughState._originalReplaceState;
  }
}

function isUrlInScope(url, scope) {
  if (!scope) return true;
  
  switch (scope.type) {
    case 'url_pattern':
      return new RegExp(scope.pattern).test(url);
    case 'domain':
      return scope.allowedDomains?.some(d => url.includes(d));
    case 'page_specific':
      return url === window.location.href;
    default:
      return true;
  }
}

// ============================================================================
// TARGET HIGHLIGHTING
// ============================================================================

/**
 * Activate a step - highlight target and setup validation
 * Uses SelectorEngine for robust target resolution
 */
async function activateStep(step, stepIndex) {
  walkthroughState.currentStep = step;
  walkthroughState.stepIndex = stepIndex;
  walkthroughState.validationPending = false;
  
  // Reset failure state
  walkthroughState.failureState = {
    type: null,
    retryCount: 0,
    maxRetries: step.onFailure?.maxRetries || 3,
    lastError: null,
    isRecovering: false
  };
  
  // Hide any previous failure UI
  hideFailureUI();
  
  // Resolve target using robust selector engine
  const selectorSet = step.targetSelectors || {
    primary: { type: 'css_path', value: step.targetSelector },
    fallbacks: (step.targetAlternatives || []).map(s => ({ type: 'css_path', value: s }))
  };
  
  updateProgressUI(step, stepIndex);
  
  // Pass stepId for cancellation token
  const resolution = await SelectorEngine.resolve(selectorSet, document, step.id);
  
  if (!resolution.success) {
    // Target not found after all retries
    handleStepFailure('ELEMENT_NOT_FOUND', {
      selector: step.targetSelector,
      attempts: resolution.attempts,
      suggestions: resolution.suggestions
    });
    return;
  }
  
  const target = resolution.element;
  walkthroughState.targetElement = target;
  walkthroughState.targetSelector = resolution.selectorUsed;
  
  // Log successful resolution for debug
  logDebugEvent('target_resolved', {
    stepId: step.id,
    selector: resolution.selectorUsed,
    timeMs: resolution.totalTimeMs,
    attempts: resolution.attempts.length
  });
  
  // Highlight target
  highlightTarget(target, step.ui?.highlightStyle || 'pulse');
  
  // Update overlay hole
  updateHolePosition(target);
  
  // Scroll target into view
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Show tooltip
  if (step.ui?.showTooltip !== false) {
    showTooltip(target, step);
  }
  
  // Setup target monitoring
  startTargetMonitoring(target);
  
  console.log('[IG Walkthrough] Step activated:', step.title);
}

/**
 * Find target element with fallback selectors
 */
function findTargetElement(primarySelector, alternatives = []) {
  const selectors = [primarySelector, ...alternatives].filter(Boolean);
  
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) return element;
    } catch (e) {
      console.warn('[IG Walkthrough] Invalid selector:', selector);
    }
  }
  
  return null;
}

/**
 * Highlight target element with specified style
 */
function highlightTarget(element, style = 'pulse') {
  removeHighlight();
  
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  
  const highlight = document.createElement('div');
  highlight.className = WALKTHROUGH_CONFIG.classes.highlightBox;
  highlight.id = 'ig-walkthrough-highlight';
  
  const baseStyles = `
    position: absolute;
    top: ${rect.top + scrollY}px;
    left: ${rect.left + scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border-radius: 4px;
    pointer-events: none;
    z-index: ${WALKTHROUGH_CONFIG.zIndex.highlight};
    transition: all 0.3s ease;
  `;
  
  switch (style) {
    case 'box':
      highlight.style.cssText = baseStyles + `
        border: 3px solid #4f46e5;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
      `;
      break;
      
    case 'pulse':
      highlight.style.cssText = baseStyles + `
        border: 3px solid #4f46e5;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.3);
        animation: ig-pulse-highlight 2s ease-in-out infinite;
      `;
      break;
      
    case 'glow':
      highlight.style.cssText = baseStyles + `
        border: 2px solid #4f46e5;
        box-shadow: 
          0 0 20px rgba(79, 70, 229, 0.5),
          inset 0 0 20px rgba(79, 70, 229, 0.1);
      `;
      break;
      
    case 'outline':
      highlight.style.cssText = baseStyles + `
        outline: 3px solid #4f46e5;
        outline-offset: 4px;
      `;
      break;
  }
  
  document.body.appendChild(highlight);
  walkthroughState.highlightElement = highlight;
}

function removeHighlight() {
  if (walkthroughState.highlightElement) {
    walkthroughState.highlightElement.remove();
    walkthroughState.highlightElement = null;
  }
}

/**
 * Monitor target element for position/size changes
 */
function startTargetMonitoring(target) {
  // Disconnect existing observer
  if (walkthroughState.targetObserver) {
    walkthroughState.targetObserver.disconnect();
  }
  
  // Observe target and its ancestors for changes
  const observer = new MutationObserver(() => {
    if (!walkthroughState.targetElement) return;
    
    const rect = walkthroughState.targetElement.getBoundingClientRect();
    
    // Update highlight position
    if (walkthroughState.highlightElement) {
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      walkthroughState.highlightElement.style.top = `${rect.top + scrollY}px`;
      walkthroughState.highlightElement.style.left = `${rect.left + scrollX}px`;
      walkthroughState.highlightElement.style.width = `${rect.width}px`;
      walkthroughState.highlightElement.style.height = `${rect.height}px`;
    }
    
    // Update hole position
    updateHolePosition(walkthroughState.targetElement);
    
    // Update tooltip position
    if (walkthroughState.tooltipElement) {
      positionTooltip(walkthroughState.targetElement, walkthroughState.tooltipElement);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  walkthroughState.targetObserver = observer;
  
  // Also update on scroll/resize
  const updateHandler = () => {
    if (walkthroughState.targetElement) {
      updateHolePosition(walkthroughState.targetElement);
    }
  };
  
  window.addEventListener('scroll', updateHandler, { passive: true });
  window.addEventListener('resize', updateHandler);
  
  walkthroughState.eventHandlers.set('__scroll_update', updateHandler);
  walkthroughState.eventHandlers.set('__resize_update', updateHandler);
}

/**
 * Watch for target element appearance
 */
function startTargetWatcher(step) {
  let attempts = 0;
  const maxAttempts = 100;
  
  const tryFind = () => {
    if (!walkthroughState.isActive) return;
    
    const target = findTargetElement(step.targetSelector, step.targetAlternatives);
    if (target) {
      activateStep(step, walkthroughState.stepIndex);
      return;
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryFind, 100);
    }
  };
  
  tryFind();
}

// ============================================================================
// TOOLTIP SYSTEM
// ============================================================================

function showTooltip(target, step) {
  removeTooltip();
  
  const tooltip = document.createElement('div');
  tooltip.className = WALKTHROUGH_CONFIG.classes.tooltip;
  tooltip.id = 'ig-walkthrough-tooltip';
  
  const content = step.ui?.tooltipContent || buildDefaultTooltipContent(step);
  
  tooltip.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      max-width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    ">
      <div style="padding: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 14px;
          ">${walkthroughState.stepIndex + 1}</div>
          <div style="font-weight: 600; font-size: 16px; color: #1f2937;">${step.title}</div>
        </div>
        <div style="color: #4b5563; line-height: 1.6;">${content}</div>
        
        ${step.description ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${step.description}</div>` : ''}
      </div>
      
      <div style="
        background: #f9fafb;
        padding: 12px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #e5e7eb;
      ">
        <div style="font-size: 12px; color: #9ca3af;">
          Step ${walkthroughState.stepIndex + 1} of ${step.totalSteps || '?'}
        </div>
        <button id="ig-walkthrough-exit" style="
          padding: 6px 12px;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
        ">Exit Walkthrough</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(tooltip);
  walkthroughState.tooltipElement = tooltip;
  
  // Position tooltip
  positionTooltip(target, tooltip);
  
  // Add exit handler
  tooltip.querySelector('#ig-walkthrough-exit')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'WALKTHROUGH_ABORT',
      reason: 'USER_EXIT'
    });
  });
}

function removeTooltip() {
  if (walkthroughState.tooltipElement) {
    walkthroughState.tooltipElement.remove();
    walkthroughState.tooltipElement = null;
  }
}

function buildDefaultTooltipContent(step) {
  const actionDescriptions = {
    'click': 'Click on the highlighted element',
    'input': 'Type in the highlighted input field',
    'select': 'Select an option from the dropdown',
    'check': 'Check this option',
    'submit': 'Submit the form',
    'hover': 'Hover over this element',
    'scroll': 'Scroll to this section',
    'custom': 'Complete the required action'
  };
  
  return `<p style="margin: 0;">${actionDescriptions[step.requiredAction] || 'Complete the required action'}</p>`;
}

function positionTooltip(target, tooltip) {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  
  // Try right side first
  let left = targetRect.right + scrollX + 16;
  let top = targetRect.top + scrollY;
  
  // Check if off-screen right
  if (left + 360 > window.innerWidth + scrollX) {
    // Position to left
    left = targetRect.left + scrollX - 376;
  }
  
  // Check if off-screen bottom
  if (top + tooltipRect.height > window.innerHeight + scrollY) {
    top = window.innerHeight + scrollY - tooltipRect.height - 16;
  }
  
  tooltip.style.cssText += `
    position: absolute;
    left: ${left}px;
    top: ${top}px;
    z-index: ${WALKTHROUGH_CONFIG.zIndex.tooltip};
  `;
}

// ============================================================================
// VALIDATION & MESSAGING
// ============================================================================

function checkEventMatchesAction(event, requiredAction) {
  const eventActionMap = {
    'click': ['click'],
    'input': ['input', 'keydown'],
    'select': ['change'],
    'check': ['change'],
    'submit': ['submit'],
    'hover': ['mouseenter'],
    'keypress': ['keydown']
  };
  
  const allowedEvents = eventActionMap[requiredAction] || [];
  return allowedEvents.includes(event.type);
}

function collectEventData(event, action) {
  const baseData = {
    type: event.type,
    timestamp: Date.now(),
    target: event.target.tagName,
    targetId: event.target.id || null,
    targetClass: event.target.className || null
  };
  
  switch (action) {
    case 'input':
    case 'select':
      return { ...baseData, value: event.target.value };
    case 'check':
      return { ...baseData, checked: event.target.checked };
    default:
      return baseData;
  }
}

function requestValidation(eventData) {
  if (walkthroughState.validationPending) return;
  
  walkthroughState.validationPending = true;
  
  chrome.runtime.sendMessage({
    type: 'VALIDATION_REQUEST',
    stepId: walkthroughState.currentStep?.id,
    eventData: eventData
  }, (response) => {
    walkthroughState.validationPending = false;
    
    if (response?.valid) {
      showValidationSuccess();
    } else if (response?.error) {
      showValidationFailure(response.message);
    }
  });
}

function showValidationSuccess() {
  const highlight = walkthroughState.highlightElement;
  if (highlight) {
    highlight.style.borderColor = '#10b981';
    highlight.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.3)';
  }
}

function showValidationFailure(message) {
  const highlight = walkthroughState.highlightElement;
  if (highlight) {
    highlight.style.borderColor = '#ef4444';
    highlight.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.3)';
    
    // Shake animation
    highlight.style.animation = 'none';
    setTimeout(() => {
      highlight.style.animation = 'ig-shake 0.5s ease';
    }, 10);
  }
  
  // Show error in tooltip
  const tooltip = walkthroughState.tooltipElement;
  if (tooltip) {
    const errorEl = tooltip.querySelector('.ig-validation-error') || document.createElement('div');
    errorEl.className = 'ig-validation-error';
    errorEl.style.cssText = 'margin-top: 12px; padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626; font-size: 13px;';
    errorEl.textContent = message || 'Please try again';
    
    if (!tooltip.querySelector('.ig-validation-error')) {
      tooltip.querySelector('div > div').appendChild(errorEl);
    }
  }
}

function reportBlockedInteraction(event) {
  chrome.runtime.sendMessage({
    type: 'INTERACTION_BLOCKED',
    eventType: event.type,
    target: event.target.tagName,
    timestamp: Date.now()
  });
}

function reportBlockedNavigation(url) {
  chrome.runtime.sendMessage({
    type: 'NAVIGATION_BLOCKED',
    attemptedUrl: url,
    currentUrl: window.location.href,
    timestamp: Date.now()
  });
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateProgressUI(step, stepIndex) {
  const progressEl = document.getElementById('ig-walkthrough-progress');
  if (progressEl) {
    progressEl.textContent = `Step ${stepIndex + 1}: ${step.title}`;
  }
}

function updateRetryUI(currentAttempt, maxAttempts) {
  const failureUI = walkthroughState.failureUI;
  if (failureUI) {
    const progressBar = failureUI.querySelector('.ig-retry-progress');
    if (progressBar) {
      const pct = (currentAttempt / maxAttempts) * 100;
      progressBar.style.width = `${pct}%`;
    }
    
    const text = failureUI.querySelector('.ig-retry-text');
    if (text) {
      text.textContent = `Looking for element... (${currentAttempt}/${maxAttempts})`;
    }
  }
}

// ============================================================================
// FAILURE HANDLING UX
// ============================================================================

/**
 * Handle step failure with appropriate UX
 * NON-ADMIN USERS: Only Retry or Abort (no Skip)
 */
function handleStepFailure(type, details = {}) {
  walkthroughState.failureState.type = type;
  walkthroughState.failureState.lastError = details;
  
  logDebugEvent('step_failure', { type, details });
  
  // Determine if skip should be allowed
  const isAdmin = walkthroughState.debugMode || false;
  const isOptionalStep = walkthroughState.currentStep?.optional === true;
  const canSkip = isAdmin || isOptionalStep;
  
  switch (type) {
    case 'ELEMENT_NOT_FOUND':
      showFailureUI('NOT_FOUND', 'Element not found', {
        description: `Looking for: ${details.selector || 'target element'}`,
        actions: canSkip ? ['retry', 'skip', 'abort'] : ['retry', 'abort'],
        showAttempts: true,
        attempts: details.attempts
      });
      break;
      
    case 'VALIDATION_FAILED':
      walkthroughState.failureState.retryCount++;
      
      if (walkthroughState.failureState.retryCount >= walkthroughState.failureState.maxRetries) {
        // Max retries reached - show options based on permissions
        const maxRetryActions = canSkip 
          ? ['skip', 'abort', 'admin_bypass'] 
          : ['retry', 'abort']; // Non-admin: only retry or abort
          
        showFailureUI('MAX_RETRIES', 'This step is challenging', {
          description: details.message || 'Multiple attempts failed',
          actions: maxRetryActions,
          showHelp: true
        });
      } else {
        // Still have retries left
        showFailureUI('RETRY', 'Please try again', {
          description: details.message || 'That did not work as expected',
          actions: ['retry'],
          autoRetry: true,
          retryDelay: 2000
        });
      }
      break;
      
    case 'IFRAME_BLOCKED':
      showFailureUI('BLOCKED', 'This walkthrough cannot continue', {
        description: 'This step requires access to content that is not available',
        actions: canSkip ? ['skip', 'abort'] : ['abort'], // Non-admin: only abort
        showHelp: true
      });
      break;
      
    case 'TIMEOUT':
      showFailureUI('TIMEOUT', 'Walkthrough timed out', {
        description: 'No activity detected for 5 minutes',
        actions: ['resume', 'abort']
      });
      break;
  }
}

/**
 * Show failure UI with appropriate state
 */
function showFailureUI(state, title, options = {}) {
  hideFailureUI();
  
  const modal = document.createElement('div');
  modal.id = 'ig-walkthrough-failure';
  modal.className = 'ig-walkthrough-failure-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: ${WALKTHROUGH_CONFIG.zIndex.modal + 10};
    max-width: 420px;
    width: 90%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  `;
  
  // Icon based on state
  const icons = {
    'NOT_FOUND': '🔍',
    'RETRY': '🔄',
    'MAX_RETRIES': '⚠️',
    'BLOCKED': '🚫',
    'TIMEOUT': '⏱️',
    'RETRYING': '⏳'
  };
  
  const colors = {
    'NOT_FOUND': '#f59e0b',
    'RETRY': '#3b82f6',
    'MAX_RETRIES': '#ef4444',
    'BLOCKED': '#dc2626',
    'TIMEOUT': '#6b7280',
    'RETRYING': '#3b82f6'
  };
  
  const color = colors[state] || '#6b7280';
  
  let actionsHTML = '';
  if (options.actions) {
    const buttons = options.actions.map(action => {
      switch (action) {
        case 'retry':
          return `<button onclick="retryCurrentStep()" style="flex:1;padding:12px;background:${color};color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Try Again</button>`;
        case 'skip':
          return `<button onclick="skipCurrentStep()" style="flex:1;padding:12px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-weight:500;cursor:pointer;">Skip Step</button>`;
        case 'abort':
          return `<button onclick="abortWalkthrough()" style="flex:1;padding:12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-weight:500;cursor:pointer;">Exit</button>`;
        case 'admin_bypass':
          return `<button onclick="adminBypassStep()" style="flex:1;padding:12px;background:#dbeafe;color:#1d4ed8;border:none;border-radius:8px;font-weight:500;cursor:pointer;">Admin: Force Skip</button>`;
        case 'resume':
          return `<button onclick="resumeWalkthrough()" style="flex:1;padding:12px;background:${color};color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Resume</button>`;
      }
    }).join('');
    
    actionsHTML = `<div style="display:flex;gap:12px;margin-top:20px;">${buttons}</div>`;
  }
  
  let attemptsHTML = '';
  if (options.showAttempts && options.attempts) {
    const attemptList = options.attempts.map(a => 
      `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#6b7280;">
        <span>${a.strategy}: ${a.selector?.type || 'selector'}</span>
        <span style="color:${a.success ? '#22c55e' : '#ef4444'}">${a.success ? '✓' : '✗'} ${a.timeMs}ms</span>
      </div>`
    ).join('');
    
    attemptsHTML = `
      <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">Selector Attempts:</div>
        ${attemptList}
      </div>
    `;
  }
  
  let progressHTML = '';
  if (state === 'RETRYING') {
    progressHTML = `
      <div style="margin-top:16px;">
        <div class="ig-retry-text" style="font-size:13px;color:#6b7280;margin-bottom:8px;">Looking for element...</div>
        <div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">
          <div class="ig-retry-progress" style="height:100%;background:${color};width:0%;transition:width 0.3s ease;"></div>
        </div>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:48px;height:48px;background:${color}15;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;">
          ${icons[state] || '⚠️'}
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#1f2937;">${title}</div>
          ${state !== 'RETRYING' ? `<div style="font-size:13px;color:${color};font-weight:500;margin-top:2px;">${state.replace(/_/g, ' ')}</div>` : ''}
        </div>
      </div>
      
      ${options.description ? `<div style="color:#4b5563;line-height:1.6;margin-bottom:16px;">${options.description}</div>` : ''}
      
      ${progressHTML}
      ${attemptsHTML}
      ${actionsHTML}
      
      ${options.showHelp ? `
        <div style="margin-top:16px;padding:12px;background:#eff6ff;border-radius:8px;border-left:3px solid #3b82f6;">
          <div style="font-size:12px;color:#1d4ed8;font-weight:600;margin-bottom:4px;">Need help?</div>
          <div style="font-size:12px;color:#4b5563;">Contact your administrator or try refreshing the page</div>
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  walkthroughState.failureUI = modal;
  
  // Auto-retry if specified
  if (options.autoRetry && state === 'RETRY') {
    setTimeout(() => {
      hideFailureUI();
      retryCurrentStep();
    }, options.retryDelay || 2000);
  }
}

function hideFailureUI() {
  if (walkthroughState.failureUI) {
    walkthroughState.failureUI.remove();
    walkthroughState.failureUI = null;
  }
}

function retryCurrentStep() {
  hideFailureUI();
  chrome.runtime.sendMessage({
    type: 'STEP_RETRY',
    stepId: walkthroughState.currentStep?.id
  });
}

function skipCurrentStep() {
  hideFailureUI();
  chrome.runtime.sendMessage({
    type: 'STEP_ADVANCE',
    reason: 'USER_SKIP'
  });
}

function abortWalkthrough() {
  hideFailureUI();
  chrome.runtime.sendMessage({
    type: 'WALKTHROUGH_ABORT',
    reason: 'USER_ABORT_FAILURE'
  });
}

function adminBypassStep() {
  hideFailureUI();
  chrome.runtime.sendMessage({
    type: 'WALKTHROUGH_FORCE_ABORT',
    reason: 'ADMIN_BYPASS'
  });
}

function resumeWalkthrough() {
  hideFailureUI();
  chrome.runtime.sendMessage({
    type: 'WALKTHROUGH_RESUME'
  });
}

// ============================================================================
// ADMIN DEBUG PANEL
// ============================================================================

/**
 * Initialize admin debug mode
 */
function initDebugMode() {
  walkthroughState.debugMode = true;
  createDebugPanel();
}

function createDebugPanel() {
  if (walkthroughState.debugPanel) return;
  
  const panel = document.createElement('div');
  panel.id = 'ig-walkthrough-debug';
  panel.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 320px;
    background: #1f2937;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    z-index: ${WALKTHROUGH_CONFIG.zIndex.modal + 100};
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    color: #e5e7eb;
    overflow: hidden;
  `;
  
  panel.innerHTML = `
    <div style="padding:12px 16px;background:#111827;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:600;color:#60a5fa;">🔧 Debug Panel</div>
      <button onclick="toggleDebugExpand()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;">📊</button>
    </div>
    <div id="ig-debug-content" style="padding:12px 16px;max-height:300px;overflow-y:auto;">
      <div style="margin-bottom:12px;">
        <div style="color:#9ca3af;margin-bottom:4px;">Session</div>
        <div id="ig-debug-session" style="color:#34d399;">Inactive</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:#9ca3af;margin-bottom:4px;">Step</div>
        <div id="ig-debug-step" style="color:#fbbf24;">-</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:#9ca3af;margin-bottom:4px;">Target</div>
        <div id="ig-debug-target" style="color:#f472b6;">Not found</div>
      </div>
      <div>
        <div style="color:#9ca3af;margin-bottom:4px;">Recent Events</div>
        <div id="ig-debug-events" style="font-size:11px;line-height:1.4;"></div>
      </div>
    </div>
    <div style="padding:8px 16px;background:#111827;border-top:1px solid #374151;display:flex;gap:8px;">
      <button onclick="exportTelemetry()" style="flex:1;padding:6px;background:#374151;border:none;border-radius:4px;color:#e5e7eb;font-size:11px;cursor:pointer;">Export</button>
      <button onclick="clearDebugLog()" style="flex:1;padding:6px;background:#374151;border:none;border-radius:4px;color:#e5e7eb;font-size:11px;cursor:pointer;">Clear</button>
    </div>
  `;
  
  document.body.appendChild(panel);
  walkthroughState.debugPanel = panel;
}

function logDebugEvent(type, data = {}) {
  if (!walkthroughState.debugMode) return;
  
  const event = {
    timestamp: Date.now(),
    type,
    data
  };
  
  walkthroughState.eventLog.unshift(event);
  if (walkthroughState.eventLog.length > 50) {
    walkthroughState.eventLog.pop();
  }
  
  updateDebugPanel();
}

function updateDebugPanel() {
  if (!walkthroughState.debugPanel) return;
  
  const sessionEl = walkthroughState.debugPanel.querySelector('#ig-debug-session');
  const stepEl = walkthroughState.debugPanel.querySelector('#ig-debug-step');
  const targetEl = walkthroughState.debugPanel.querySelector('#ig-debug-target');
  const eventsEl = walkthroughState.debugPanel.querySelector('#ig-debug-events');
  
  if (sessionEl) {
    sessionEl.textContent = walkthroughState.sessionId 
      ? `${walkthroughState.sessionId.slice(0, 8)}... (${walkthroughState.isActive ? 'active' : 'inactive'})`
      : 'Inactive';
  }
  
  if (stepEl) {
    stepEl.textContent = walkthroughState.currentStep 
      ? `${walkthroughState.stepIndex + 1}. ${walkthroughState.currentStep.title}`
      : '-';
  }
  
  if (targetEl) {
    const target = walkthroughState.targetElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      targetEl.textContent = `${target.tagName} #${target.id || 'no-id'} (${Math.round(rect.width)}x${Math.round(rect.height)})`;
      targetEl.style.color = '#34d399';
    } else {
      targetEl.textContent = walkthroughState.selectorResolution?.isWaitingForMutation 
        ? 'Waiting for DOM...'
        : 'Not found';
      targetEl.style.color = '#f472b6';
    }
  }
  
  if (eventsEl) {
    const recentEvents = walkthroughState.eventLog.slice(0, 10);
    eventsEl.innerHTML = recentEvents.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString().split(' ')[0];
      const color = e.type.includes('error') || e.type.includes('fail') ? '#ef4444' : 
                    e.type.includes('success') ? '#22c55e' : '#60a5fa';
      return `<div style="color:${color};">${time} ${e.type}</div>`;
    }).join('');
  }
}

function toggleDebugExpand() {
  const content = document.getElementById('ig-debug-content');
  if (content) {
    content.style.maxHeight = content.style.maxHeight === 'none' ? '300px' : 'none';
  }
}

function exportTelemetry() {
  const data = {
    session: walkthroughState.sessionId,
    events: walkthroughState.eventLog,
    timestamp: Date.now(),
    url: window.location.href
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `walkthrough-debug-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearDebugLog() {
  walkthroughState.eventLog = [];
  updateDebugPanel();
}

// Make functions available globally for debug panel buttons
window.retryCurrentStep = retryCurrentStep;
window.skipCurrentStep = skipCurrentStep;
window.abortWalkthrough = abortWalkthrough;
window.adminBypassStep = adminBypassStep;
window.resumeWalkthrough = resumeWalkthrough;
window.toggleDebugExpand = toggleDebugExpand;
window.exportTelemetry = exportTelemetry;
window.clearDebugLog = clearDebugLog;

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

function showTargetNotFoundUI(step) {
  // Legacy - replaced by showFailureUI
  handleStepFailure('ELEMENT_NOT_FOUND', { selector: step.targetSelector });
}

function showTargetNotFoundUI(step) {
  const overlay = walkthroughState.overlay;
  if (!overlay) return;
  
  const modal = document.createElement('div');
  modal.id = 'ig-target-not-found';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    z-index: ${WALKTHROUGH_CONFIG.zIndex.modal};
    max-width: 400px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  modal.innerHTML = `
    <div style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Target Not Found</div>
    <div style="color: #6b7280; margin-bottom: 16px;">Waiting for element: <code>${step.targetSelector}</code></div>
    <div style="font-size: 13px; color: #9ca3af;">The walkthrough will continue automatically when the element appears.</div>
  `;
  
  overlay.appendChild(modal);
}

function showNavigationBlockedModal(url) {
  // Remove any existing modal
  const existing = document.getElementById('ig-nav-blocked-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'ig-nav-blocked-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    z-index: ${WALKTHROUGH_CONFIG.zIndex.modal};
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  modal.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <div style="width: 40px; height: 40px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">⚠️</div>
      <div>
        <div style="font-weight: 600; color: #1f2937;">Navigation Blocked</div>
        <div style="font-size: 13px; color: #6b7280;">You must complete the current step first</div>
      </div>
    </div>
    <button id="ig-nav-blocked-dismiss" style="
      width: 100%;
      padding: 10px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
    ">Continue Walkthrough</button>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#ig-nav-blocked-dismiss').addEventListener('click', () => {
    modal.remove();
  });
  
  // Auto-remove after 3 seconds
  setTimeout(() => modal.remove(), 3000);
}

// ============================================================================
// IFRAME DETECTION
// ============================================================================

/**
 * Detect iframe contexts in the current page
 * Returns: { hasSameOriginIframe, hasCrossOriginIframe }
 */
function detectIframeContexts() {
  const iframes = document.querySelectorAll('iframe');
  let hasSameOrigin = false;
  let hasCrossOrigin = false;
  
  for (const iframe of iframes) {
    try {
      // Try to access contentWindow - throws if cross-origin
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        hasSameOrigin = true;
      }
    } catch (e) {
      // Cross-origin iframe
      hasCrossOrigin = true;
    }
  }
  
  return {
    hasSameOriginIframe: hasSameOrigin,
    hasCrossOriginIframe: hasCrossOrigin,
    iframeCount: iframes.length
  };
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

function setupWalkthroughMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) return false;
    
    // Handle ACK requirement
    const sendAck = (success, data) => {
      if (message._requiresAck && message._ackId) {
        chrome.runtime.sendMessage({
          type: 'ACK',
          ackId: message._ackId,
          success: success,
          data: data
        });
      }
    };
    
    switch (message.type) {
      case 'ACTIVATE_OVERLAY':
        activateWalkthrough(message.session);
        sendResponse({ success: true, ack: message._ackId });
        sendAck(true);
        break;
        
      case 'DEACTIVATE_OVERLAY':
        deactivateWalkthrough(message.reason || 'manual');
        sendResponse({ success: true });
        sendAck(true);
        break;
        
      case 'STEP_ADVANCE':
        activateStep(message.step, message.stepIndex);
        sendResponse({ success: true, stepId: message.step?.id });
        sendAck(true, { stepId: message.step?.id });
        break;
        
      case 'STEP_RETRY':
        activateStep(message.step, walkthroughState.stepIndex);
        sendResponse({ success: true });
        sendAck(true);
        break;
        
      case 'STATE_UPDATE':
        if (message.state === 'PAUSED') {
          const overlay = walkthroughState.overlay;
          if (overlay) {
            overlay.style.opacity = '0.5';
          }
        } else if (message.state === 'ACTIVE') {
          const overlay = walkthroughState.overlay;
          if (overlay) {
            overlay.style.opacity = '1';
          }
        }
        sendResponse({ success: true });
        break;
        
      case 'FORCE_REDIRECT':
        // Background is forcing a redirect back to expected URL
        console.log('[IG Walkthrough] Force redirect to:', message.url);
        window.location.href = message.url;
        sendResponse({ success: true });
        sendAck(true);
        break;
        
      case 'DETECT_IFRAME_CONTEXTS':
        // Background requesting iframe context detection
        const iframeContext = detectIframeContexts();
        sendResponse({ success: true, ...iframeContext });
        break;
        
      case 'VALIDATION_RESULT':
        // Background sent validation result ACK
        if (message.valid) {
          showValidationSuccess();
        } else {
          showValidationFailure(message.message);
        }
        sendResponse({ received: true });
        break;
        
      case 'GET_WALKTHROUGH_STATE':
        sendResponse({
          isActive: walkthroughState.isActive,
          sessionId: walkthroughState.sessionId,
          currentStep: walkthroughState.currentStep?.id,
          stepIndex: walkthroughState.stepIndex
        });
        break;
        
      default:
        return false;
    }
    
    return true;
  });
}

// Initialize message handlers
setupWalkthroughMessageHandlers();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    activateWalkthrough,
    deactivateWalkthrough,
    activateStep,
    walkthroughState
  };
}
