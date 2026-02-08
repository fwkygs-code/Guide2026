/**
 * Walkthrough Engine Data Models
 * 
 * Core data structures for the active walkthrough onboarding system.
 * This is a controlled engine, not passive documentation.
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const WalkthroughState = {
  IDLE: 'idle',           // No walkthrough active
  ACTIVE: 'active',     // Walkthrough in progress
  PAUSED: 'paused',     // Temporarily paused (user-initiated)
  COMPLETED: 'completed', // All steps done
  ABORTED: 'aborted'      // User exited early
};

const StepState = {
  PENDING: 'pending',     // Not yet reached
  ACTIVE: 'active',       // Current step - user must complete
  VALIDATING: 'validating', // Validation in progress
  COMPLETED: 'completed', // Step done, proceed to next
  FAILED: 'failed'        // Validation failed, retry required
};

const UserAction = {
  CLICK: 'click',           // Click on target element
  INPUT: 'input',           // Type into input field
  SELECT: 'select',         // Select from dropdown
  CHECK: 'check',           // Checkbox/radio toggle
  SUBMIT: 'submit',         // Form submission
  HOVER: 'hover',           // Mouse hover (with duration)
  SCROLL: 'scroll',         // Scroll to position
  DRAG: 'drag',             // Drag and drop
  KEYPRESS: 'keypress',     // Specific key combination
  CUSTOM: 'custom'          // Custom validation function
};

const ValidationRule = {
  VALUE_EQUALS: 'value_equals',       // Input value matches
  VALUE_CONTAINS: 'value_contains',   // Input contains substring
  VALUE_REGEX: 'value_regex',         // Input matches regex
  CLICKED: 'clicked',                 // Element was clicked
  NAVIGATED: 'navigated',             // URL changed to pattern
  ELEMENT_VISIBLE: 'element_visible', // Element appeared
  ELEMENT_HIDDEN: 'element_hidden',   // Element disappeared
  FORM_VALID: 'form_valid',           // Form validation passed
  CUSTOM_FN: 'custom_fn',             // Custom validation function
  TIMEOUT: 'timeout'                  // Minimum time elapsed
};

const WalkthroughScope = {
  URL_PATTERN: 'url_pattern',     // URLs matching regex/pattern
  DOMAIN: 'domain',               // Specific domain only
  PAGE_SPECIFIC: 'page_specific',  // Exact URL match
  GLOBAL: 'global'                // Any page (rare)
};

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Walkthrough Definition
 * Complete definition of a guided onboarding flow
 */
class Walkthrough {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.title = data.title || 'Untitled Walkthrough';
    this.description = data.description || '';
    this.version = data.version || '1.0.0';
    
    // Scope control
    this.scope = data.scope || {
      type: WalkthroughScope.URL_PATTERN,
      pattern: data.urlPattern || '.*',
      allowedDomains: data.allowedDomains || [],
      blockedDomains: data.blockedDomains || []
    };
    
    // Steps in order
    this.steps = (data.steps || []).map(s => new WalkthroughStep(s));
    
    // Behavior flags
    this.behavior = {
      allowSkip: data.allowSkip || false,           // Never true for enforced mode
      allowBacktrack: data.allowBacktrack || false, // Can revisit completed steps
      blockExternalNav: data.blockExternalNav !== false, // Prevent leaving scope
      enforceOrder: data.enforceOrder !== false,    // Must complete in sequence
      persistAcrossSessions: data.persistAcrossSessions !== false,
      maxRetries: data.maxRetries || 3,             // Max validation failures before abort
      ...data.behavior
    };
    
    // Styling
    this.theme = {
      overlayColor: data.overlayColor || 'rgba(0, 0, 0, 0.7)',
      highlightColor: data.highlightColor || '#4f46e5',
      successColor: data.successColor || '#10b981',
      errorColor: data.errorColor || '#ef4444',
      ...data.theme
    };
    
    // Metadata
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this.createdBy = data.createdBy || null;
  }
  
  validate() {
    const errors = [];
    if (!this.steps.length) errors.push('Walkthrough must have at least one step');
    if (this.steps.some(s => !s.targetSelector)) errors.push('All steps must have target selectors');
    if (this.steps.some(s => !s.requiredAction)) errors.push('All steps must have required actions');
    return errors;
  }
}

/**
 * Walkthrough Step Definition
 * Individual step within a walkthrough
 */
class WalkthroughStep {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.stepNumber = data.stepNumber || 0;
    this.title = data.title || 'Step';
    this.description = data.description || '';
    
    // Target specification
    this.targetSelector = data.targetSelector;  // CSS selector for target element
    this.targetAlternatives = data.targetAlternatives || []; // Fallback selectors
    this.targetFrame = data.targetFrame || null; // iframe context if needed
    
    // Required interaction
    this.requiredAction = data.requiredAction || UserAction.CLICK;
    this.actionConfig = data.actionConfig || {}; // Action-specific config
    
    // Validation rules (must ALL pass for step completion)
    this.validationRules = (data.validationRules || []).map(r => new ValidationSpec(r));
    
    // Blocking behavior
    this.blocking = {
      blockClicks: data.blockClicks !== false,        // Block clicks outside target
      blockInput: data.blockInput !== false,          // Block typing outside target
      blockNavigation: data.blockNavigation !== false, // Block URL changes
      blockKeyboard: data.blockKeyboard !== false,     // Block keyboard shortcuts
      blockScroll: data.blockScroll || false,         // Block scrolling away
      ...data.blocking
    };
    
    // UI configuration
    this.ui = {
      highlightStyle: data.highlightStyle || 'box',   // box, pulse, glow, outline
      showTooltip: data.showTooltip !== false,
      tooltipPosition: data.tooltipPosition || 'auto', // auto, top, bottom, left, right
      tooltipContent: data.tooltipContent || null,    // Custom HTML content
      showProgress: data.showProgress !== false,      // Show step counter
      ...data.ui
    };
    
    // Timing
    this.timing = {
      minDuration: data.minDuration || 0,           // Minimum time on step
      maxDuration: data.maxDuration || null,        // Timeout before hint
      autoAdvanceDelay: data.autoAdvanceDelay || 0, // Delay after validation
      ...data.timing
    };
    
    // Conditions
    this.conditions = {
      requires: data.requires || [],                  // Step IDs that must be completed first
      skipIf: data.skipIf || null,                  // Condition to auto-skip
      showIf: data.showIf || null                   // Condition to show step
    };
    
    // On-step events
    this.onEnter = data.onEnter || null;             // Callback when step becomes active
    this.onValidate = data.onValidate || null;      // Callback during validation
    this.onComplete = data.onComplete || null;      // Callback when step completes
    this.onFail = data.onFail || null;               // Callback when validation fails
  }
}

/**
 * Validation Specification
 * Rule for validating step completion
 */
class ValidationSpec {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.rule = data.rule || ValidationRule.CLICKED;
    this.target = data.target || null;             // Element to validate (defaults to step target)
    this.value = data.value || null;               // Expected value for comparison
    this.params = data.params || {};               // Rule-specific parameters
    this.required = data.required !== false;       // Must pass for step completion
    this.customFn = data.customFn || null;         // For CUSTOM_FN rule
    this.errorMessage = data.errorMessage || null; // Custom error message on failure
  }
}

/**
 * Active Walkthrough Session
 * Runtime state for an in-progress walkthrough
 */
class WalkthroughSession {
  constructor(walkthrough, tabId) {
    this.id = crypto.randomUUID();
    this.walkthroughId = walkthrough.id;
    this.tabId = tabId;
    this.state = WalkthroughState.ACTIVE;
    
    // Current position
    this.currentStepIndex = 0;
    this.completedSteps = [];
    this.skippedSteps = [];
    
    // Validation tracking
    this.attempts = 0;
    this.failures = [];
    
    // Timing
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.stepStartedAt = Date.now();
    
    // URL tracking for navigation prevention
    this.allowedUrls = this._buildAllowedUrls(walkthrough);
    this.originalUrl = null;  // Set when session starts
    
    // User data collection
    this.collectedData = {};
    
    // Persist reference
    this.walkthroughRef = walkthrough;
  }
  
  _buildAllowedUrls(walkthrough) {
    // Build list of URLs user is allowed to navigate to during walkthrough
    const scope = walkthrough.scope;
    switch (scope.type) {
      case WalkthroughScope.URL_PATTERN:
        return [{ pattern: scope.pattern, regex: new RegExp(scope.pattern) }];
      case WalkthroughScope.DOMAIN:
        return scope.allowedDomains.map(d => ({ domain: d }));
      default:
        return [];
    }
  }
  
  get currentStep() {
    return this.walkthroughRef?.steps[this.currentStepIndex] || null;
  }
  
  get progress() {
    const total = this.walkthroughRef?.steps.length || 0;
    return {
      current: this.currentStepIndex + 1,
      total: total,
      completed: this.completedSteps.length,
      percentage: total > 0 ? Math.round((this.completedSteps.length / total) * 100) : 0
    };
  }
  
  isUrlAllowed(url) {
    return this.allowedUrls.some(allowed => {
      if (allowed.regex) return allowed.regex.test(url);
      if (allowed.domain) return url.includes(allowed.domain);
      return false;
    });
  }
  
  toJSON() {
    return {
      id: this.id,
      walkthroughId: this.walkthroughId,
      tabId: this.tabId,
      state: this.state,
      currentStepIndex: this.currentStepIndex,
      completedSteps: this.completedSteps,
      skippedSteps: this.skippedSteps,
      attempts: this.attempts,
      startedAt: this.startedAt,
      stepStartedAt: this.stepStartedAt,
      collectedData: this.collectedData
    };
  }
  
  static fromJSON(json, walkthrough) {
    const session = new WalkthroughSession(walkthrough, json.tabId);
    Object.assign(session, json);
    session.walkthroughRef = walkthrough;
    return session;
  }
}

/**
 * Walkthrough Event
 * Event for state changes and interactions
 */
class WalkthroughEvent {
  constructor(type, sessionId, data = {}) {
    this.id = crypto.randomUUID();
    this.type = type;                    // EVENT_TYPES enum value
    this.sessionId = sessionId;
    this.timestamp = Date.now();
    this.data = data;
    
    // Context
    this.url = data.url || null;
    this.tabId = data.tabId || null;
    this.stepId = data.stepId || null;
  }
}

const WalkthroughEventType = {
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  SESSION_ABORTED: 'session_aborted',
  STEP_ENTERED: 'step_entered',
  STEP_COMPLETED: 'step_completed',
  STEP_FAILED: 'step_failed',
  VALIDATION_PASSED: 'validation_passed',
  VALIDATION_FAILED: 'validation_failed',
  NAVIGATION_BLOCKED: 'navigation_blocked',
  INTERACTION_BLOCKED: 'interaction_blocked',
  TARGET_NOT_FOUND: 'target_not_found',
  ERROR: 'error'
};

// ============================================================================
// MESSAGE TYPES (for background/content/popup communication)
// ============================================================================

const MessageType = {
  // Walkthrough lifecycle
  WALKTHROUGH_START: 'walkthrough_start',
  WALKTHROUGH_PAUSE: 'walkthrough_pause',
  WALKTHROUGH_RESUME: 'walkthrough_resume',
  WALKTHROUGH_ABORT: 'walkthrough_abort',
  WALKTHROUGH_COMPLETE: 'walkthrough_complete',
  
  // Step management
  STEP_ADVANCE: 'step_advance',
  STEP_BACK: 'step_back',
  STEP_VALIDATE: 'step_validate',
  STEP_RETRY: 'step_retry',
  
  // State updates
  STATE_UPDATE: 'state_update',
  SESSION_SYNC: 'session_sync',
  
  // Content script commands
  ACTIVATE_OVERLAY: 'activate_overlay',
  DEACTIVATE_OVERLAY: 'deactivate_overlay',
  HIGHLIGHT_TARGET: 'highlight_target',
  CLEAR_HIGHLIGHT: 'clear_highlight',
  BLOCK_INTERACTIONS: 'block_interactions',
  UNBLOCK_INTERACTIONS: 'unblock_interactions',
  
  // Validation
  VALIDATION_REQUEST: 'validation_request',
  VALIDATION_RESULT: 'validation_result',
  
  // Popup
  GET_PROGRESS: 'get_progress',
  PROGRESS_UPDATE: 'progress_update',
  
  // Rejection during active walkthrough
  COMMAND_REJECTED: 'command_rejected'
};

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Walkthrough,
    WalkthroughStep,
    ValidationSpec,
    WalkthroughSession,
    WalkthroughEvent,
    WalkthroughState,
    StepState,
    UserAction,
    ValidationRule,
    WalkthroughScope,
    WalkthroughEventType,
    MessageType
  };
}
