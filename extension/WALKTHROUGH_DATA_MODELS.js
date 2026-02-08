// ============================================================================
// WALKTHROUGH ENGINE - PRODUCTION DATA MODELS
// TypeScript-style definitions for clarity
// ============================================================================

// ============================================================================
// CORE ENUMS
// ============================================================================

const WalkthroughState = {
  IDLE: 'idle',           // No active walkthrough
  ACTIVE: 'active',       // Walkthrough in progress
  PAUSED: 'paused',       // Temporarily suspended
  COMPLETED: 'completed', // All steps done
  ABORTED: 'aborted',     // Early termination
  RECOVERING: 'recovering' // After tab reload
};

const StepState = {
  PENDING: 'pending',     // Not yet reached
  ACTIVE: 'active',       // Currently displayed
  VALIDATING: 'validating', // Checking user action
  COMPLETED: 'completed', // User action validated
  FAILED: 'failed',       // Validation failed, can retry
  BLOCKED: 'blocked'      // Cannot proceed (iframe, missing element)
};

const UserAction = {
  CLICK: 'click',         // Element click
  INPUT: 'input',         // Text input
  SELECT: 'select',       // Dropdown selection
  CHECK: 'check',         // Checkbox/radio
  SUBMIT: 'submit',       // Form submission
  HOVER: 'hover',         // Mouse hover (with duration)
  SCROLL: 'scroll',       // Scroll to position
  DRAG: 'drag',           // Drag and drop
  KEYPRESS: 'keypress',   // Specific key
  NAVIGATE: 'navigate',   // Page navigation
  CUSTOM: 'custom'        // Custom validation function
};

const ValidationRule = {
  CLICKED: 'clicked',           // Element was clicked
  VALUE_EQUALS: 'value_equals', // Input value match
  VALUE_CONTAINS: 'value_contains', // Input contains text
  VALUE_REGEX: 'value_regex',   // Regex match on value
  NAVIGATED: 'navigated',       // URL changed to expected
  ELEMENT_VISIBLE: 'element_visible', // Element appeared
  ELEMENT_HIDDEN: 'element_hidden', // Element disappeared
  FORM_VALID: 'form_valid',     // Form validation passed
  CUSTOM_FN: 'custom_fn',     // Custom function returned true
  TIMEOUT: 'timeout'          // Time-based auto-advance
};

const UrlScopeType = {
  EXACT: 'exact',         // Full URL match
  PREFIX: 'prefix',       // URL starts with
  REGEX: 'regex',         // Regex pattern match
  GLOB: 'glob',          // Glob pattern (simplified regex)
  DOMAIN: 'domain',       // Same origin
  ANY: 'any'             // Any URL (use sparingly)
};

const SelectorStrategy = {
  CSS_ID: 'css_id',           // #id
  CSS_CLASS: 'css_class',     // .class
  CSS_ATTRIBUTE: 'css_attr',  // [attr=value]
  CSS_PATH: 'css_path',       // nested selectors
  XPATH: 'xpath',             // XPath expression
  TEXT_MATCH: 'text_match',   // Text content match
  ARIA_LABEL: 'aria_label',   // Accessibility label
  TEST_ID: 'test_id',         // data-testid
  CUSTOM_ATTR: 'custom_attr'  // data-walkthrough-target
};

const SelectorStability = {
  STATIC: 'static',       // Unlikely to change (ID, test-id)
  SEMI_STATIC: 'semi_static', // May change (class names with hashes)
  DYNAMIC: 'dynamic',     // Likely to change (XPath, text)
  FRAGILE: 'fragile'      // Very likely to break (full path, index-based)
};

// ============================================================================
// CORE DATA MODELS
// ============================================================================

/**
 * SelectorSet - Layered selector model with fallbacks
 */
class SelectorSet {
  // Primary selector - most reliable
  primary = {
    type: SelectorStrategy.CSS_ID,
    value: '',
    stability: SelectorStability.STATIC,
    confidence: 1.0  // 0.0-1.0
  };
  
  // Fallback selectors - tried in order if primary fails
  fallbacks = [
    {
      type: SelectorStrategy.CSS_CLASS,
      value: '',
      stability: SelectorStability.SEMI_STATIC,
      confidence: 0.8
    },
    {
      type: SelectorStrategy.ARIA_LABEL,
      value: '',
      stability: SelectorStability.STATIC,
      confidence: 0.9
    }
  ];
  
  // Text-based match as last resort
  textMatch = {
    exactText: '',        // Exact text match
    partialText: '',    // Contains text
    selectorContext: '' // Scope selector (e.g., "button within .header")
  };
  
  // Structural fallback (if all else fails)
  structural = {
    parentSelector: '',   // Parent container
    childIndex: 0,        // Nth child
    tagName: ''          // Tag type filter
  };
  
  // Validation
  validate() {
    const errors = [];
    if (!this.primary.value) errors.push('Missing primary selector');
    if (this.fallbacks.length === 0) errors.push('No fallback selectors');
    if (this.primary.stability === SelectorStability.FRAGILE) {
      errors.push('Primary selector is fragile');
    }
    return { valid: errors.length === 0, errors };
  }
  
  // Calculate overall stability score
  getStabilityScore() {
    const weights = {
      primary: 0.5,
      fallbacks: 0.3,
      textMatch: 0.15,
      structural: 0.05
    };
    
    const scores = {
      [SelectorStability.STATIC]: 1.0,
      [SelectorStability.SEMI_STATIC]: 0.7,
      [SelectorStability.DYNAMIC]: 0.4,
      [SelectorStability.FRAGILE]: 0.2
    };
    
    let score = scores[this.primary.stability] * weights.primary;
    
    for (const fb of this.fallbacks) {
      score += scores[fb.stability] * (weights.fallbacks / this.fallbacks.length);
    }
    
    return Math.round(score * 100) / 100;
  }
}

/**
 * UrlScope - URL matching specification
 */
class UrlScope {
  type = UrlScopeType.PREFIX;
  value = '';              // Pattern to match
  excludePatterns = [];    // URLs to exclude
  
  validate() {
    const errors = [];
    if (!this.value) errors.push('Empty URL pattern');
    
    if (this.type === UrlScopeType.REGEX) {
      try {
        new RegExp(this.value);
      } catch (e) {
        errors.push('Invalid regex pattern');
      }
    }
    
    if (this.type === UrlScopeType.ANY) {
      errors.push('ANY scope type is discouraged');
    }
    
    return { valid: errors.length === 0, errors, warnings: [] };
  }
  
  matches(url) {
    switch (this.type) {
      case UrlScopeType.EXACT:
        return url === this.value;
      case UrlScopeType.PREFIX:
        return url.startsWith(this.value);
      case UrlScopeType.REGEX:
        return new RegExp(this.value).test(url);
      case UrlScopeType.GLOB:
        const pattern = this.value.replace(/\*/g, '.*');
        return new RegExp(pattern).test(url);
      case UrlScopeType.DOMAIN:
        try {
          return new URL(url).origin === this.value;
        } catch {
          return false;
        }
      case UrlScopeType.ANY:
        return true;
    }
    return false;
  }
}

/**
 * ValidationSpec - How to validate user completed a step
 */
class ValidationSpec {
  rule = ValidationRule.CLICKED;
  required = true;         // Must pass to advance
  
  // Rule-specific parameters
  params = {
    // For VALUE_EQUALS, VALUE_CONTAINS, VALUE_REGEX:
    expectedValue: '',
    
    // For TIMEOUT:
    durationMs: 5000,
    
    // For CUSTOM_FN:
    functionBody: '', // 'return element.value.length > 5;'
    
    // For ELEMENT_VISIBLE/HIDDEN:
    selector: '',
    timeoutMs: 10000
  };
  
  // Multiple rules can be AND/OR combined
  combineWith = null;      // 'AND' | 'OR' | null (single rule)
  additionalRules = [];    // ValidationSpec[]
  
  validate() {
    const errors = [];
    
    if (this.rule === ValidationRule.CUSTOM_FN && !this.params.functionBody) {
      errors.push('Custom validation requires function body');
    }
    
    if (this.rule === ValidationRule.VALUE_REGEX) {
      try {
        new RegExp(this.params.expectedValue);
      } catch {
        errors.push('Invalid regex in validation');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

/**
 * WalkthroughStep - Single step in a walkthrough
 */
class WalkthroughStep {
  id = '';                 // Unique step ID
  order = 0;               // Step sequence number
  
  // What user sees
  title = '';
  description = '';
  instructionText = '';    // Short action instruction (e.g., "Click the Save button")
  
  // What user must do
  requiredAction = UserAction.CLICK;
  actionConfig = {};       // Action-specific config
  
  // Where this step happens
  targetSelectors = new SelectorSet();
  urlScope = new UrlScope();
  
  // How we know it's done
  validation = new ValidationSpec();
  
  // Failure handling
  onFailure = {
    allowRetry: true,
    maxRetries: 3,
    fallbackStepId: null, // Jump to this step on repeated failure
    abortOnFailure: false
  };
  
  // Advanced features
  requiresIframeAccess = false;
  iframeSelector = '';     // If targeting element within iframe
  autoAdvanceDelay = 0;    // Auto-advance after N ms (for info steps)
  
  // Authoring metadata
  authoring = {
    createdAt: null,
    updatedAt: null,
    createdBy: '',
    notes: ''
  };
  
  // Runtime state (not persisted)
  runtime = {
    state: StepState.PENDING,
    startTime: null,
    endTime: null,
    retryCount: 0,
    validationAttempts: 0
  };
  
  // Validation methods
  validate() {
    const errors = [];
    const warnings = [];
    
    if (!this.id) errors.push('Missing step ID');
    if (!this.title) errors.push('Missing step title');
    
    // Validate selectors
    const selectorValidation = this.targetSelectors.validate();
    errors.push(...selectorValidation.errors);
    
    if (this.targetSelectors.getStabilityScore() < 0.6) {
      warnings.push('Low selector stability score - may break');
    }
    
    // Validate URL scope
    const urlValidation = this.urlScope.validate();
    errors.push(...urlValidation.errors);
    warnings.push(...urlValidation.warnings);
    
    if (this.urlScope.type === UrlScopeType.ANY) {
      warnings.push('Broad URL scope may cause unexpected matches');
    }
    
    // Validate validation spec
    const validationCheck = this.validation.validate();
    errors.push(...validationCheck.errors);
    
    // Check iframe requirements
    if (this.requiresIframeAccess && !this.iframeSelector) {
      warnings.push('Iframe access required but no iframe selector specified');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      selectorStability: this.targetSelectors.getStabilityScore()
    };
  }
}

/**
 * Walkthrough - Complete onboarding flow
 */
class Walkthrough {
  id = '';
  version = '1.0.0';
  
  // Metadata
  title = '';
  description = '';
  category = '';           // 'onboarding', 'feature_tour', 'migration'
  
  // Steps
  steps = [];            // WalkthroughStep[]
  
  // Entry conditions
  entryConditions = {
    urlPattern: '',      // Auto-start when user visits this URL
    userCriteria: {},    // { hasCompletedWalkthrough: 'other_id', userRole: 'admin' }
    trigger: 'manual'    // 'manual', 'url_match', 'event'
  };
  
  // Global settings
  settings = {
    allowSkip: false,           // Never allow skip (enforced)
    allowBack: true,            // Can go to previous step
    enforceOrder: true,         // Must complete in sequence
    maxDuration: 0,            // 0 = no limit, otherwise auto-abort
    requireCompletion: true,   // Must complete all steps
    showProgress: true         // Show progress bar
  };
  
  // Targeting
  targetDomain = '';         // Primary domain for this walkthrough
  allowedDomains = [];       // Additional domains where steps can occur
  blockedDomains = [];       // Domains where walkthrough cannot run
  
  // Failure handling
  onFailure = {
    defaultRetryCount: 3,
    allowAdminBypass: true,
    notifyOnFailure: true
  };
  
  // Authoring
  authoring = {
    createdAt: null,
    updatedAt: null,
    createdBy: '',
    published: false,
    publishVersion: ''
  };
  
  // Analytics
  analytics = {
    totalStarts: 0,
    totalCompletions: 0,
    totalAborts: 0,
    avgDuration: 0,
    stepFailureRates: {} // { stepId: failureCount }
  };
  
  // Validation
  validate() {
    const errors = [];
    const warnings = [];
    
    if (!this.id) errors.push('Missing walkthrough ID');
    if (!this.title) errors.push('Missing title');
    if (this.steps.length === 0) errors.push('No steps defined');
    
    // Validate all steps
    let totalStability = 0;
    for (const step of this.steps) {
      const result = step.validate();
      errors.push(...result.errors.map(e => `Step ${step.id}: ${e}`));
      warnings.push(...result.warnings.map(w => `Step ${step.id}: ${w}`));
      totalStability += result.selectorStability;
    }
    
    const avgStability = totalStability / this.steps.length;
    if (avgStability < 0.6) {
      warnings.push(`Low average selector stability (${avgStability.toFixed(2)}) - walkthrough may be brittle`);
    }
    
    // Check for duplicate step IDs
    const stepIds = this.steps.map(s => s.id);
    const duplicates = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
    }
    
    // Check for orphan steps (not reachable via next/prev)
    // This is a simplified check - full validation would trace paths
    
    return { valid: errors.length === 0, errors, warnings, avgStability };
  }
}

/**
 * WalkthroughSession - Active walkthrough instance
 */
class WalkthroughSession {
  id = '';                 // Session UUID
  walkthroughId = '';
  walkthroughVersion = '';
  
  // State
  state = WalkthroughState.IDLE;
  currentStepId = '';
  currentStepIndex = -1;
  
  // Progress tracking
  startedAt = null;
  completedAt = null;
  lastActivityAt = null;
  
  // Step history
  completedSteps = [];     // [stepId, ...]
  stepAttempts = {};       // { stepId: attemptCount }
  collectedData = {};      // User inputs captured during walkthrough
  
  // Context
  tabId = null;
  startUrl = '';
  userAgent = '';
  
  // Recovery
  recoveryCount = 0;       // Times recovered from reload
  lastRecoveryAt = null;
  
  // Abort info
  abortReason = null;
  abortedAt = null;
  abortedBy = null;        // 'user', 'admin', 'timeout', 'system'
}

/**
 * TelemetryEvent - Single telemetry record
 */
class TelemetryEvent {
  id = '';                 // Event UUID
  sessionId = '';
  timestamp = 0;
  
  type = '';              // 'session_start', 'step_enter', 'step_complete', 
                          // 'step_fail', 'validation_attempt', 'navigation_blocked',
                          // 'interaction_blocked', 'session_abort', 'session_complete',
                          // 'selector_retry', 'recovery', 'error'
  
  data = {};              // Event-specific data
  
  context = {
    url: '',
    stepId: '',
    stepIndex: -1,
    userAgent: '',
    extensionVersion: ''
  };
}

/**
 * DebugSession - Admin debug view data
 */
class DebugSession {
  session = null;          // WalkthroughSession
  currentStep = null;      // WalkthroughStep
  
  // Real-time state
  overlayState = {
    isActive: false,
    targetFound: false,
    targetRect: null,
    blockersInstalled: false
  };
  
  // Event log (last 50 events)
  eventLog = [];
  
  // Performance
  metrics = {
    stepDurations: [],
    validationLatencies: [],
    selectorResolutionTimes: []
  };
  
  // DOM snapshot (for debugging selector issues)
  domSnapshot = {
    url: '',
    title: '',
    bodyHTML: '',          // Truncated
    targetElementHTML: ''  // If found
  };
}

// ============================================================================
// SELECTOR RESOLUTION RESULT
// ============================================================================

class SelectorResolutionResult {
  success = false;
  element = null;          // DOM Element (content script only)
  selectorUsed = '';         // Which selector succeeded
  strategy = '';
  
  // Resolution metadata
  attempts = [];           // [{selector, success, timeMs}, ...]
  totalTimeMs = 0;
  retryCount = 0;
  
  // Failure info
  error = null;
  suggestions = [];          // ['Try waiting for page to load', 'Check if element is in iframe']
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

const MessageType = {
  // Lifecycle
  ACTIVATE_OVERLAY: 'ACTIVATE_OVERLAY',
  DEACTIVATE_OVERLAY: 'DEACTIVATE_OVERLAY',
  OVERLAY_READY: 'OVERLAY_READY',
  
  // Step flow
  STEP_ADVANCE: 'STEP_ADVANCE',
  STEP_RETRY: 'STEP_RETRY',
  STEP_VALIDATE: 'STEP_VALIDATE',
  
  // Validation
  VALIDATION_REQUEST: 'VALIDATION_REQUEST',
  VALIDATION_RESULT: 'VALIDATION_RESULT',
  
  // Navigation
  NAVIGATION_BLOCKED: 'NAVIGATION_BLOCKED',
  SPA_NAVIGATION_ATTEMPT: 'SPA_NAVIGATION_ATTEMPT',
  FORCE_REDIRECT: 'FORCE_REDIRECT',
  
  // Failure handling
  STEP_FAILURE: 'STEP_FAILURE',
  RETRY_STEP: 'RETRY_STEP',
  
  // Session
  WALKTHROUGH_START: 'WALKTHROUGH_START',
  WALKTHROUGH_PAUSE: 'WALKTHROUGH_PAUSE',
  WALKTHROUGH_RESUME: 'WALKTHROUGH_RESUME',
  WALKTHROUGH_ABORT: 'WALKTHROUGH_ABORT',
  WALKTHROUGH_FORCE_ABORT: 'WALKTHROUGH_FORCE_ABORT',
  WALKTHROUGH_COMPLETE: 'WALKTHROUGH_COMPLETE',
  
  // Progress
  GET_WALKTHROUGH_PROGRESS: 'GET_WALKTHROUGH_PROGRESS',
  STATE_UPDATE: 'STATE_UPDATE',
  
  // Debug
  GET_DEBUG_STATE: 'GET_DEBUG_STATE',
  GET_TELEMETRY: 'GET_TELEMETRY',
  
  // ACK
  ACK: 'ACK'
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WalkthroughState,
    StepState,
    UserAction,
    ValidationRule,
    UrlScopeType,
    SelectorStrategy,
    SelectorStability,
    SelectorSet,
    UrlScope,
    ValidationSpec,
    WalkthroughStep,
    Walkthrough,
    WalkthroughSession,
    TelemetryEvent,
    DebugSession,
    SelectorResolutionResult,
    MessageType
  };
}
