/**
 * Walkthrough Engine - Background Script State Machine
 * 
 * Manages the walkthrough lifecycle, enforces single walkthrough/active step policy,
 * and coordinates between popup and content scripts.
 * 
 * Architecture Principles:
 * - Single Source of Truth: Background script owns all walkthrough state
 * - Command Rejection: Non-walkthrough commands are rejected during active onboarding
 * - State Persistence: Session state survives page reloads
 * - Event Validation: Step progression only occurs after validation succeeds
 */

// Import models (in service worker, use importScripts or inline)
// For Chrome extension MV3, we inline the essential enums
const WalkthroughState = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ABORTED: 'aborted'
};

const StepState = {
  PENDING: 'pending',
  ACTIVE: 'active',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const UserAction = {
  CLICK: 'click',
  INPUT: 'input',
  SELECT: 'select',
  CHECK: 'check',
  SUBMIT: 'submit',
  HOVER: 'hover',
  SCROLL: 'scroll',
  DRAG: 'drag',
  KEYPRESS: 'keypress',
  CUSTOM: 'custom'
};

const MessageType = {
  WALKTHROUGH_START: 'walkthrough_start',
  WALKTHROUGH_PAUSE: 'walkthrough_pause',
  WALKTHROUGH_RESUME: 'walkthrough_resume',
  WALKTHROUGH_ABORT: 'walkthrough_abort',
  WALKTHROUGH_COMPLETE: 'walkthrough_complete',
  STEP_ADVANCE: 'step_advance',
  STEP_BACK: 'step_back',
  STEP_VALIDATE: 'step_validate',
  STEP_RETRY: 'step_retry',
  STATE_UPDATE: 'state_update',
  SESSION_SYNC: 'session_sync',
  ACTIVATE_OVERLAY: 'activate_overlay',
  DEACTIVATE_OVERLAY: 'deactivate_overlay',
  HIGHLIGHT_TARGET: 'highlight_target',
  CLEAR_HIGHLIGHT: 'clear_highlight',
  BLOCK_INTERACTIONS: 'block_interactions',
  UNBLOCK_INTERACTIONS: 'unblock_interactions',
  VALIDATION_REQUEST: 'validation_request',
  VALIDATION_RESULT: 'validation_result',
  GET_PROGRESS: 'get_progress',
  PROGRESS_UPDATE: 'progress_update',
  COMMAND_REJECTED: 'command_rejected'
};

// ============================================================================
// STATE MACHINE
// ============================================================================

class WalkthroughStateMachine {
  constructor() {
    // Core state - ONLY ONE WALKTHROUGH CAN BE ACTIVE
    this.activeSession = null;
    this.sessionState = WalkthroughState.IDLE;
    
    // Step state - ONLY ONE STEP CAN BE ACTIVE AT A TIME
    this.currentStepIndex = -1;
    this.currentStepState = StepState.PENDING;
    this.currentStepId = null;
    
    // Validation tracking
    this.validationQueue = [];
    this.isValidating = false;
    
    // Tab tracking
    this.activeTabId = null;
    this.blockedTabs = new Set(); // Tabs where interactions are blocked
    
    // Navigation tracking
    this.tabUpdateListener = null;
    this.urlCheckInterval = null;
    this.stepTimeoutId = null;
    this.validationLock = false;
    this.validationDebounceMs = 100;
    
    // Admin/debug mode
    this.isAdminMode = false;
    this.autoAbortTimeout = null;
    this.autoAbortDelayMs = 300000; // 5 minute safety timeout
    
    // Iframe tracking
    this.iframeContexts = new Map(); // tabId -> { hasSameOriginIframe, hasCrossOriginIframe }
    
    // ACK tracking
    this.pendingAcks = new Map(); // messageId -> { resolve, reject, timeout }
    
    // Telemetry storage - ring buffer config
    this.TELEMETRY_KEY = 'ig_walkthrough_telemetry';
    this.TELEMETRY_MAX_EVENTS = 1000; // Hard cap at 1000 events
    this.TELEMETRY_DEFAULT_EVENTS = 100; // Normal operation limit
    
    // Storage keys
    this.STORAGE_KEY_SESSION = 'ig_walkthrough_session';
    this.STORAGE_KEY_STATE = 'ig_walkthrough_state';
    this.STORAGE_KEY_ADMIN_MODE = 'ig_walkthrough_admin_mode';
    
    // Command rejection tracking
    this.rejectedCommands = [];
    
    // Bind methods
    this.startWalkthrough = this.startWalkthrough.bind(this);
    this.abortWalkthrough = this.abortWalkthrough.bind(this);
    this.completeWalkthrough = this.completeWalkthrough.bind(this);
    this.advanceStep = this.advanceStep.bind(this);
    this.validateStep = this.validateStep.bind(this);
    this._forceRedirectToStepUrl = this._forceRedirectToStepUrl.bind(this);
    this._handleTabUpdate = this._handleTabUpdate.bind(this);
    this._setupUrlEnforcement = this._setupUrlEnforcement.bind(this);
    this._startStepTimeout = this._startStepTimeout.bind(this);
    this._clearStepTimeout = this._clearStepTimeout.bind(this);
    this._safeForceAbort = this._safeForceAbort.bind(this);
  }
  
  // ==========================================================================
  // STATE ACCESSORS
  // ==========================================================================
  
  get isWalkthroughActive() {
    return this.sessionState === WalkthroughState.ACTIVE && this.activeSession !== null;
  }
  
  get hasActiveStep() {
    return this.currentStepState === StepState.ACTIVE || 
           this.currentStepState === StepState.VALIDATING;
  }
  
  get currentStep() {
    if (!this.activeSession || this.currentStepIndex < 0) return null;
    return this.activeSession.walkthrough?.steps?.[this.currentStepIndex] || null;
  }
  
  get progress() {
    if (!this.activeSession) {
      return { current: 0, total: 0, percentage: 0, state: 'idle' };
    }
    const total = this.activeSession.walkthrough?.steps?.length || 0;
    return {
      current: this.currentStepIndex + 1,
      total: total,
      percentage: total > 0 ? Math.round((this.currentStepIndex / total) * 100) : 0,
      state: this.sessionState,
      stepState: this.currentStepState,
      stepId: this.currentStepId
    };
  }
  
  // ==========================================================================
  // WALKTHROUGH LIFECYCLE
  // ==========================================================================
  
  /**
   * START: Initiates a new walkthrough session
   * ENFORCES: Only one walkthrough can be active at a time
   * ENFORCES: URL scope checking, iframe boundary detection, safety timeout
   */
  async startWalkthrough(walkthrough, tabId) {
    // REJECTION: If walkthrough already active, reject
    if (this.isWalkthroughActive) {
      console.warn('[IG Walkthrough] REJECTED: Walkthrough already active', {
        existingSession: this.activeSession?.id,
        requestedWalkthrough: walkthrough.id
      });
      return {
        success: false,
        error: 'WALKTHROUGH_ALREADY_ACTIVE',
        message: 'Only one walkthrough can be active at a time. Complete or abort the current walkthrough first.',
        currentProgress: this.progress
      };
    }
    
    // Validate walkthrough data
    if (!walkthrough || !walkthrough.steps || walkthrough.steps.length === 0) {
      return {
        success: false,
        error: 'INVALID_WALKTHROUGH',
        message: 'Walkthrough must have at least one step'
      };
    }
    
    // Detect iframe contexts before starting
    const iframeContext = await this._detectIframeContexts(tabId);
    
    // Check first step for iframe requirements
    const firstStep = walkthrough.steps[0];
    if (firstStep.requiresIframeAccess && iframeContext?.hasCrossOriginIframe) {
      return {
        success: false,
        error: 'IFRAME_ACCESS_REQUIRED',
        message: 'This walkthrough requires iframe access but cross-origin iframes were detected. Onboarding cannot proceed safely.'
      };
    }
    
    // Create session
    this.activeSession = {
      id: crypto.randomUUID(),
      walkthrough: walkthrough,
      tabId: tabId,
      startedAt: Date.now(),
      completedSteps: [],
      collectedData: {},
      startUrl: null // Will be set after tab query
    };
    
    // Get current URL for session tracking
    try {
      const tab = await chrome.tabs.get(tabId);
      this.activeSession.startUrl = tab?.url;
    } catch (e) {
      console.warn('[IG Walkthrough] Could not get start URL:', e);
    }
    
    this.sessionState = WalkthroughState.ACTIVE;
    this.activeTabId = tabId;
    
    // Setup URL enforcement BEFORE starting step
    this._setupUrlEnforcement();
    
    // Start at first step
    await this._enterStep(0);
    
    // Start safety timeout
    this._startStepTimeout();
    
    // Log telemetry
    await this._logTelemetry('SESSION_START', {
      walkthroughId: walkthrough.id,
      tabId: tabId,
      iframeContext: iframeContext,
      stepCount: walkthrough.steps?.length
    });
    
    // Persist to storage for recovery
    await this._persistSession();
    
    // Notify content script to activate overlay with ACK
    try {
      await this._sendWithAck(tabId, {
        type: MessageType.ACTIVATE_OVERLAY,
        session: this._getSessionSnapshot(),
        step: this.currentStep
      }, 10000);
      
      console.log('[IG Walkthrough] Session started with ACK:', this.activeSession.id);
    } catch (e) {
      console.error('[IG Walkthrough] Content script did not ACK overlay activation:', e);
      // Still continue - content script might still activate
    }
    
    return {
      success: true,
      sessionId: this.activeSession.id,
      progress: this.progress
    };
  }
  
  /**
   * PAUSE: Temporarily suspends the walkthrough
   * User can resume, but all blocking remains active
   */
  async pauseWalkthrough() {
    if (!this.isWalkthroughActive) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    this.sessionState = WalkthroughState.PAUSED;
    await this._persistSession();
    
    // Content script keeps overlay but shows paused state
    await this._sendToContentScript(this.activeTabId, {
      type: MessageType.STATE_UPDATE,
      state: WalkthroughState.PAUSED
    });
    
    return { success: true, progress: this.progress };
  }
  
  /**
   * RESUME: Continues a paused walkthrough
   */
  async resumeWalkthrough() {
    if (this.sessionState !== WalkthroughState.PAUSED) {
      return { success: false, error: 'WALKTHROUGH_NOT_PAUSED' };
    }
    
    this.sessionState = WalkthroughState.ACTIVE;
    await this._persistSession();
    
    await this._sendToContentScript(this.activeTabId, {
      type: MessageType.STATE_UPDATE,
      state: WalkthroughState.ACTIVE
    });
    
    return { success: true, progress: this.progress };
  }
  
  /**
   * ABORT: Terminates walkthrough early
   */
  async abortWalkthrough(reason = 'USER_INITIATED') {
    if (!this.activeSession) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    const tabId = this.activeTabId;
    
    // Log telemetry BEFORE cleanup
    await this._logTelemetry('SESSION_ABORT', {
      reason: reason,
      progress: this.progress,
      duration: Date.now() - (this.activeSession?.startedAt || 0)
    });
    
    // Cleanup URL enforcement
    if (this.tabUpdateListener) {
      chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
      this.tabUpdateListener = null;
    }
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    
    // Clear safety timeout
    this._clearStepTimeout();
    
    // Release validation lock
    this._releaseValidationLock();
    
    // Notify content script to clean up with ACK
    try {
      await this._sendWithAck(tabId, {
        type: MessageType.WALKTHROUGH_ABORT,
        reason: reason,
        progress: this.progress
      }, 5000);
    } catch (e) {
      console.warn('[IG Walkthrough] Content script did not ACK abort:', e);
    }
    
    // Clear state
    this._clearSession();
    
    console.log('[IG Walkthrough] Session aborted:', reason);
    
    return { success: true };
  }
  
  /**
   * COMPLETE: Finalizes walkthrough successfully
   */
  async completeWalkthrough() {
    if (!this.activeSession) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    const tabId = this.activeTabId;
    
    // Log telemetry
    await this._logTelemetry('SESSION_COMPLETE', {
      progress: this.progress,
      duration: Date.now() - (this.activeSession?.startedAt || 0),
      completedSteps: this.activeSession?.completedSteps?.length
    });
    
    // Notify content script
    await this._sendToContentScript(tabId, {
      type: MessageType.WALKTHROUGH_COMPLETE,
      progress: this.progress,
      collectedData: this.activeSession.collectedData
    });
    
    this.sessionState = WalkthroughState.COMPLETED;
    await this._persistSession();
    
    // Clear after brief delay to allow cleanup
    setTimeout(() => this._clearSession(), 1000);
    
    console.log('[IG Walkthrough] Session completed');
    
    return { success: true };
  }
  
  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================
  
  /**
   * ADVANCE: Move to next step after validation succeeds
   * ENFORCES: Step progression only after validation succeeds
   */
  async advanceStep() {
    if (!this.isWalkthroughActive) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    // ENFORCE: Can only advance from COMPLETED state or if current step done
    if (this.currentStepState !== StepState.COMPLETED && this.currentStepIndex >= 0) {
      console.warn('[IG Walkthrough] ADVANCE REJECTED: Current step not validated', {
        stepIndex: this.currentStepIndex,
        stepState: this.currentStepState
      });
      return {
        success: false,
        error: 'STEP_NOT_VALIDATED',
        message: 'Current step must be validated before advancing'
      };
    }
    
    const totalSteps = this.activeSession.walkthrough.steps.length;
    const nextIndex = this.currentStepIndex + 1;
    
    // Check if walkthrough is complete
    if (nextIndex >= totalSteps) {
      // Mark current step as completed in session
      this.activeSession.completedSteps.push(this.currentStepId);
      return this.completeWalkthrough();
    }
    
    // Record completion of current step
    if (this.currentStepId) {
      this.activeSession.completedSteps.push(this.currentStepId);
    }
    
    // Enter next step
    await this._enterStep(nextIndex);
    await this._persistSession();
    
    return {
      success: true,
      progress: this.progress
    };
  }
  
  /**
   * STEP BACK: Go to previous step (if allowed)
   */
  async stepBack() {
    if (!this.isWalkthroughActive) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    // Check if backtracking is allowed
    if (!this.activeSession.walkthrough.behavior?.allowBacktrack) {
      return {
        success: false,
        error: 'BACKTRACK_NOT_ALLOWED',
        message: 'This walkthrough does not allow going back to previous steps'
      };
    }
    
    if (this.currentStepIndex <= 0) {
      return { success: false, error: 'ALREADY_AT_FIRST_STEP' };
    }
    
    // Remove current step from completed
    this.activeSession.completedSteps.pop();
    
    // Enter previous step
    await this._enterStep(this.currentStepIndex - 1);
    await this._persistSession();
    
    return { success: true, progress: this.progress };
  }
  
  /**
   * VALIDATE: Check if step requirements are met
   * ENFORCES: Validation locking prevents race conditions
   * Called by content script when user performs action on target
   */
  async validateStep(eventData) {
    if (!this.isWalkthroughActive || !this.currentStep) {
      return {
        success: false,
        error: 'NO_ACTIVE_STEP',
        valid: false
      };
    }
    
    // ACQUIRE LOCK: Prevent concurrent validations
    if (!this._acquireValidationLock()) {
      console.warn('[IG Walkthrough] Validation rejected - lock held', {
        stepId: this.currentStepId,
        currentState: this.currentStepState
      });
      return {
        success: false,
        error: 'VALIDATION_IN_PROGRESS',
        valid: false,
        message: 'Validation already in progress'
      };
    }
    
    try {
      // Reset safety timeout on user activity
      this._startStepTimeout();
      
      const step = this.currentStep;
      const rules = step.validationRules || [];
      
      // If no rules, auto-pass
      if (rules.length === 0) {
        await this._markStepCompleted();
        return { success: true, valid: true, passedRules: [] };
      }
      
      // Validate each rule
      const results = [];
      let allPassed = true;
      
      for (const rule of rules) {
        const result = await this._validateRule(rule, eventData);
        results.push(result);
        
        if (rule.required && !result.passed) {
          allPassed = false;
        }
      }
      
      if (allPassed) {
        await this._markStepCompleted();
        
        // Send VALIDATION_RESULT ACK to content script
        await this._sendToContentScript(this.activeTabId, {
          type: MessageType.VALIDATION_RESULT,
          valid: true,
          stepId: this.currentStepId,
          passedRules: results.filter(r => r.passed).map(r => r.ruleId),
          allResults: results
        });
        
        return {
          success: true,
          valid: true,
          passedRules: results.filter(r => r.passed).map(r => r.ruleId),
          allResults: results
        };
      } else {
        this.currentStepState = StepState.FAILED;
        
        // Notify content script of failure with ACK
        await this._sendToContentScript(this.activeTabId, {
          type: MessageType.VALIDATION_RESULT,
          valid: false,
          stepId: this.currentStepId,
          failedRules: results.filter(r => !r.passed),
          message: 'Validation failed. Please try again.'
        });
        
        return {
          success: true, // Validation executed successfully
          valid: false,
          failedRules: results.filter(r => !r.passed),
          message: 'Validation failed. Please try again.'
        };
      }
    } catch (error) {
      console.error('[IG Walkthrough] Validation error:', error);
      this.currentStepState = StepState.FAILED;
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message
      };
    } finally {
      // DEFENSIVE: Always release lock
      this._releaseValidationLock();
    }
  }
  
  /**
   * RETRY: Reset current step for another attempt
   */
  async retryStep() {
    if (!this.isWalkthroughActive || !this.currentStep) {
      return { success: false, error: 'NO_ACTIVE_STEP' };
    }
    
    this.currentStepState = StepState.ACTIVE;
    
    // Re-activate current step in content script
    await this._sendToContentScript(this.activeTabId, {
      type: MessageType.STEP_RETRY,
      step: this.currentStep
    });
    
    return { success: true };
  }
  
  // ==========================================================================
  // COMMAND REJECTION (During Active Walkthrough)
  // ==========================================================================
  
  /**
   * Check if a command should be rejected during active onboarding
   * ENFORCES: Reject any non-walkthrough commands during active onboarding
   */
  shouldRejectCommand(commandType, sender) {
    // Always allow these system commands
    const systemCommands = [
      'PING',
      'GET_BINDING_STATUS',
      'TOKEN_BOUND',
      'TOKEN_UNBOUND',
      'TOKEN_REVOKED'
    ];
    
    if (systemCommands.includes(commandType)) {
      return { rejected: false };
    }
    
    // Always allow walkthrough-related commands
    const walkthroughCommands = Object.values(MessageType);
    if (walkthroughCommands.includes(commandType)) {
      return { rejected: false };
    }
    
    // REJECT all other commands during active walkthrough
    if (this.isWalkthroughActive) {
      this.rejectedCommands.push({
        command: commandType,
        timestamp: Date.now(),
        sender: sender?.tab?.id || 'unknown'
      });
      
      return {
        rejected: true,
        error: 'WALKTHROUGH_ACTIVE',
        message: 'This action is not allowed during an active walkthrough',
        currentWalkthrough: {
          id: this.activeSession.id,
          title: this.activeSession.walkthrough.title,
          progress: this.progress
        }
      };
    }
    
    return { rejected: false };
  }
  
  // ==========================================================================
  // NAVIGATION PREVENTION
  // ==========================================================================
  
  /**
   * Check if navigation should be blocked
   */
  shouldBlockNavigation(url) {
    if (!this.isWalkthroughActive || !this.currentStep) {
      return { blocked: false };
    }
    
    // Check if URL is in allowed scope
    const scope = this.activeSession.walkthrough.scope;
    let isAllowed = false;
    
    if (scope.type === 'url_pattern' && scope.pattern) {
      const regex = new RegExp(scope.pattern);
      isAllowed = regex.test(url);
    } else if (scope.type === 'domain' && scope.allowedDomains) {
      isAllowed = scope.allowedDomains.some(d => url.includes(d));
    }
    
    if (!isAllowed) {
      return {
        blocked: true,
        reason: 'NAVIGATION_OUTSIDE_SCOPE',
        allowedScope: scope,
        message: 'Navigation outside walkthrough scope is not allowed'
      };
    }
    
    // Check if step blocks navigation
    if (this.currentStep.blocking?.blockNavigation) {
      // Only allow navigation if it's to the next expected URL
      // This would need more sophisticated tracking in production
    }
    
    return { blocked: false };
  }
  
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  async _enterStep(index) {
    this.currentStepIndex = index;
    const step = this.activeSession.walkthrough.steps[index];
    this.currentStepId = step.id;
    this.currentStepState = StepState.ACTIVE;
    this.activeSession.stepStartedAt = Date.now();
    
    // Reset safety timeout for new step
    this._startStepTimeout();
    
    // Release any held validation lock
    this._releaseValidationLock();
    
    // Check iframe requirements for this step
    const iframeCheck = this._checkIframeRequirements(step);
    if (!iframeCheck.canProceed) {
      console.error('[IG Walkthrough] Step iframe check failed:', iframeCheck.message);
      // Notify user and abort
      await this.abortWalkthrough('IFRAME_REQUIREMENT_FAILED');
      return;
    }
    
    // Notify content script with ACK
    try {
      await this._sendWithAck(this.activeTabId, {
        type: MessageType.STEP_ADVANCE,
        step: step,
        stepIndex: index,
        progress: this.progress
      }, 5000);
    } catch (e) {
      console.warn('[IG Walkthrough] Content script did not ACK step advance:', e);
    }
    
    console.log('[IG Walkthrough] Entered step', index, ':', step.title);
  }
  
  async _markStepCompleted() {
    this.currentStepState = StepState.COMPLETED;
    
    // Notify content script
    await this._sendToContentScript(this.activeTabId, {
      type: MessageType.STEP_VALIDATE,
      step: this.currentStep,
      stepIndex: this.currentStepIndex,
      progress: this.progress
    });
    
    // Auto-advance after delay if configured
    const delay = this.currentStep.timing?.autoAdvanceDelay || 0;
    if (delay > 0) {
      setTimeout(() => this.advanceStep(), delay);
    }
  }
  
  async _validateRule(rule, eventData) {
    const result = {
      ruleId: rule.id,
      ruleType: rule.rule,
      passed: false,
      message: null
    };
    
    switch (rule.rule) {
      case 'clicked':
        result.passed = eventData?.action === 'click';
        break;
        
      case 'value_equals':
        result.passed = eventData?.value === rule.value;
        break;
        
      case 'value_contains':
        result.passed = eventData?.value?.includes(rule.value);
        break;
        
      case 'value_regex':
        try {
          const regex = new RegExp(rule.value);
          result.passed = regex.test(eventData?.value || '');
        } catch (e) {
          result.passed = false;
          result.message = 'Invalid regex pattern';
        }
        break;
        
      case 'navigated':
        result.passed = new RegExp(rule.value).test(eventData?.url || '');
        break;
        
      case 'element_visible':
        // Content script reports element visibility
        result.passed = eventData?.elementVisible === true;
        break;
        
      case 'custom_fn':
        // Custom validation would be handled by content script
        result.passed = eventData?.customValid === true;
        break;
        
      default:
        result.passed = false;
        result.message = `Unknown validation rule: ${rule.rule}`;
    }
    
    return result;
  }
  
  async _persistSession() {
    if (!this.activeSession) {
      await chrome.storage.local.remove([this.STORAGE_KEY_SESSION, this.STORAGE_KEY_STATE]);
      return;
    }
    
    const state = {
      sessionState: this.sessionState,
      currentStepIndex: this.currentStepIndex,
      currentStepState: this.currentStepState,
      currentStepId: this.currentStepId,
      activeTabId: this.activeTabId,
      lastUpdated: Date.now()
    };
    
    await chrome.storage.local.set({
      [this.STORAGE_KEY_SESSION]: this.activeSession,
      [this.STORAGE_KEY_STATE]: state
    });
  }
  
  async _loadPersistedSession() {
    try {
      const stored = await chrome.storage.local.get([
        this.STORAGE_KEY_SESSION,
        this.STORAGE_KEY_STATE
      ]);
      
      if (stored[this.STORAGE_KEY_STATE]) {
        const state = stored[this.STORAGE_KEY_STATE];
        this.sessionState = state.sessionState;
        this.currentStepIndex = state.currentStepIndex;
        this.currentStepState = state.currentStepState;
        this.currentStepId = state.currentStepId;
        this.activeTabId = state.activeTabId;
      }
      
      if (stored[this.STORAGE_KEY_SESSION]) {
        this.activeSession = stored[this.STORAGE_KEY_SESSION];
      }
    } catch (e) {
      console.error('[IG Walkthrough] Failed to load persisted session:', e);
    }
  }
  
  // ==========================================================================
  // URL ENFORCEMENT (Critical: prevents users from escaping steps)
  // ==========================================================================
  
  /**
   * Setup URL enforcement monitoring
   * Monitors tab updates and forces redirect if user leaves step scope
   */
  _setupUrlEnforcement() {
    // Remove existing listener
    if (this.tabUpdateListener) {
      chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
    }
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
    
    // Listen for tab URL changes
    this.tabUpdateListener = (tabId, changeInfo, tab) => {
      if (!this.isWalkthroughActive) return;
      if (tabId !== this.activeTabId) return;
      if (!changeInfo.url) return;
      
      // Check if URL is within step scope
      this._enforceStepUrlScope(tabId, changeInfo.url);
    };
    chrome.tabs.onUpdated.addListener(this.tabUpdateListener);
    
    // Also poll for URL changes (catches SPA router changes)
    this.urlCheckInterval = setInterval(() => {
      if (!this.isWalkthroughActive) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
        return;
      }
      
      chrome.tabs.get(this.activeTabId).then(tab => {
        if (tab?.url) {
          this._enforceStepUrlScope(tab.id, tab.url);
        }
      }).catch(() => {
        // Tab closed - abort walkthrough
        this.abortWalkthrough('TAB_CLOSED');
      });
    }, 500); // Check every 500ms
  }
  
  /**
   * Enforce step URL scope - force redirect if needed
   */
  async _enforceStepUrlScope(tabId, currentUrl) {
    if (!this.currentStep) return;
    
    const step = this.currentStep;
    const expectedUrl = step.expectedUrl || step.urlPattern;
    
    // Check if current URL matches step scope
    let urlMatches = false;
    
    if (expectedUrl) {
      if (expectedUrl.startsWith('regex:')) {
        const pattern = expectedUrl.slice(6);
        urlMatches = new RegExp(pattern).test(currentUrl);
      } else if (expectedUrl.startsWith('glob:')) {
        const pattern = expectedUrl.slice(5).replace(/\*/g, '.*');
        urlMatches = new RegExp(pattern).test(currentUrl);
      } else {
        // Exact match or contains
        urlMatches = currentUrl.includes(expectedUrl);
      }
    } else {
      // No URL restriction for this step
      return;
    }
    
    if (!urlMatches) {
      console.warn('[IG Walkthrough] URL scope violation detected:', {
        current: currentUrl,
        expected: expectedUrl
      });
      
      // Force redirect back to expected URL
      await this._forceRedirectToStepUrl(tabId, expectedUrl);
    }
  }
  
  /**
   * Force redirect user back to expected step URL
   */
  async _forceRedirectToStepUrl(tabId, expectedUrl) {
    try {
      // Resolve expected URL to absolute if needed
      let redirectUrl = expectedUrl;
      
      // If expectedUrl is a pattern, use the session start URL
      if (expectedUrl.startsWith('regex:') || expectedUrl.startsWith('glob:')) {
        redirectUrl = this.activeSession?.startUrl || this.activeSession?.walkthrough?.startUrl;
      }
      
      if (!redirectUrl) {
        console.error('[IG Walkthrough] Cannot redirect - no target URL');
        return;
      }
      
      console.log('[IG Walkthrough] Force redirecting to:', redirectUrl);
      
      // Execute redirect in content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'FORCE_REDIRECT',
        url: redirectUrl,
        reason: 'WALKTHROUGH_URL_SCOPE_ENFORCEMENT'
      });
      
      // Also update tab directly as backup
      await chrome.tabs.update(tabId, { url: redirectUrl });
      
    } catch (e) {
      console.error('[IG Walkthrough] Force redirect failed:', e);
      // If redirect fails, abort walkthrough
      this.abortWalkthrough('REDIRECT_FAILED');
    }
  }
  
  /**
   * Handle tab update event
   */
  _handleTabUpdate(tabId, changeInfo, tab) {
    if (!this.isWalkthroughActive) return;
    if (tabId !== this.activeTabId) return;
    
    if (changeInfo.url) {
      this._enforceStepUrlScope(tabId, changeInfo.url);
    }
    
    // Tab was closed
    if (changeInfo.status === 'unloaded') {
      this.abortWalkthrough('TAB_UNLOADED');
    }
  }
  
  // ==========================================================================
  // VALIDATION LOCKING (Prevents race conditions)
  // ==========================================================================
  
  /**
   * Check if validation is locked (prevents double-advance)
   */
  get isValidationLocked() {
    return this.validationLock;
  }
  
  /**
   * Acquire validation lock
   */
  _acquireValidationLock() {
    if (this.validationLock) {
      return false;
    }
    this.validationLock = true;
    this.currentStepState = StepState.VALIDATING;
    return true;
  }
  
  /**
   * Release validation lock
   */
  _releaseValidationLock() {
    this.validationLock = false;
  }
  
  /**
   * Debounced validation wrapper
   */
  async _debouncedValidate(eventData) {
    // Clear any pending validation
    if (this._validationDebounceTimeout) {
      clearTimeout(this._validationDebounceTimeout);
    }
    
    return new Promise((resolve) => {
      this._validationDebounceTimeout = setTimeout(async () => {
        const result = await this.validateStep(eventData);
        resolve(result);
      }, this.validationDebounceMs);
    });
  }
  
  // ==========================================================================
  // SAFETY TIMEOUT (Hard kill mechanism)
  // ==========================================================================
  
  /**
   * Start step timeout - auto-aborts if step takes too long
   */
  _startStepTimeout() {
    this._clearStepTimeout();
    
    this.autoAbortTimeout = setTimeout(() => {
      this._safeForceAbort();
    }, this.autoAbortDelayMs);
  }
  
  /**
   * Clear step timeout
   */
  _clearStepTimeout() {
    if (this.autoAbortTimeout) {
      clearTimeout(this.autoAbortTimeout);
      this.autoAbortTimeout = null;
    }
  }
  
  /**
   * Safe force abort - triggered by timeout
   */
  _safeForceAbort() {
    console.error('[IG Walkthrough] SAFETY TIMEOUT TRIGGERED - Auto aborting walkthrough');
    this.abortWalkthrough('SAFETY_TIMEOUT');
  }
  
  // ==========================================================================
  // IFRAME BOUNDARY DETECTION
  // ==========================================================================
  
  /**
   * Detect iframe contexts in target tab
   */
  async _detectIframeContexts(tabId) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'DETECT_IFRAME_CONTEXTS'
      });
      
      this.iframeContexts.set(tabId, {
        hasSameOriginIframe: result?.hasSameOriginIframe || false,
        hasCrossOriginIframe: result?.hasCrossOriginIframe || false,
        timestamp: Date.now()
      });
      
      return result;
    } catch (e) {
      console.warn('[IG Walkthrough] Failed to detect iframe contexts:', e);
      return { hasSameOriginIframe: false, hasCrossOriginIframe: false };
    }
  }
  
  /**
   * Check if step requires iframe access
   */
  _checkIframeRequirements(step) {
    const requiresIframe = step.requiresIframeAccess || false;
    const iframeContext = this.iframeContexts.get(this.activeTabId);
    
    if (requiresIframe && iframeContext?.hasCrossOriginIframe) {
      return {
        canProceed: false,
        error: 'IFRAME_ACCESS_REQUIRED',
        message: 'This step requires iframe access but cross-origin iframes detected. Onboarding cannot proceed safely.'
      };
    }
    
    return { canProceed: true };
  }
  
  // ==========================================================================
  // ACK-BASED MESSAGING (Prevents silent desync)
  // ==========================================================================
  
  /**
   * Send message with ACK requirement
   */
  async _sendWithAck(tabId, message, timeoutMs = 5000) {
    const messageId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(messageId);
        reject(new Error(`ACK timeout for message: ${message.type}`));
      }, timeoutMs);
      
      // Store pending ACK
      this.pendingAcks.set(messageId, { resolve, reject, timeout });
      
      // Send message with ACK requirement
      chrome.tabs.sendMessage(tabId, {
        ...message,
        _ackId: messageId,
        _requiresAck: true
      }).catch(reject);
    });
  }
  
  /**
   * Handle incoming ACK
   */
  handleAck(ackId, success, data) {
    const pending = this.pendingAcks.get(ackId);
    if (!pending) return;
    
    clearTimeout(pending.timeout);
    this.pendingAcks.delete(ackId);
    
    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(data?.message || 'ACK failed'));
    }
  }
  
  // ==========================================================================
  // ADMIN MODE
  // ==========================================================================
  
  async _loadAdminMode() {
    const stored = await chrome.storage.local.get([this.STORAGE_KEY_ADMIN_MODE]);
    this.isAdminMode = stored[this.STORAGE_KEY_ADMIN_MODE] || false;
  }
  
  async setAdminMode(enabled) {
    this.isAdminMode = enabled;
    await chrome.storage.local.set({ [this.STORAGE_KEY_ADMIN_MODE]: enabled });
  }
  
  /**
   * Force abort - admin-only escape hatch
   */
  async forceAbort(reason = 'ADMIN_FORCE_ABORT') {
    if (!this.isAdminMode) {
      return {
        success: false,
        error: 'ADMIN_REQUIRED',
        message: 'Force abort requires admin mode'
      };
    }
    
    console.warn('[IG Walkthrough] ADMIN FORCE ABORT:', reason);
    return this.abortWalkthrough(reason);
  }
  
  /**
   * Log telemetry event for postmortem debugging
   * Uses ring buffer with oldest-first eviction
   */
  async _logTelemetry(eventType, data = {}) {
    try {
      const timestamp = Date.now();
      const sessionId = this.activeSession?.id || 'unknown';
      
      const event = {
        timestamp,
        sessionId,
        eventType,
        data: {
          ...data,
          stepIndex: this.currentStepIndex,
          stepId: this.currentStepId,
          stepState: this.currentStepState,
          sessionState: this.sessionState
        }
      };
      
      // Get existing telemetry
      const stored = await chrome.storage.local.get([this.TELEMETRY_KEY]);
      let telemetry = stored[this.TELEMETRY_KEY] || [];
      
      // Add new event
      telemetry.push(event);
      
      // Ring buffer eviction: remove oldest events if over limit
      // Use hard cap to prevent storage overflow
      const maxEvents = telemetry.length > this.TELEMETRY_DEFAULT_EVENTS 
        ? this.TELEMETRY_MAX_EVENTS 
        : this.TELEMETRY_DEFAULT_EVENTS;
        
      if (telemetry.length > maxEvents) {
        // Remove oldest events (first in array)
        const evictCount = telemetry.length - maxEvents;
        telemetry.splice(0, evictCount);
        console.log(`[IG Walkthrough Telemetry] Evicted ${evictCount} old events (ring buffer)`);
      }
      
      await chrome.storage.local.set({ [this.TELEMETRY_KEY]: telemetry });
      
      // Also log to console for immediate visibility
      console.log(`[IG Walkthrough Telemetry] ${eventType}:`, event.data);
    } catch (e) {
      // Silently fail - telemetry should not break functionality
      console.error('[IG Walkthrough] Telemetry logging failed:', e);
    }
  }
  
  /**
   * Get telemetry for debugging (with optional limit)
   */
  async getTelemetry(limit = 100) {
    const stored = await chrome.storage.local.get([this.TELEMETRY_KEY]);
    const telemetry = stored[this.TELEMETRY_KEY] || [];
    // Return most recent events first
    return telemetry.slice(-limit).reverse();
  }
  
  /**
   * Clear all telemetry
   */
  async clearTelemetry() {
    await chrome.storage.local.remove([this.TELEMETRY_KEY]);
    console.log('[IG Walkthrough Telemetry] Cleared all events');
  }
  
  /**
   * Get telemetry stats
   */
  async getTelemetryStats() {
    const telemetry = await this.getTelemetry(this.TELEMETRY_MAX_EVENTS);
    
    const sessions = new Set();
    const eventTypes = {};
    let completions = 0;
    let aborts = 0;
    
    for (const event of telemetry) {
      if (event.sessionId) sessions.add(event.sessionId);
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
      if (event.eventType === 'session_complete') completions++;
      if (event.eventType === 'session_abort') aborts++;
    }
    
    return {
      totalEvents: telemetry.length,
      uniqueSessions: sessions.size,
      eventTypes,
      completions,
      aborts,
      storageEstimate: JSON.stringify(telemetry).length
    };
  }
  
  _clearSession() {
    // Clear core state
    this.activeSession = null;
    this.sessionState = WalkthroughState.IDLE;
    this.currentStepIndex = -1;
    this.currentStepState = StepState.PENDING;
    this.currentStepId = null;
    this.activeTabId = null;
    this.blockedTabs.clear();
    
    // Cleanup URL enforcement
    if (this.tabUpdateListener) {
      chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
      this.tabUpdateListener = null;
    }
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    
    // Cleanup safety timeout
    this._clearStepTimeout();
    
    // Release validation lock
    this._releaseValidationLock();
    
    // Clear pending ACKs
    this.pendingAcks.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Session cleared'));
    });
    this.pendingAcks.clear();
    
    // Clear iframe contexts
    this.iframeContexts.clear();
    
    chrome.storage.local.remove([this.STORAGE_KEY_SESSION, this.STORAGE_KEY_STATE]);
  }
  
  _getSessionSnapshot() {
    if (!this.activeSession) return null;
    return {
      id: this.activeSession.id,
      walkthroughId: this.activeSession.walkthrough.id,
      walkthroughTitle: this.activeSession.walkthrough.title,
      state: this.sessionState,
      progress: this.progress,
      startedAt: this.activeSession.startedAt
    };
  }
  
  async _sendToContentScript(tabId, message) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      console.warn('[IG Walkthrough] Failed to send message to tab', tabId, e.message);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const walkthroughStateMachine = new WalkthroughStateMachine();

// Load any persisted session on initialization
walkthroughStateMachine._loadPersistedSession();

// Load admin mode setting
walkthroughStateMachine._loadAdminMode();

// Listen for admin mode toggle
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes[walkthroughStateMachine.STORAGE_KEY_ADMIN_MODE]) {
    walkthroughStateMachine.isAdminMode = changes[walkthroughStateMachine.STORAGE_KEY_ADMIN_MODE].newValue || false;
  }
});

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WalkthroughStateMachine, walkthroughStateMachine };
}
