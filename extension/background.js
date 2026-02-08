// Interguide Extension Background Service Worker
// Capability-based binding: zero cookies, zero session, token-only
// Walkthrough Engine: Active, enforced onboarding with state machine

// Import walkthrough state machine (for MV3 service worker, inline essential parts)
// Full implementation is in walkthrough-state-machine.js
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

const WalkthroughMessageType = {
  WALKTHROUGH_START: 'walkthrough_start',
  WALKTHROUGH_PAUSE: 'walkthrough_pause',
  WALKTHROUGH_RESUME: 'walkthrough_resume',
  WALKTHROUGH_ABORT: 'walkthrough_abort',
  WALKTHROUGH_COMPLETE: 'walkthrough_complete',
  STEP_ADVANCE: 'step_advance',
  STEP_BACK: 'step_back',
  STEP_VALIDATE: 'step_validate',
  STEP_RETRY: 'step_retry',
  VALIDATION_REQUEST: 'validation_request',
  VALIDATION_RESULT: 'validation_result',
  INTERACTION_BLOCKED: 'interaction_blocked',
  NAVIGATION_BLOCKED: 'navigation_blocked',
  GET_PROGRESS: 'get_progress',
  COMMAND_REJECTED: 'command_rejected'
};

// ============================================================================
// WALKTHROUGH STATE MACHINE (Background Script)
// ============================================================================

class WalkthroughStateMachine {
  constructor() {
    // Core state - ONLY ONE WALKTHROUGH CAN BE ACTIVE
    this.activeSession = null;
    this.sessionState = WalkthroughState.IDLE;
    this.currentStepIndex = -1;
    this.currentStepState = StepState.PENDING;
    this.currentStepId = null;
    this.activeTabId = null;
    this.isValidating = false;
    this.STORAGE_KEY_SESSION = 'ig_walkthrough_session';
    this.STORAGE_KEY_STATE = 'ig_walkthrough_state';
    this.rejectedCommands = [];
    
    // Load persisted session on init
    this._loadPersistedSession();
  }
  
  get isWalkthroughActive() {
    return this.sessionState === WalkthroughState.ACTIVE && this.activeSession !== null;
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
  
  async startWalkthrough(walkthrough, tabId) {
    if (this.isWalkthroughActive) {
      return {
        success: false,
        error: 'WALKTHROUGH_ALREADY_ACTIVE',
        message: 'Only one walkthrough can be active at a time',
        currentProgress: this.progress
      };
    }
    
    if (!walkthrough?.steps?.length) {
      return {
        success: false,
        error: 'INVALID_WALKTHROUGH',
        message: 'Walkthrough must have at least one step'
      };
    }
    
    this.activeSession = {
      id: crypto.randomUUID(),
      walkthrough: walkthrough,
      tabId: tabId,
      startedAt: Date.now(),
      completedSteps: [],
      collectedData: {}
    };
    
    this.sessionState = WalkthroughState.ACTIVE;
    this.activeTabId = tabId;
    
    await this._enterStep(0);
    await this._persistSession();
    
    await this._sendToContentScript(tabId, {
      type: WalkthroughMessageType.ACTIVATE_OVERLAY,
      session: this._getSessionSnapshot(),
      step: this.currentStep
    });
    
    console.log('[IG Walkthrough] Started:', this.activeSession.id);
    return { success: true, sessionId: this.activeSession.id, progress: this.progress };
  }
  
  async abortWalkthrough(reason = 'USER_INITIATED') {
    if (!this.activeSession) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    const tabId = this.activeTabId;
    
    await this._sendToContentScript(tabId, {
      type: WalkthroughMessageType.WALKTHROUGH_ABORT,
      reason: reason,
      progress: this.progress
    });
    
    this._clearSession();
    return { success: true };
  }
  
  async advanceStep() {
    if (!this.isWalkthroughActive) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    if (this.currentStepState !== StepState.COMPLETED && this.currentStepIndex >= 0) {
      return {
        success: false,
        error: 'STEP_NOT_VALIDATED',
        message: 'Current step must be validated before advancing'
      };
    }
    
    const totalSteps = this.activeSession.walkthrough.steps.length;
    const nextIndex = this.currentStepIndex + 1;
    
    if (nextIndex >= totalSteps) {
      if (this.currentStepId) {
        this.activeSession.completedSteps.push(this.currentStepId);
      }
      return this.completeWalkthrough();
    }
    
    if (this.currentStepId) {
      this.activeSession.completedSteps.push(this.currentStepId);
    }
    
    await this._enterStep(nextIndex);
    await this._persistSession();
    
    return { success: true, progress: this.progress };
  }
  
  async completeWalkthrough() {
    if (!this.activeSession) {
      return { success: false, error: 'NO_ACTIVE_WALKTHROUGH' };
    }
    
    const tabId = this.activeTabId;
    
    await this._sendToContentScript(tabId, {
      type: WalkthroughMessageType.WALKTHROUGH_COMPLETE,
      progress: this.progress,
      collectedData: this.activeSession.collectedData
    });
    
    this.sessionState = WalkthroughState.COMPLETED;
    await this._persistSession();
    
    setTimeout(() => this._clearSession(), 1000);
    return { success: true };
  }
  
  async validateStep(eventData) {
    if (!this.isWalkthroughActive || !this.currentStep) {
      return { success: false, error: 'NO_ACTIVE_STEP', valid: false };
    }
    
    this.currentStepState = StepState.VALIDATING;
    this.isValidating = true;
    
    const step = this.currentStep;
    const rules = step.validationRules || [];
    
    if (rules.length === 0) {
      await this._markStepCompleted();
      return { success: true, valid: true };
    }
    
    let allPassed = true;
    const results = [];
    
    for (const rule of rules) {
      const result = this._validateRule(rule, eventData);
      results.push(result);
      if (rule.required !== false && !result.passed) {
        allPassed = false;
      }
    }
    
    this.isValidating = false;
    
    if (allPassed) {
      await this._markStepCompleted();
      return { success: true, valid: true, passedRules: results.filter(r => r.passed).map(r => r.ruleId) };
    } else {
      this.currentStepState = StepState.FAILED;
      return { success: true, valid: false, failedRules: results.filter(r => !r.passed) };
    }
  }
  
  shouldRejectCommand(commandType) {
    const systemCommands = ['PING', 'GET_BINDING_STATUS', 'TOKEN_BOUND', 'TOKEN_UNBOUND', 'TOKEN_REVOKED'];
    const walkthroughCommands = Object.values(WalkthroughMessageType);
    
    if (systemCommands.includes(commandType) || walkthroughCommands.includes(commandType)) {
      return { rejected: false };
    }
    
    if (this.isWalkthroughActive) {
      this.rejectedCommands.push({ command: commandType, timestamp: Date.now() });
      return {
        rejected: true,
        error: 'WALKTHROUGH_ACTIVE',
        message: 'This action is not allowed during an active walkthrough',
        currentWalkthrough: { id: this.activeSession.id, progress: this.progress }
      };
    }
    
    return { rejected: false };
  }
  
  // Private methods
  async _enterStep(index) {
    this.currentStepIndex = index;
    const step = this.activeSession.walkthrough.steps[index];
    this.currentStepId = step.id;
    this.currentStepState = StepState.ACTIVE;
    this.activeSession.stepStartedAt = Date.now();
    
    await this._sendToContentScript(this.activeTabId, {
      type: WalkthroughMessageType.STEP_ADVANCE,
      step: step,
      stepIndex: index,
      progress: this.progress
    });
  }
  
  async _markStepCompleted() {
    this.currentStepState = StepState.COMPLETED;
    await this._sendToContentScript(this.activeTabId, {
      type: WalkthroughMessageType.STEP_VALIDATE,
      step: this.currentStep,
      stepIndex: this.currentStepIndex,
      progress: this.progress
    });
  }
  
  _validateRule(rule, eventData) {
    const result = { ruleId: rule.id, ruleType: rule.rule, passed: false };
    
    switch (rule.rule) {
      case 'clicked':
        result.passed = eventData?.type === 'click';
        break;
      case 'value_equals':
        result.passed = eventData?.value === rule.value;
        break;
      case 'value_contains':
        result.passed = eventData?.value?.includes(rule.value);
        break;
      case 'value_regex':
        try {
          result.passed = new RegExp(rule.value).test(eventData?.value || '');
        } catch (e) {
          result.passed = false;
        }
        break;
      case 'navigated':
        result.passed = new RegExp(rule.value).test(eventData?.url || '');
        break;
      default:
        result.passed = false;
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
      const stored = await chrome.storage.local.get([this.STORAGE_KEY_SESSION, this.STORAGE_KEY_STATE]);
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
      console.error('[IG Walkthrough] Failed to load session:', e);
    }
  }
  
  _clearSession() {
    this.activeSession = null;
    this.sessionState = WalkthroughState.IDLE;
    this.currentStepIndex = -1;
    this.currentStepState = StepState.PENDING;
    this.currentStepId = null;
    this.activeTabId = null;
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
      console.warn('[IG Walkthrough] Failed to send to tab', tabId, e.message);
    }
  }
}

// Initialize state machine
const walkthroughSM = new WalkthroughStateMachine();

const API_BASE = 'https://api.interguide.app/api';
const STORAGE_KEY_TOKEN = 'ig_binding_token';
const STORAGE_KEY_WORKSPACE = 'ig_workspace';
const STORAGE_KEY_EXTENSION_ID = 'ig_extension_id';

// Track content script ports for messaging
const contentScriptPorts = new Map();

// Get stored token and workspace
async function getStoredBinding() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_WORKSPACE,
    STORAGE_KEY_EXTENSION_ID
  ]);
  return {
    token: data[STORAGE_KEY_TOKEN] || null,
    workspace: data[STORAGE_KEY_WORKSPACE] || null,
    extensionId: data[STORAGE_KEY_EXTENSION_ID] || chrome.runtime.id
  };
}

// Make authenticated API call with binding token
async function apiCall(endpoint, options = {}) {
  const { token, extensionId } = await getStoredBinding();
  
  console.log('[IG Background] apiCall to', endpoint, 'token exists:', !!token);
  
  if (!token) {
    throw new Error('No binding token');
  }
  
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    'X-Workspace-Binding': token,
    'X-Extension-Id': extensionId,
    ...options.headers
  };
  
  // Remove cookie header - we use token-only auth
  delete headers['Cookie'];
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit' // ZERO COOKIE POLICY
  });
  
  // Handle revocation - only clear on 403 (forbidden) which means token is revoked
  // Don't clear on 401 (unauthorized) which could be transient
  if (response.status === 403) {
    console.error('[IG Background] Token revoked (403), clearing storage');
    // Token revoked or invalid - clear storage and notify
    await chrome.storage.local.remove([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_WORKSPACE,
      STORAGE_KEY_EXTENSION_ID
    ]);
    
    // Notify all content scripts
    contentScriptPorts.forEach((port, tabId) => {
      try {
        port.postMessage({ type: 'TOKEN_REVOKED' });
      } catch (e) {
        // Port may be disconnected
      }
    });
    
    throw new Error('Token revoked');
  }
  
  if (response.status === 401) {
    console.error('[IG Background] Token unauthorized (401) - not clearing storage, may be transient');
    throw new Error('Token unauthorized');
  }
  
  return response;
}

// Resolve targets for current URL
async function resolveTargets(url) {
  try {
    const response = await apiCall(`/extension/resolve?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      if (response.status === 401) {
        return { matches: [], error: 'UNAUTHORIZED' };
      }
      if (response.status === 403) {
        return { matches: [], error: 'FORBIDDEN' };
      }
      return { matches: [], error: 'API_ERROR' };
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Resolve error:', error);
    if (error.message === 'No binding token') {
      return { matches: [], error: 'NO_BINDING' };
    }
    if (error.message === 'Token revoked') {
      return { matches: [], error: 'TOKEN_REVOKED' };
    }
    return { matches: [], error: 'NETWORK_ERROR' };
  }
}

// Get walkthroughs for bound workspace
async function getWalkthroughs() {
  try {
    const response = await apiCall('/extension/walkthroughs');
    if (!response.ok) {
      if (response.status === 401) {
        return { walkthroughs: [], error: 'UNAUTHORIZED' };
      }
      if (response.status === 403) {
        return { walkthroughs: [], error: 'FORBIDDEN' };
      }
      return { walkthroughs: [], error: 'API_ERROR' };
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Walkthroughs error:', error);
    if (error.message === 'No binding token') {
      return { walkthroughs: [], error: 'NO_BINDING' };
    }
    if (error.message === 'Token revoked') {
      return { walkthroughs: [], error: 'TOKEN_REVOKED' };
    }
    return { walkthroughs: [], error: 'NETWORK_ERROR' };
  }
}

// Create a new extension target
async function createTarget(targetData) {
  try {
    const response = await apiCall('/extension/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to create target');
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Create target error:', error);
    throw error;
  }
}

// List all targets in workspace
async function listTargets() {
  try {
    const response = await apiCall('/extension/targets');
    if (!response.ok) {
      if (response.status === 401) return [];
      if (response.status === 403) return [];
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] List targets error:', error);
    return [];
  }
}

// Update existing target
async function updateTarget(targetId, targetData) {
  try {
    const response = await apiCall(`/extension/targets/${targetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to update target');
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Update target error:', error);
    throw error;
  }
}

// Delete target
async function deleteTarget(targetId) {
  try {
    const response = await apiCall(`/extension/targets/${targetId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to delete target');
    }
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Delete target error:', error);
    throw error;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;
  
  // WALKTHROUGH COMMAND REJECTION: Check if non-walkthrough commands should be rejected
  if (!message.type.startsWith('WALKTHROUGH') && 
      !['PING', 'GET_BINDING_STATUS', 'TOKEN_BOUND', 'TOKEN_UNBOUND', 'TOKEN_REVOKED'].includes(message.type)) {
    const rejection = walkthroughSM.shouldRejectCommand(message.type);
    if (rejection.rejected) {
      console.warn('[IG Walkthrough] Command rejected:', message.type, rejection.error);
      sendResponse({ 
        error: rejection.error, 
        message: rejection.message,
        walkthrough: rejection.currentWalkthrough,
        rejected: true
      });
      return true;
    }
  }
  
  (async () => {
    switch (message.type) {
      // =========================================================================
      // WALKTHROUGH ENGINE MESSAGES
      // =========================================================================
      
      case 'WALKTHROUGH_START':
        // Start a new walkthrough session
        const startResult = await walkthroughSM.startWalkthrough(message.walkthrough, message.tabId);
        sendResponse(startResult);
        break;
        
      case 'WALKTHROUGH_ABORT':
        // Abort active walkthrough
        const abortResult = await walkthroughSM.abortWalkthrough(message.reason);
        sendResponse(abortResult);
        break;
        
      case 'WALKTHROUGH_PAUSE':
        // Pause active walkthrough
        const pauseResult = await walkthroughSM.pauseWalkthrough?.() || { success: false, error: 'NOT_IMPLEMENTED' };
        sendResponse(pauseResult);
        break;
        
      case 'WALKTHROUGH_RESUME':
        // Resume paused walkthrough
        const resumeResult = await walkthroughSM.resumeWalkthrough?.() || { success: false, error: 'NOT_IMPLEMENTED' };
        sendResponse(resumeResult);
        break;
        
      case 'VALIDATION_REQUEST':
        // Validate step based on user action
        const validationResult = await walkthroughSM.validateStep(message.eventData);
        sendResponse(validationResult);
        break;
        
      case 'STEP_ADVANCE':
        // Advance to next step (only after validation)
        const advanceResult = await walkthroughSM.advanceStep();
        sendResponse(advanceResult);
        break;
        
      case 'GET_WALKTHROUGH_PROGRESS':
        // Get current walkthrough progress for popup display
        sendResponse({
          isActive: walkthroughSM.isWalkthroughActive,
          progress: walkthroughSM.progress,
          currentStep: walkthroughSM.currentStep
        });
        break;
        
      case 'INTERACTION_BLOCKED':
        // Log blocked interaction from content script
        console.log('[IG Walkthrough] Interaction blocked:', message);
        sendResponse({ logged: true });
        break;
        
      case 'NAVIGATION_BLOCKED':
        // Log blocked navigation from content script
        console.log('[IG Walkthrough] Navigation blocked:', message);
        sendResponse({ logged: true });
        break;
        
      case 'SPA_NAVIGATION_ATTEMPT':
        // Content script detected SPA router navigation attempt
        console.log('[IG Walkthrough] SPA navigation detected:', {
          method: message.method,
          url: message.url,
          stepId: message.stepId
        });
        // Background URL enforcement will catch this via polling
        sendResponse({ received: true });
        break;
        
      case 'WALKTHROUGH_FORCE_ABORT':
        // Admin-only force abort
        const forceAbortResult = await walkthroughSM.forceAbort(message.reason);
        sendResponse(forceAbortResult);
        break;
        
      case 'ACK':
        // Handle ACK from content script - IDEMPOTENT
        // Late ACKs and unknown IDs are silently dropped
        if (message.ackId && typeof message.success === 'boolean') {
          walkthroughSM.handleAck(message.ackId, message.success, message.data);
        }
        sendResponse({ received: true });
        break;
        
      // =========================================================================
      // EXISTING MESSAGES (Preserved)
      // =========================================================================
      
      case 'TOKEN_BOUND':
        // Token was just bound in popup - notify content scripts
        contentScriptPorts.forEach((port, tabId) => {
          try {
            port.postMessage({ type: 'TOKEN_BOUND' });
          } catch (e) {}
        });
        sendResponse({ success: true });
        break;
        
      case 'TOKEN_UNBOUND':
        // Token was unbound in popup - clear and notify
        contentScriptPorts.forEach((port, tabId) => {
          try {
            port.postMessage({ type: 'TOKEN_REVOKED' });
          } catch (e) {}
        });
        sendResponse({ success: true });
        break;
        
      case 'RESOLVE_TARGETS':
        // Content script requesting target resolution
        const targets = await resolveTargets(message.url);
        sendResponse(targets);
        break;
        
      case 'GET_WALKTHROUGHS':
        // Content script OR popup requesting walkthrough data
        // Uses binding token auth via /extension/walkthroughs endpoint
        const walkthroughs = await getWalkthroughs();
        sendResponse(walkthroughs);
        break;
        
      case 'CREATE_TARGET':
        // Popup/content script creating a new target
        // ENFORCE: Must have token and workspace binding
        const createBinding = await getStoredBinding();
        if (!createBinding.token || !createBinding.workspace) {
          sendResponse({ success: false, error: 'NOT_BOUND' });
          return;
        }
        
        try {
          const newTarget = await createTarget(message.data);
          sendResponse({ success: true, target: newTarget });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'GET_TARGETS':
        // Popup requesting all targets for management
        const listBinding = await getStoredBinding();
        if (!listBinding.token || !listBinding.workspace) {
          sendResponse({ targets: [], error: 'NOT_BOUND' });
          return;
        }
        try {
          const targets = await listTargets();
          sendResponse({ targets });
        } catch (error) {
          sendResponse({ targets: [], error: error.message });
        }
        break;
        
      case 'UPDATE_TARGET':
        // Popup updating existing target
        const updateBinding = await getStoredBinding();
        if (!updateBinding.token || !updateBinding.workspace) {
          sendResponse({ success: false, error: 'NOT_BOUND' });
          return;
        }
        try {
          const updated = await updateTarget(message.targetId, message.data);
          sendResponse({ success: true, target: updated });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'DELETE_TARGET':
        // Popup deleting target
        const deleteBinding = await getStoredBinding();
        if (!deleteBinding.token || !deleteBinding.workspace) {
          sendResponse({ success: false, error: 'NOT_BOUND' });
          return;
        }
        try {
          await deleteTarget(message.targetId);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'GET_BINDING_STATUS':
        // Content script checking binding status
        const binding = await getStoredBinding();
        sendResponse({
          bound: !!binding.token,
          workspace: binding.workspace
        });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  
  return true; // Keep channel open for async
});

// Handle content script connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ig-content-script') {
    const tabId = port.sender?.tab?.id;
    if (tabId) {
      contentScriptPorts.set(tabId, port);
      
      port.onDisconnect.addListener(() => {
        contentScriptPorts.delete(tabId);
      });
    }
  }
});

// Tab navigation listener - trigger resolve on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Notify content script on this tab that page changed
    const port = contentScriptPorts.get(tabId);
    if (port) {
      try {
        port.postMessage({ type: 'PAGE_CHANGED', url: tab.url });
      } catch (e) {
        // Port disconnected
      }
    }
  }
});

console.log('[IG Background] Service worker loaded - capability binding mode');

// Debug: Monitor storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    console.log('[IG Storage changed]', changes);
  }
});

// ============================================================================
// STEP AUTHORING VALIDATION API
// ============================================================================

const StepAuthoringAPI = {
  /**
   * Validate a walkthrough step for authoring
   * Returns validation result with warnings and errors
   */
  validateStep(step) {
    const errors = [];
    const warnings = [];
    const scores = {};
    
    // Required fields
    if (!step.id) errors.push('Step ID is required');
    if (!step.title) errors.push('Step title is required');
    if (!step.instructionText) warnings.push('Instruction text helps users understand what to do');
    
    // Selector validation
    if (!step.targetSelectors?.primary?.value) {
      errors.push('Primary selector is required');
    } else {
      const selector = step.targetSelectors.primary;
      scores.primaryStability = this.scoreSelectorStability(selector.value, selector.type);
      
      if (scores.primaryStability < 0.5) {
        warnings.push(`Primary selector stability is low (${scores.primaryStability}) - consider using ID or test-id`);
      }
      
      // Check for fallbacks
      if (!step.targetSelectors.fallbacks?.length) {
        warnings.push('No fallback selectors defined - step may break if primary selector changes');
      } else {
        let fallbackScores = [];
        for (const fb of step.targetSelectors.fallbacks) {
          fallbackScores.push(this.scoreSelectorStability(fb.value, fb.type));
        }
        scores.avgFallbackStability = fallbackScores.reduce((a, b) => a + b, 0) / fallbackScores.length;
      }
    }
    
    // URL scope validation
    if (!step.urlScope?.value) {
      errors.push('URL scope is required');
    } else {
      if (step.urlScope.type === 'any') {
        warnings.push('URL scope "any" matches all pages - may cause unexpected behavior');
      }
      
      if (step.urlScope.type === 'regex') {
        try {
          new RegExp(step.urlScope.value);
        } catch {
          errors.push('URL scope regex is invalid');
        }
      }
    }
    
    // Validation spec
    if (!step.validation?.rule) {
      warnings.push('No validation rule specified - step will auto-advance');
    }
    
    // Iframe check
    if (step.requiresIframeAccess && !step.iframeSelector) {
      warnings.push('Iframe access required but no iframe selector specified');
    }
    
    // Calculate overall stability
    const avgStability = scores.avgFallbackStability 
      ? (scores.primaryStability + scores.avgFallbackStability) / 2
      : scores.primaryStability || 0;
    scores.overallStability = Math.round(avgStability * 100) / 100;
    
    return {
      valid: errors.length === 0,
      canPublish: errors.length === 0 && scores.overallStability >= 0.5,
      errors,
      warnings,
      scores,
      stabilityLabel: this.getStabilityLabel(scores.overallStability)
    };
  },
  
  /**
   * Validate entire walkthrough
   */
  validateWalkthrough(walkthrough) {
    const errors = [];
    const warnings = [];
    const stepResults = [];
    
    if (!walkthrough.id) errors.push('Walkthrough ID is required');
    if (!walkthrough.title) errors.push('Title is required');
    if (!walkthrough.steps?.length) errors.push('At least one step is required');
    
    // Check for duplicate step IDs
    const stepIds = walkthrough.steps?.map(s => s.id) || [];
    const duplicates = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicates.length) {
      errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
    }
    
    // Validate each step
    let totalStability = 0;
    for (const step of walkthrough.steps || []) {
      const result = this.validateStep(step);
      stepResults.push({ stepId: step.id, ...result });
      totalStability += result.scores?.overallStability || 0;
      
      result.errors.forEach(e => errors.push(`Step ${step.id}: ${e}`));
      result.warnings.forEach(w => warnings.push(`Step ${step.id}: ${w}`));
    }
    
    const avgStability = walkthrough.steps?.length 
      ? totalStability / walkthrough.steps.length 
      : 0;
    
    if (avgStability < 0.6) {
      warnings.push(`Average selector stability is low (${avgStability.toFixed(2)}) - walkthrough may be brittle`);
    }
    
    return {
      valid: errors.length === 0,
      canPublish: errors.length === 0 && avgStability >= 0.5,
      errors,
      warnings,
      avgStability: Math.round(avgStability * 100) / 100,
      stepCount: walkthrough.steps?.length || 0,
      stepResults
    };
  },
  
  /**
   * Score selector stability (0-1)
   */
  scoreSelectorStability(selector, type) {
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
  },
  
  /**
   * Get human-readable stability label
   */
  getStabilityLabel(score) {
    if (score >= 0.9) return { level: 'excellent', emoji: '✅', color: '#22c55e' };
    if (score >= 0.7) return { level: 'good', emoji: '👍', color: '#84cc16' };
    if (score >= 0.5) return { level: 'fair', emoji: '⚠️', color: '#eab308' };
    if (score >= 0.3) return { level: 'poor', emoji: '❗', color: '#f97316' };
    return { level: 'fragile', emoji: '🚫', color: '#ef4444' };
  }
};

// ============================================================================
// QA TEST GENERATION API
// ============================================================================

const QATestGenerator = {
  /**
   * Generate test cases for a walkthrough
   */
  generateTests(walkthrough) {
    const tests = [];
    
    for (let i = 0; i < walkthrough.steps.length; i++) {
      const step = walkthrough.steps[i];
      const stepTests = this.generateStepTests(step, i, walkthrough.steps.length);
      tests.push(...stepTests);
    }
    
    // Add walkthrough-level tests
    tests.push(...this.generateWalkthroughTests(walkthrough));
    
    return {
      walkthroughId: walkthrough.id,
      totalSteps: walkthrough.steps.length,
      testCount: tests.length,
      tests: tests,
      automatedScript: this.generatePlaywrightScript(walkthrough, tests)
    };
  },
  
  /**
   * Generate tests for a single step
   */
  generateStepTests(step, index, totalSteps) {
    const tests = [];
    const baseId = `step_${index + 1}`;
    
    // Core functionality tests
    tests.push({
      id: `${baseId}_activation`,
      name: `Step ${index + 1}: Target element found and highlighted`,
      type: 'functional',
      priority: 'P0',
      step: index + 1,
      action: 'Activate step and verify target resolution'
    });
    
    tests.push({
      id: `${baseId}_interaction`,
      name: `Step ${index + 1}: Required action triggers validation`,
      type: 'functional',
      priority: 'P0',
      step: index + 1,
      action: `Perform ${step.requiredAction || 'click'} on target and verify validation request`
    });
    
    // Failure tests
    tests.push({
      id: `${baseId}_wrong_action`,
      name: `Step ${index + 1}: Wrong action shows retry UI`,
      type: 'failure',
      priority: 'P1',
      step: index + 1,
      action: 'Perform incorrect action and verify failure UX shown'
    });
    
    tests.push({
      id: `${baseId}_max_retries`,
      name: `Step ${index + 1}: Max retries exceeded shows options`,
      type: 'failure',
      priority: 'P1',
      step: index + 1,
      action: `Fail validation ${step.onFailure?.maxRetries || 3} times and verify options shown`
    });
    
    // Navigation tests (for non-navigation steps)
    if (step.requiredAction !== 'navigate') {
      tests.push({
        id: `${baseId}_url_escape`,
        name: `Step ${index + 1}: URL change blocked or redirected`,
        type: 'security',
        priority: 'P0',
        step: index + 1,
        action: 'Attempt navigation to different URL and verify enforcement'
      });
      
      tests.push({
        id: `${baseId}_spa_nav`,
        name: `Step ${index + 1}: SPA router navigation intercepted`,
        type: 'security',
        priority: 'P0',
        step: index + 1,
        action: 'Trigger history.pushState and verify blocked or redirected'
      });
    }
    
    // Selector robustness tests
    tests.push({
      id: `${baseId}_selector_fallback`,
      name: `Step ${index + 1}: Fallback selector used if primary fails`,
      type: 'robustness',
      priority: 'P1',
      step: index + 1,
      action: 'Remove primary target and verify fallback resolves'
      });
    
    tests.push({
      id: `${baseId}_dom_mutation`,
      name: `Step ${index + 1}: DOM mutation wait and retry`,
      type: 'robustness',
      priority: 'P1',
      step: index + 1,
      action: 'Start step before element exists, add element, verify step activates'
    });
    
    // Special tests for iframe steps
    if (step.requiresIframeAccess) {
      tests.push({
        id: `${baseId}_iframe_detection`,
        name: `Step ${index + 1}: Iframe context detected`,
        type: 'iframe',
        priority: 'P0',
        step: index + 1,
        action: 'Verify iframe detection and same-origin/cross-origin handling'
      });
    }
    
    return tests;
  },
  
  /**
   * Generate walkthrough-level tests
   */
  generateWalkthroughTests(walkthrough) {
    return [
      {
        id: 'walkthrough_complete_flow',
        name: 'Complete walkthrough from start to finish',
        type: 'e2e',
        priority: 'P0',
        action: 'Complete all steps in sequence and verify success'
      },
      {
        id: 'walkthrough_tab_reload',
        name: 'Tab reload during step - recovery',
        type: 'recovery',
        priority: 'P0',
        action: 'Reload tab mid-step and verify walkthrough recovers'
      },
      {
        id: 'walkthrough_user_abort',
        name: 'User abort walkthrough',
        type: 'ux',
        priority: 'P1',
        action: 'Click abort and verify clean cleanup'
      },
      {
        id: 'walkthrough_timeout',
        name: 'Auto-timeout after inactivity',
        type: 'recovery',
        priority: 'P1',
        action: 'Wait 5+ minutes without action and verify auto-abort'
      },
      {
        id: 'walkthrough_keyboard_block',
        name: 'Keyboard shortcuts blocked',
        type: 'security',
        priority: 'P0',
        action: 'Press Ctrl+T, Ctrl+S, etc. and verify blocked'
      },
      {
        id: 'walkthrough_click_outside',
        name: 'Click outside target blocked',
        type: 'security',
        priority: 'P0',
        action: 'Click non-target element and verify blocked with feedback'
      }
    ];
  },
  
  /**
   * Generate Playwright test script
   */
  generatePlaywrightScript(walkthrough, tests) {
    const stepSelectors = walkthrough.steps.map(s => s.targetSelectors?.primary?.value || s.targetSelector);
    
    return `
// Auto-generated Playwright tests for: ${walkthrough.title}
const { test, expect } = require('@playwright/test');

const WALKTHROUGH_CONFIG = {
  id: '${walkthrough.id}',
  totalSteps: ${walkthrough.steps.length},
  selectors: ${JSON.stringify(stepSelectors, null, 2)}
};

test.describe('${walkthrough.title}', () => {
  
  test('complete walkthrough flow', async ({ page, context }) => {
    // Start walkthrough
    await page.evaluate((config) => {
      chrome.runtime.sendMessage({
        type: 'WALKTHROUGH_START',
        walkthrough: config
      });
    }, WALKTHROUGH_CONFIG);
    
    // Complete each step
${walkthrough.steps.map((step, i) => `    // Step ${i + 1}: ${step.title}
    await page.waitForSelector('.ig-walkthrough-hole');
    await page.click('${step.targetSelectors?.primary?.value || step.targetSelector}');
    ${step.requiredAction === 'input' ? `await page.fill('${step.targetSelectors?.primary?.value || step.targetSelector}', 'test value');` : ''}
    `).join('\n')}
    
    // Verify completion
    await expect(page.locator('.ig-walkthrough-overlay')).not.toBeVisible();
  });
  
  ${tests.filter(t => t.type === 'failure').map(t => `
  test('${t.name}', async ({ page }) => {
    // ${t.action}
  });`).join('\n')}
  
});
`;
  }
};

// Add message handlers for authoring API and telemetry
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_STEP') {
    const result = StepAuthoringAPI.validateStep(message.step);
    sendResponse(result);
    return true;
  }
  
  if (message.type === 'VALIDATE_WALKTHROUGH') {
    const result = StepAuthoringAPI.validateWalkthrough(message.walkthrough);
    sendResponse(result);
    return true;
  }
  
  if (message.type === 'GENERATE_QA_TESTS') {
    const result = QATestGenerator.generateTests(message.walkthrough);
    sendResponse(result);
    return true;
  }
  
  if (message.type === 'GET_TELEMETRY') {
    // Get telemetry from state machine
    const telemetry = walkthroughSM.getTelemetry(message.limit);
    sendResponse({ events: telemetry });
    return true;
  }
  
  if (message.type === 'GET_TELEMETRY_STATS') {
    const stats = walkthroughSM.getTelemetryStats();
    sendResponse(stats);
    return true;
  }
  
  if (message.type === 'CLEAR_TELEMETRY') {
    walkthroughSM.clearTelemetry();
    sendResponse({ cleared: true });
    return true;
  }
});
