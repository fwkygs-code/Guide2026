// Interguide Extension Popup
// Handles token binding UI, target creation, and walkthrough progress display

console.log('[Popup] Popup script loaded');

const API_BASE = 'https://api.interguide.app/api';
const STORAGE_KEY_TOKEN = 'ig_binding_token';
const STORAGE_KEY_WORKSPACE = 'ig_workspace';
const STORAGE_KEY_EXTENSION_ID = 'ig_extension_id';

// DOM Elements
const unboundSection = document.getElementById('unbound-section');
const boundSection = document.getElementById('bound-section');
const revokedSection = document.getElementById('revoked-section');
const statusBadge = document.getElementById('status-badge');
const tokenInput = document.getElementById('token-input');
const tokenInputRevoked = document.getElementById('token-input-revoked');
const bindBtn = document.getElementById('bind-btn');
const rebindBtn = document.getElementById('rebind-btn');
const unbindBtn = document.getElementById('unbind-btn');
const bindSpinner = document.getElementById('bind-spinner');
const bindText = document.getElementById('bind-text');
const workspaceNameEl = document.getElementById('workspace-name');
const extensionIdShortEl = document.getElementById('extension-id-short');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const startGuideBtn = document.getElementById('start-guide-btn');
const userWalkthroughList = document.getElementById('user-walkthrough-list');
const userWalkthroughContainer = document.getElementById('user-walkthrough-container');

// New guide selection elements
const guideSelection = document.getElementById('guide-selection');
const guideList = document.getElementById('guide-list');
const guideContainer = document.getElementById('guide-container');
const stepsView = document.getElementById('steps-view');
const currentGuideName = document.getElementById('current-guide-name');
const stepsContainer = document.getElementById('steps-container');
const backToGuides = document.getElementById('back-to-guides');
const startSelectedGuide = document.getElementById('start-selected-guide');
const createNewGuideBtn = document.getElementById('create-new-guide-btn');

// Bound state elements
const startGuideBtnBound = document.getElementById('start-guide-btn-bound');
const guideSelectionBound = document.getElementById('guide-selection-bound');
const guideListBound = document.getElementById('guide-list-bound');
const guideContainerBound = document.getElementById('guide-container-bound');
const stepsViewBound = document.getElementById('steps-view-bound');
const currentGuideNameBound = document.getElementById('current-guide-name-bound');
const stepsContainerBound = document.getElementById('steps-container-bound');
const backToGuidesBound = document.getElementById('back-to-guides-bound');
const startSelectedGuideBound = document.getElementById('start-selected-guide-bound');
const createNewGuideBtnBound = document.getElementById('create-new-guide-btn-bound');

// Mode toggle elements
const toggleAdminBtn = document.getElementById('toggle-admin-btn');
const toggleUserBtn = document.getElementById('toggle-user-btn');
const adminPanel = document.getElementById('admin-panel');
const showUserModeBtn = document.getElementById('show-user-mode');
const showAdminModeBtn = document.getElementById('show-admin-mode');
const boundUserContent = document.getElementById('bound-user-content');
const boundAdminContent = document.getElementById('bound-admin-content');

// State for selected walkthrough
let selectedWalkthrough = null;

// Target Creation Elements
const createTargetBtn = document.getElementById('create-target-btn');
const targetForm = document.getElementById('target-form');
const pickedElementInfo = document.getElementById('picked-element-info');
const walkthroughSelect = document.getElementById('walkthrough-select');
const stepSelect = document.getElementById('step-select');
const urlScopeSelect = document.getElementById('url-scope');
const urlScopeHelp = document.getElementById('url-scope-help');
const selectorInput = document.getElementById('selector-input');
const selectorConfidence = document.getElementById('selector-confidence');
const saveTargetBtn = document.getElementById('save-target-btn');
const cancelTargetBtn = document.getElementById('cancel-target-btn');
const saveSpinner = document.getElementById('save-spinner');
const saveText = document.getElementById('save-text');

// Target Management Elements
const manageTargetsBtn = document.getElementById('manage-targets-btn');
const targetsList = document.getElementById('targets-list');
const targetsContainer = document.getElementById('targets-container');

// Walkthrough Progress Elements (NEW)
let walkthroughProgressSection = null;
let walkthroughProgressBar = null;
let walkthroughStepInfo = null;
let walkthroughStatusText = null;

// Admin mode tracking
let isAdminMode = false;
const STORAGE_KEY_ADMIN_MODE = 'ig_walkthrough_admin_mode';

// Track picked element data
let pickedData = null;
let adminWalkthroughs = [];
let existingTargets = [];
let isEditingTarget = false;
let editingTargetId = null;

// ============================================================================
// WALKTHROUGH PROGRESS UI (NEW)
// ============================================================================

/**
 * Create walkthrough progress UI elements
 * This UI displays during active walkthrough - shows progress, not controls
 * Exit button is ADMIN ONLY - normal users cannot exit enforced walkthroughs
 */
function createWalkthroughProgressUI() {
  // Check if already exists
  if (document.getElementById('walkthrough-progress-section')) return;
  
  const section = document.createElement('div');
  section.id = 'walkthrough-progress-section';
  section.className = 'walkthrough-progress hidden';
  section.style.cssText = `
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    color: white;
  `;
  
  // Exit button is only shown in admin mode
  const exitButtonHTML = isAdminMode ? `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
      <div style="font-size: 11px; opacity: 0.8; margin-bottom: 8px;">🔧 Admin: Exit available</div>
      <button id="walkthrough-exit-btn" style="
        width: 100%;
        padding: 8px;
        background: rgba(239, 68, 68, 0.8);
        border: 1px solid rgba(239, 68, 68, 1);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      ">Force Exit Walkthrough (Admin)</button>
    </div>
  ` : `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
      <div style="font-size: 11px; opacity: 0.8;">⚠️ Complete all steps to finish</div>
    </div>
  `;
  
  section.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">🎯</div>
      <div>
        <div style="font-weight: 600; font-size: 14px;">Walkthrough Active</div>
        <div id="walkthrough-status-text" style="font-size: 12px; opacity: 0.9;">Follow the on-screen instructions</div>
      </div>
    </div>
    
    <div style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span id="walkthrough-step-info">Step 1 of 5</span>
        <span id="walkthrough-percentage">0%</span>
      </div>
      <div style="background: rgba(255,255,255,0.2); height: 6px; border-radius: 3px; overflow: hidden;">
        <div id="walkthrough-progress-bar" style="background: white; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>
    </div>
    
    <div id="walkthrough-current-step" style="font-size: 13px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; margin-top: 10px;">
      Loading step...
    </div>
    
    ${exitButtonHTML}
  `;
  
  // Insert after status badge
  const container = document.querySelector('.container');
  if (container) {
    container.insertBefore(section, container.firstChild);
  }
  
  // Store references
  walkthroughProgressSection = section;
  walkthroughProgressBar = section.querySelector('#walkthrough-progress-bar');
  walkthroughStepInfo = section.querySelector('#walkthrough-step-info');
  walkthroughStatusText = section.querySelector('#walkthrough-status-text');
  
  // Add exit handler ONLY if admin mode
  if (isAdminMode) {
    const exitBtn = section.querySelector('#walkthrough-exit-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', async () => {
        if (confirm('ADMIN: Are you sure you want to force exit this walkthrough?')) {
          await chrome.runtime.sendMessage({ type: 'WALKTHROUGH_FORCE_ABORT', reason: 'ADMIN_EXIT_POPUP' });
          hideWalkthroughProgress();
          loadWalkthroughProgress();
        }
      });
    }
  }
}

/**
 * Update walkthrough progress display
 */
function updateWalkthroughProgressUI(progress, currentStep) {
  if (!walkthroughProgressSection) {
    createWalkthroughProgressUI();
  }
  
  walkthroughProgressSection.classList.remove('hidden');
  
  // Update progress bar
  if (walkthroughProgressBar) {
    walkthroughProgressBar.style.width = `${progress.percentage}%`;
  }
  
  // Update step info
  if (walkthroughStepInfo) {
    walkthroughStepInfo.textContent = `Step ${progress.current} of ${progress.total}`;
  }
  
  // Update percentage
  const percentageEl = walkthroughProgressSection?.querySelector('#walkthrough-percentage');
  if (percentageEl) {
    percentageEl.textContent = `${progress.percentage}%`;
  }
  
  // Update current step display
  const stepEl = walkthroughProgressSection?.querySelector('#walkthrough-current-step');
  if (stepEl && currentStep) {
    stepEl.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 4px;">${currentStep.title || 'Current Step'}</div>
      ${currentStep.description ? `<div style="opacity: 0.9; font-size: 12px;">${currentStep.description}</div>` : ''}
    `;
  }
  
  // Update status text based on step state
  if (walkthroughStatusText) {
    const statusMap = {
      'active': 'Follow the on-screen instructions',
      'validating': 'Validating your action...',
      'completed': 'Step completed! Moving to next...',
      'failed': 'Please try again'
    };
    walkthroughStatusText.textContent = statusMap[progress.stepState] || 'Follow the on-screen instructions';
  }
}

function hideWalkthroughProgress() {
  if (walkthroughProgressSection) {
    walkthroughProgressSection.classList.add('hidden');
  }
}

/**
 * Load and display walkthrough progress
 * Called on popup open and periodically
 */
async function loadWalkthroughProgress() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGH_PROGRESS' });
    
    if (response?.isActive) {
      // Show walkthrough progress UI
      updateWalkthroughProgressUI(response.progress, response.currentStep);
      
      // Disable target creation during walkthrough
      if (createTargetBtn) {
        createTargetBtn.disabled = true;
        createTargetBtn.title = 'Target creation disabled during walkthrough';
      }
    } else {
      // Hide walkthrough UI
      hideWalkthroughProgress();
      
      // Re-enable target creation
      if (createTargetBtn) {
        createTargetBtn.disabled = false;
        createTargetBtn.title = '';
      }
    }
  } catch (error) {
    console.error('[IG Popup] Failed to load walkthrough progress:', error);
  }
}

// ============================================================================
// EXISTING FUNCTIONS (Preserved)
// ============================================================================

// Load admin walkthroughs for target creation
async function loadAdminWalkthroughs() {
  try {
    // Check if we have a token first
    const data = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_WORKSPACE]);
    if (!data[STORAGE_KEY_TOKEN]) {
      console.warn('[IG Popup] No token, skipping walkthrough load');
      showError('Extension not bound. Please enter a binding token first.');
      showState('unbound');
      return;
    }
    if (!data[STORAGE_KEY_WORKSPACE]) {
      console.warn('[IG Popup] No workspace, skipping walkthrough load');
      showError('Workspace binding incomplete. Please rebind the extension.');
      showState('unbound');
      return;
    }
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGHS' });
    console.log('[IG Popup] GET_WALKTHROUGHS response:', response);
    
    // Handle structured errors from background
    if (response?.error) {
      console.error('[IG Popup] Walkthrough load error:', response.error);
      switch (response.error) {
        case 'NO_TOKEN':
        case 'NOT_BOUND':
          showError('Extension not bound to workspace. Please enter a binding token.');
          showState('unbound');
          return;
        case 'UNAUTHORIZED':
          showError('Session expired. Please rebind the extension.');
          showState('unbound');
          return;
        case 'FORBIDDEN':
          showError('Access denied. Token may be revoked.');
          showState('revoked');
          return;
        case 'TOKEN_REVOKED':
          showError('Token revoked. Please generate a new token.');
          showState('revoked');
          return;
        case 'NETWORK_ERROR':
          showError('Network error. Please check your connection.');
          return;
        default:
          showError('Failed to load walkthroughs: ' + response.error);
          return;
      }
    }
    
    // If response has no walkthroughs and no explicit error, binding is likely invalid
    if (!response?.walkthroughs) {
      showState('unbound');
      return;
    }
    
    // If no walkthroughs returned but binding might be valid, double-check
    if (response.walkthroughs.length === 0) {
      const bindingCheck = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_WORKSPACE]);
      if (!bindingCheck[STORAGE_KEY_TOKEN] || !bindingCheck[STORAGE_KEY_WORKSPACE]) {
        console.warn('[IG Popup] Binding invalid - not rendering dropdown');
        showState('unbound');
        showError('Extension not bound. Please enter a binding token.');
        return;
      }
      // Valid binding but no walkthroughs - show empty state
      adminWalkthroughs = [];
      walkthroughSelect.innerHTML = '<option value="">No walkthroughs available</option>';
      return;
    }
    
    // Valid response with walkthroughs - ensure binding is valid before rendering
    const bindingCheck = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_WORKSPACE]);
    if (!bindingCheck[STORAGE_KEY_TOKEN] || !bindingCheck[STORAGE_KEY_WORKSPACE]) {
      console.warn('[IG Popup] Binding invalid despite walkthroughs - not rendering dropdown');
      showState('unbound');
      showError('Extension not bound. Please enter a binding token.');
      return;
    }
    
    // Binding valid - safe to render dropdown
    adminWalkthroughs = response.walkthroughs;
    
    // Populate walkthrough dropdown
    walkthroughSelect.innerHTML = '<option value="">Select walkthrough...</option>';
    adminWalkthroughs.forEach(wt => {
      const option = document.createElement('option');
      // Support both 'id' (new) and 'walkthrough_id' (old) field names
      option.value = wt.id || wt.walkthrough_id;
      option.textContent = wt.title;
      walkthroughSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load walkthroughs:', error);
    showError('Failed to load walkthroughs: ' + error.message);
  }
}

// Start element picker on current tab
async function startElementPicker() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[IG Popup] Starting picker on tab:', tab?.id, 'URL:', tab?.url);
  
  if (!tab?.id) {
    showError('[NO_TAB] Cannot access current tab');
    return;
  }
  
  // Check for restricted URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
    console.error('[IG Popup] Cannot inject on restricted URL:', tab.url);
    showError('[RESTRICTED_URL] Cannot start picker on browser internal pages. Navigate to a regular website.');
    return;
  }
  
  // Try to ping content script - must be top frame
  try {
    const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    console.log('[IG Popup] PING response:', pingResponse);
    
    if (!pingResponse?.ready) {
      showError('[NOT_READY] Content script not ready. Reload the page.');
      return;
    }
    
    if (!pingResponse.isTopFrame) {
      showError('[NOT_TOP_FRAME] PING responded from iframe. Reload the page.');
      return;
    }
    
    // Content script is ready in top frame, send START_PICKER
    await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKER' });
    console.log('[IG Popup] START_PICKER sent successfully');
    window.close();
  } catch (error) {
    console.error('[IG Popup] Content script not responding:', error);
    showError('[NO_CONTENT_SCRIPT] Content script not loaded. Reload the page or check extension permissions.');
  }
}

// Handle element picked message from content script
function handleElementPicked(data) {
  pickedData = data;
  
  // Show the target form
  createTargetBtn.classList.add('hidden');
  targetForm.classList.remove('hidden');
  
  // Populate form with picked data
  pickedElementInfo.textContent = `<${data.elementTag}> ${data.elementText}`;
  selectorInput.value = data.selector;
  
  // Show confidence warning
  selectorConfidence.textContent = data.confidenceLabel;
  selectorConfidence.className = 'confidence-warning confidence-' + data.confidence;
  
  // Set default URL scope to 'domain' (entire website)
  urlScopeSelect.value = 'domain';
  updateUrlScopeHelp('domain');
  
  // Load walkthroughs
  loadAdminWalkthroughs();
}

// Handle walkthrough selection change
function handleWalkthroughChange() {
  const walkthroughId = walkthroughSelect.value;
  stepSelect.innerHTML = '<option value="">Select step...</option>';
  stepSelect.disabled = !walkthroughId;
  
  if (walkthroughId) {
    // Support both 'id' (new) and 'walkthrough_id' (old) field names
    const walkthrough = adminWalkthroughs.find(wt => (wt.id || wt.walkthrough_id) === walkthroughId);
    console.log('[IG Popup] Selected walkthrough:', walkthrough);
    if (walkthrough?.steps) {
      walkthrough.steps.forEach((step, idx) => {
        const option = document.createElement('option');
        // Backend stores step_id, fallback to id or index
        option.value = step.step_id || step.id || `step-${idx}`;
        option.textContent = step.title || 'Untitled Step';
        stepSelect.appendChild(option);
      });
    }
  }
}

// Handle URL scope change
function handleUrlScopeChange() {
  const scope = urlScopeSelect.value;
  updateUrlScopeHelp(scope);
}

function updateUrlScopeHelp(scope) {
  const helpTexts = {
    'page': 'Target will only match this exact page URL',
    'domain': 'Target will match any page on this website',
    'global': 'Target will match any website (use sparingly)'
  };
  urlScopeHelp.textContent = helpTexts[scope] || '';
}

// Cancel target creation
function cancelTargetCreation() {
  pickedData = null;
  targetForm.classList.add('hidden');
  createTargetBtn.classList.remove('hidden');
  walkthroughSelect.value = '';
  stepSelect.value = '';
  stepSelect.disabled = true;
}

// Save the new target
async function saveTarget() {
  if (!pickedData) return;
  
  const walkthroughId = walkthroughSelect.value;
  const stepId = stepSelect.value;
  const urlScope = urlScopeSelect.value;
  
  if (!walkthroughId || !stepId) {
    showError('Please select a walkthrough and step');
    return;
  }
  
  saveTargetBtn.disabled = true;
  saveSpinner.classList.remove('hidden');
  saveText.textContent = 'Saving...';
  
  try {
    // Verify binding before saving
    const bindingCheck = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_WORKSPACE]);
    if (!bindingCheck[STORAGE_KEY_TOKEN] || !bindingCheck[STORAGE_KEY_WORKSPACE]) {
      showError('Extension not bound. Please enter a binding token first.');
      showState('unbound');
      return;
    }
    
    // Build URL rule from picked URL based on scope
    const fullUrl = pickedData.url;
    let urlType, urlValue;
    
    if (urlScope === 'page') {
      // Exact URL
      urlType = 'exact';
      urlValue = fullUrl.split('?')[0].split('#')[0]; // Remove query/hash
    } else if (urlScope === 'domain') {
      // Domain prefix
      urlType = 'prefix';
      try {
        const urlObj = new URL(fullUrl);
        urlValue = urlObj.origin + '/';
      } catch (e) {
        urlValue = fullUrl.split('/').slice(0, 3).join('/') + '/';
      }
    } else if (urlScope === 'global') {
      // Global - match any http/https URL
      urlType = 'prefix';
      urlValue = 'http';
    }
    
    const targetData = {
      walkthrough_id: walkthroughId,
      step_id: stepId,
      url_rule: {
        type: urlType,
        value: urlValue
      },
      selector: pickedData.selector
    };
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_TARGET',
      data: targetData
    });
    
    if (response?.success) {
      showSuccess('Target created successfully!');
      cancelTargetCreation();
    } else if (response?.error) {
      // Handle structured error
      switch (response.error) {
        case 'NOT_BOUND':
          showError('Extension not bound. Please enter a binding token.');
          showState('unbound');
          break;
        default:
          showError(response.error || 'Failed to create target');
      }
    } else {
      showError('Failed to create target');
    }
  } catch (error) {
    console.error('Save target error:', error);
    showError('Failed to save target: ' + error.message);
  } finally {
    saveTargetBtn.disabled = false;
    saveSpinner.classList.add('hidden');
    saveText.textContent = 'Save Target';
  }
}

// Listen for messages from content script (picker events)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_PICKED') {
    handleElementPicked(message.data);
    sendResponse({ received: true });
  } else if (message.type === 'PICKER_CANCELLED') {
    cancelTargetCreation();
    sendResponse({ received: true });
  }
  return true;
});

// Get extension ID (chrome.runtime.id)
const getExtensionId = () => chrome.runtime.id;

// Show appropriate section based on binding status
function showState(state) {
  // Hide all sections first
  unboundSection.classList.add('hidden');
  boundSection.classList.add('hidden');
  revokedSection.classList.add('hidden');
  
  // Reset mode toggles to default state
  if (toggleAdminBtn) toggleAdminBtn.classList.remove('hidden');
  if (toggleUserBtn) toggleUserBtn.classList.add('hidden');
  if (adminPanel) adminPanel.classList.add('hidden');
  
  // Show appropriate section
  switch (state) {
    case 'unbound':
      unboundSection.classList.remove('hidden');
      // User mode is shown by default, admin panel hidden
      statusBadge.textContent = 'User Mode';
      statusBadge.className = 'status-badge status-unbound';
      break;
      
    case 'bound':
      boundSection.classList.remove('hidden');
      statusBadge.textContent = 'User Mode';
      statusBadge.className = 'status-badge status-bound';
      
      // Show user content by default
      if (boundUserContent) boundUserContent.classList.remove('hidden');
      if (boundAdminContent) boundAdminContent.classList.add('hidden');
      
      // Set toggle button states
      if (showUserModeBtn) {
        showUserModeBtn.style.background = '#22c55e';
        showUserModeBtn.style.color = 'white';
        showUserModeBtn.style.borderColor = '#22c55e';
      }
      if (showAdminModeBtn) {
        showAdminModeBtn.style.background = '#f3f4f4f6';
        showAdminModeBtn.style.color = '#6b7280';
        showAdminModeBtn.style.borderColor = '#d1d5db';
      }
      break;
      
    case 'revoked':
      revokedSection.classList.remove('hidden');
      statusBadge.textContent = 'Token Revoked';
      statusBadge.className = 'status-badge status-revoked';
      break;
  }
}

// Show error message
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

// Show success message
function showSuccess(msg) {
  successMessage.textContent = msg;
  successMessage.classList.remove('hidden');
}

// Bind extension to workspace
async function bindExtension(token) {
  if (!token || token.trim().length === 0) {
    showError('Please enter a binding token');
    return false;
  }
  
  bindBtn.disabled = true;
  bindSpinner.classList.remove('hidden');
  bindText.textContent = 'Binding...';
  
  try {
    const extensionId = (chrome?.runtime?.id || '').trim();
    if (!extensionId) {
      showError('Extension ID unavailable. Please reload the extension and try again.');
      return false;
    }

    // Clear any stale binding info before attempting a fresh bind
    await chrome.storage.local.remove([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_WORKSPACE,
      STORAGE_KEY_EXTENSION_ID
    ]);
    
    const response = await fetch(`${API_BASE}/extension/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Binding': token.trim(),
        'X-Extension-Id': extensionId
      },
      body: JSON.stringify({ extensionId })
    });
    
    if (response.status === 401) {
      showError('Invalid token. Please check your token and try again.');
      return false;
    }
    
    if (response.status === 403) {
      showError('Token revoked or already bound to another extension. Generate a new token in workspace settings.');
      return false;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in chrome.storage.local
    await chrome.storage.local.set({
      [STORAGE_KEY_TOKEN]: token.trim(),
      [STORAGE_KEY_WORKSPACE]: {
        id: data.workspaceId,
        name: data.workspaceName,
        boundAt: data.boundAt
      },
      [STORAGE_KEY_EXTENSION_ID]: extensionId
    });
    
    // Update UI
    workspaceNameEl.textContent = data.workspaceName;
    extensionIdShortEl.textContent = extensionId.substring(0, 8) + '...';
    
    showSuccess(`Successfully bound to "${data.workspaceName}"`);
    showState('bound');
    
    // Auto-enable admin mode since only admins can connect tokens
    await chrome.storage.local.set({ [STORAGE_KEY_ADMIN_MODE]: true });
    isAdminMode = true;
    
    // Notify background script
    chrome.runtime.sendMessage({ type: 'TOKEN_BOUND', token: token.trim() });
    
    return true;
    
  } catch (error) {
    console.error('Bind error:', error);
    showError('Failed to bind. Please check your connection and try again.');
    return false;
  } finally {
    bindBtn.disabled = false;
    bindSpinner.classList.add('hidden');
    bindText.textContent = 'Bind to Workspace';
  }
}

// Unbind extension (clear local storage)
async function unbindExtension() {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_WORKSPACE,
      STORAGE_KEY_EXTENSION_ID
    ]);
    
    showState('unbound');
    showSuccess('Extension disconnected');
    
    // Notify background script
    chrome.runtime.sendMessage({ type: 'TOKEN_UNBOUND' });
    
  } catch (error) {
    console.error('Unbind error:', error);
    showError('Failed to disconnect');
  }
}

// Load current state from storage
async function loadState() {
  try {
    // ALWAYS re-read from storage - do not trust in-memory state
    const data = await chrome.storage.local.get([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_WORKSPACE,
      STORAGE_KEY_EXTENSION_ID
    ]);
    
    console.log('[IG Popup] loadState storage snapshot:', data);
    
    const hasToken = !!data[STORAGE_KEY_TOKEN];
    const hasWorkspace = !!data[STORAGE_KEY_WORKSPACE];
    
    if (hasToken && hasWorkspace) {
      // Fully bound - update UI
      workspaceNameEl.textContent = data[STORAGE_KEY_WORKSPACE].name;
      extensionIdShortEl.textContent = (data[STORAGE_KEY_EXTENSION_ID] || getExtensionId()).substring(0, 8) + '...';
      showState('bound');
      
      // Auto-enable admin mode for existing bound extensions
      // (since only admins can bind tokens)
      await chrome.storage.local.set({ [STORAGE_KEY_ADMIN_MODE]: true });
      isAdminMode = true;
    } else if (hasToken && !hasWorkspace) {
      // Partial binding - corrupted state
      console.warn('[IG Popup] Partial binding detected - token exists but no workspace');
      showState('unbound');
      showError('Binding incomplete. Please rebind the extension.');
    } else {
      // No binding
      showState('unbound');
    }
  } catch (error) {
    console.error('Load state error:', error);
    showState('unbound');
  }
}

// Event Listeners
bindBtn.addEventListener('click', () => bindExtension(tokenInput.value));
rebindBtn.addEventListener('click', () => bindExtension(tokenInputRevoked.value));
unbindBtn.addEventListener('click', unbindExtension);

// User Mode: Start Guide
if (startGuideBtn) {
  console.log('[Popup] Start guide button found, adding listener');
  startGuideBtn.addEventListener('click', startAvailableGuide);
}
if (startGuideBtnBound) {
  console.log('[Popup] Start guide button (bound) found, adding listener');
  startGuideBtnBound.addEventListener('click', startAvailableGuide);
}

// Back to guides buttons
if (backToGuides) {
  backToGuides.addEventListener('click', () => {
    if (stepsView) stepsView.classList.add('hidden');
    if (guideList) guideList.classList.remove('hidden');
  });
}
if (backToGuidesBound) {
  backToGuidesBound.addEventListener('click', () => {
    if (stepsViewBound) stepsViewBound.classList.add('hidden');
    if (guideListBound) guideListBound.classList.remove('hidden');
  });
}

// Start selected guide buttons
if (startSelectedGuide) {
  startSelectedGuide.addEventListener('click', () => {
    if (selectedWalkthrough) {
      startUserWalkthrough(selectedWalkthrough.walkthroughId);
    }
  });
}
if (startSelectedGuideBound) {
  startSelectedGuideBound.addEventListener('click', () => {
    if (selectedWalkthrough) {
      startUserWalkthrough(selectedWalkthrough.walkthroughId);
    }
  });
}

// Create new guide buttons (placeholder for now)
if (createNewGuideBtn) {
  createNewGuideBtn.addEventListener('click', () => {
    showError('Create new guide feature coming soon!');
  });
}
if (createNewGuideBtnBound) {
  createNewGuideBtnBound.addEventListener('click', () => {
    showError('Create new guide feature coming soon!');
  });
}

// Mode toggle buttons
if (toggleAdminBtn) {
  toggleAdminBtn.addEventListener('click', () => {
    adminPanel.classList.remove('hidden');
    toggleAdminBtn.classList.add('hidden');
    toggleUserBtn.classList.remove('hidden');
    
    // Show Create New Guide buttons in admin mode
    if (createNewGuideBtn) {
      createNewGuideBtn.classList.remove('hidden');
    }
    if (createNewGuideBtnBound) {
      createNewGuideBtnBound.classList.remove('hidden');
    }
  });
}

if (toggleUserBtn) {
  toggleUserBtn.addEventListener('click', () => {
    adminPanel.classList.add('hidden');
    toggleAdminBtn.classList.remove('hidden');
    toggleUserBtn.classList.add('hidden');
    
    // Hide Create New Guide buttons when switching to user mode
    if (createNewGuideBtn) {
      createNewGuideBtn.classList.add('hidden');
    }
    if (createNewGuideBtnBound) {
      createNewGuideBtnBound.classList.add('hidden');
    }
  });
}

// Bound state mode toggles
if (showUserModeBtn) {
  showUserModeBtn.addEventListener('click', () => {
    boundUserContent.classList.remove('hidden');
    boundAdminContent.classList.add('hidden');
    showUserModeBtn.style.background = '#22c55e';
    showUserModeBtn.style.color = 'white';
    showUserModeBtn.style.borderColor = '#22c55e';
    if (showAdminModeBtn) {
      showAdminModeBtn.style.background = '#f3f4f6';
      showAdminModeBtn.style.color = '#6b7280';
      showAdminModeBtn.style.borderColor = '#d1d5db';
    }
    
    // Hide Create New Guide buttons in user mode
    if (createNewGuideBtnBound) {
      createNewGuideBtnBound.classList.add('hidden');
    }
  });
}

if (showAdminModeBtn) {
  showAdminModeBtn.addEventListener('click', () => {
    boundUserContent.classList.add('hidden');
    boundAdminContent.classList.remove('hidden');
    showAdminModeBtn.style.background = '#4f46e5';
    showAdminModeBtn.style.color = 'white';
    showAdminModeBtn.style.borderColor = '#4f46e5';
    showUserModeBtn.style.background = '#f3f4f6';
    showUserModeBtn.style.color = '#6b7280';
    showUserModeBtn.style.borderColor = '#d1d5db';
    
    // Show Create New Guide buttons in admin mode
    if (createNewGuideBtnBound) {
      createNewGuideBtnBound.classList.remove('hidden');
    }
  });
}

// Target Creation Event Listeners
createTargetBtn.addEventListener('click', startElementPicker);
walkthroughSelect.addEventListener('change', handleWalkthroughChange);
urlScopeSelect.addEventListener('change', handleUrlScopeChange);
saveTargetBtn.addEventListener('click', saveTarget);
cancelTargetBtn.addEventListener('click', cancelTargetCreation);

// Target Management Event Listeners
manageTargetsBtn.addEventListener('click', toggleTargetsList);

// Target Management Functions
async function toggleTargetsList() {
  const isVisible = !targetsList.classList.contains('hidden');
  if (isVisible) {
    targetsList.classList.add('hidden');
    manageTargetsBtn.textContent = '📋 Manage Existing Targets';
  } else {
    targetsList.classList.remove('hidden');
    manageTargetsBtn.textContent = '📋 Hide Targets';
    await loadTargets();
  }
}

async function loadTargets() {
  try {
    targetsContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">Loading...</p>';
    const response = await chrome.runtime.sendMessage({ type: 'GET_TARGETS' });
    
    if (response?.error) {
      targetsContainer.innerHTML = `<p style="color: #dc2626;">Error: ${response.error}</p>`;
      return;
    }
    
    existingTargets = response?.targets || [];
    
    if (existingTargets.length === 0) {
      targetsContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">No targets created yet.</p>';
      return;
    }
    
    // Group targets by walkthrough
    const targetsByWalkthrough = {};
    existingTargets.forEach(target => {
      const wt = adminWalkthroughs.find(w => w.id === target.walkthrough_id);
      const wtTitle = wt?.title || target.walkthrough_id;
      if (!targetsByWalkthrough[wtTitle]) {
        targetsByWalkthrough[wtTitle] = [];
      }
      targetsByWalkthrough[wtTitle].push(target);
    });
    
    // Render targets
    let html = '';
    Object.entries(targetsByWalkthrough).forEach(([wtTitle, targets]) => {
      html += `<div style="margin-bottom: 12px; border-left: 3px solid #4f46e5; padding-left: 8px;">`;
      html += `<div style="font-weight: 600; color: #4f46e5; margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">${escapeHtml(wtTitle)}</div>`;
      
      targets.forEach(target => {
        const step = adminWalkthroughs
          .find(w => w.id === target.walkthrough_id)?.steps
          ?.find(s => (s.step_id || s.id) === target.step_id);
        const stepTitle = step?.title || target.step_id?.substring(0, 20) || 'Step';
        const urlPreview = target.url_rule?.value?.substring(0, 30) + '...' || 'Unknown';
        
        html += `
          <div style="padding: 8px; background: #f9fafb; border-radius: 4px; margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(stepTitle)}
                </div>
                <div style="font-size: 10px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(urlPreview)}
                </div>
                <div style="font-size: 10px; color: #9ca3af; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(target.selector || 'No selector')}
                </div>
              </div>
              <div style="display: flex; gap: 4px; margin-left: 8px;">
                <button class="edit-target-btn" data-target-id="${target.id}" style="padding: 4px 8px; background: #e0e7ff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; color: #4f46e5;">Edit</button>
                <button class="delete-target-btn" data-target-id="${target.id}" style="padding: 4px 8px; background: #fee2e2; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; color: #dc2626;">×</button>
              </div>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    });
    
    targetsContainer.innerHTML = html;
    
    // Add event listeners to edit/delete buttons
    targetsContainer.querySelectorAll('.edit-target-btn').forEach(btn => {
      btn.addEventListener('click', () => editTarget(btn.dataset.targetId));
    });
    targetsContainer.querySelectorAll('.delete-target-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteTarget(btn.dataset.targetId));
    });
    
  } catch (error) {
    console.error('Load targets error:', error);
    targetsContainer.innerHTML = `<p style="color: #dc2626;">Failed to load targets</p>`;
  }
}

async function editTarget(targetId) {
  const target = existingTargets.find(t => t.id === targetId);
  if (!target) return;
  
  // Switch to edit mode
  isEditingTarget = true;
  editingTargetId = targetId;
  
  // Populate form with target data
  pickedData = {
    selector: target.selector,
    url: target.url_rule?.value || ''
  };
  
  // Show the target form
  createTargetBtn.classList.add('hidden');
  targetForm.classList.remove('hidden');
  
  // Populate form fields
  pickedElementInfo.textContent = `Editing: ${target.selector || 'Unknown element'}`;
  selectorInput.value = target.selector || '';
  
  // Set URL scope based on url_rule
  if (target.url_rule?.type === 'exact') {
    urlScopeSelect.value = 'page';
  } else if (target.url_rule?.type === 'prefix' && target.url_rule?.value === 'http') {
    urlScopeSelect.value = 'global';
  } else {
    urlScopeSelect.value = 'domain';
  }
  updateUrlScopeHelp(urlScopeSelect.value);
  
  // Load walkthroughs if not loaded
  if (adminWalkthroughs.length === 0) {
    await loadAdminWalkthroughs();
  }
  
  // Set walkthrough and step
  walkthroughSelect.value = target.walkthrough_id;
  await handleWalkthroughChange();
  stepSelect.value = target.step_id;
  
  // Update save button text
  saveText.textContent = 'Update Target';
}

async function deleteTarget(targetId) {
  if (!confirm('Are you sure you want to delete this target?')) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_TARGET',
      targetId: targetId
    });
    
    if (response?.success) {
      showSuccess('Target deleted successfully');
      await loadTargets();
    } else {
      showError(response?.error || 'Failed to delete target');
    }
  } catch (error) {
    console.error('Delete target error:', error);
    showError('Failed to delete target');
  }
}

// Modify saveTarget to handle both create and update
async function saveTarget() {
  if (!pickedData) return;
  
  const walkthroughId = walkthroughSelect.value;
  const stepId = stepSelect.value;
  const urlScope = urlScopeSelect.value;
  
  if (!walkthroughId || !stepId) {
    showError('Please select a walkthrough and step');
    return;
  }
  
  saveTargetBtn.disabled = true;
  saveSpinner.classList.remove('hidden');
  saveText.textContent = isEditingTarget ? 'Updating...' : 'Saving...';
  
  try {
    // Verify binding before saving
    const bindingCheck = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_WORKSPACE]);
    if (!bindingCheck[STORAGE_KEY_TOKEN] || !bindingCheck[STORAGE_KEY_WORKSPACE]) {
      showError('Extension not bound. Please enter a binding token first.');
      showState('unbound');
      return;
    }
    
    // Build URL rule from picked URL based on scope
    const fullUrl = pickedData.url;
    let urlType, urlValue;
    
    if (urlScope === 'page') {
      urlType = 'exact';
      urlValue = fullUrl.split('?')[0].split('#')[0];
    } else if (urlScope === 'domain') {
      urlType = 'prefix';
      try {
        const urlObj = new URL(fullUrl);
        urlValue = urlObj.origin + '/';
      } catch (e) {
        urlValue = fullUrl.split('/').slice(0, 3).join('/') + '/';
      }
    } else if (urlScope === 'global') {
      urlType = 'prefix';
      urlValue = 'http';
    }
    
    const targetData = {
      walkthrough_id: walkthroughId,
      step_id: stepId,
      url_rule: {
        type: urlType,
        value: urlValue
      },
      selector: pickedData.selector
    };
    
    let response;
    if (isEditingTarget && editingTargetId) {
      // Update existing target
      response = await chrome.runtime.sendMessage({
        type: 'UPDATE_TARGET',
        targetId: editingTargetId,
        data: targetData
      });
    } else {
      // Create new target
      response = await chrome.runtime.sendMessage({
        type: 'CREATE_TARGET',
        data: targetData
      });
    }
    
    if (response?.success) {
      showSuccess(isEditingTarget ? 'Target updated successfully!' : 'Target created successfully!');
      cancelTargetCreation();
      // Refresh targets list if visible
      if (!targetsList.classList.contains('hidden')) {
        await loadTargets();
      }
      // Notify content script to clear picker overlay
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_PICKER' }).catch(() => {});
      }
      // Also clear stored pending data
      chrome.storage.local.remove(['pending_picked_data']);
    } else if (response?.error) {
      switch (response.error) {
        case 'NOT_BOUND':
          showError('Extension not bound. Please enter a binding token.');
          showState('unbound');
          break;
        default:
          showError(response.error || 'Failed to save target');
      }
    } else {
      showError('Failed to save target');
    }
  } catch (error) {
    console.error('Save target error:', error);
    showError('Failed to save target: ' + error.message);
  } finally {
    saveTargetBtn.disabled = false;
    saveSpinner.classList.add('hidden');
    saveText.textContent = isEditingTarget ? 'Update Target' : 'Save Target';
    isEditingTarget = false;
    editingTargetId = null;
  }
}

// Modify cancelTargetCreation to reset edit mode
function cancelTargetCreation() {
  pickedData = null;
  isEditingTarget = false;
  editingTargetId = null;
  targetForm.classList.add('hidden');
  createTargetBtn.classList.remove('hidden');
  walkthroughSelect.value = '';
  stepSelect.value = '';
  stepSelect.disabled = true;
  saveText.textContent = 'Save Target';
}

// Escape HTML helper function
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
loadState();
checkWalkthroughStatus(); // Check if walkthrough is active on load

// Poll for walkthrough progress updates while popup is open
const progressInterval = setInterval(() => {
  if (!document.hidden) {
    loadWalkthroughProgress();
  }
}, 1000);

// Cleanup on unload
window.addEventListener('unload', () => {
  clearInterval(progressInterval);
});
  
  // Check if we have pending picked data from a previous picker session
  chrome.storage.local.get(['pending_picked_data']).then(result => {
    if (result.pending_picked_data) {
      handleElementPicked(result.pending_picked_data);
      
      // Trigger re-highlight on the active tab
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.id && result.pending_picked_data.selector) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'REHIGHLIGHT_ELEMENT',
            selector: result.pending_picked_data.selector
          }).catch(() => {});
        }
      });
      
      chrome.storage.local.remove(['pending_picked_data']);
    }
  });

/**
 * Load admin mode setting from storage
 */
async function loadAdminMode() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEY_ADMIN_MODE]);
    isAdminMode = stored[STORAGE_KEY_ADMIN_MODE] || false;
    console.log('[IG Popup] Admin mode:', isAdminMode);
    
    // If admin mode, show telemetry button
    if (isAdminMode) {
      showTelemetryButton();
    }
  } catch (e) {
    console.error('[IG Popup] Failed to load admin mode:', e);
    isAdminMode = false;
  }
}

/**
 * TELEMETRY VIEWER (Admin Only)
 */
function showTelemetryButton() {
  // Find a good place to add the button
  const container = document.querySelector('.container');
  if (!container) return;
  
  const btn = document.createElement('button');
  btn.id = 'telemetry-viewer-btn';
  btn.textContent = '📊 View Telemetry';
  btn.style.cssText = `
    width: 100%;
    padding: 12px;
    margin-top: 12px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  `;
  btn.onclick = openTelemetryViewer;
  
  container.appendChild(btn);
}

async function openTelemetryViewer() {
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'telemetry-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Get telemetry data
  const telemetry = await chrome.runtime.sendMessage({ type: 'GET_TELEMETRY' });
  const events = telemetry?.events || [];
  
  // Calculate stats
  const stats = calculateTelemetryStats(events);
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #1f2937;">📊 Telemetry Log</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">${events.length} events recorded</p>
        </div>
        <button onclick="closeTelemetryModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af;">×</button>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <!-- Stats Summary -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #4f46e5;">${stats.sessions}</div>
            <div style="font-size: 12px; color: #6b7280;">Sessions</div>
          </div>
          <div style="background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${stats.completions}</div>
            <div style="font-size: 12px; color: #6b7280;">Completed</div>
          </div>
          <div style="background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${stats.aborts}</div>
            <div style="font-size: 12px; color: #6b7280;">Aborted</div>
          </div>
        </div>
        
        <!-- Event List -->
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background: #f9fafb; padding: 12px; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
            Recent Events
          </div>
          <div style="max-height: 300px; overflow-y: auto;">
            ${events.slice(0, 50).map(e => formatTelemetryEvent(e)).join('')}
          </div>
        </div>
        
        ${stats.topFailures.length > 0 ? `
        <!-- Top Failures -->
        <div style="margin-top: 20px;">
          <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">⚠️ Common Failure Reasons</div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px;">
            ${stats.topFailures.map(f => `
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: #dc2626; padding: 4px 0;">
                <span>${f.reason}</span>
                <span style="font-weight: 600;">${f.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      
      <div style="padding: 16px 20px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px;">
        <button onclick="exportTelemetryData()" style="flex: 1; padding: 10px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">
          📥 Export JSON
        </button>
        <button onclick="clearTelemetryData()" style="padding: 10px 16px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">
          Clear
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function formatTelemetryEvent(event) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const colors = {
    'session_start': '#22c55e',
    'session_complete': '#22c55e',
    'session_abort': '#ef4444',
    'step_failure': '#f59e0b',
    'validation_success': '#22c55e',
    'validation_fail': '#ef4444',
    'target_resolved': '#3b82f6'
  };
  
  const color = colors[event.type] || '#6b7280';
  
  return `
    <div style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: ${color}; font-weight: 500;">${event.type}</span>
        <span style="color: #9ca3af; font-size: 11px;">${time}</span>
      </div>
      ${event.data ? `<div style="color: #6b7280; margin-top: 4px; font-size: 11px;">${JSON.stringify(event.data).slice(0, 100)}</div>` : ''}
    </div>
  `;
}

function calculateTelemetryStats(events) {
  const sessions = new Set();
  let completions = 0;
  let aborts = 0;
  const failureReasons = {};
  
  for (const event of events) {
    if (event.data?.sessionId) {
      sessions.add(event.data.sessionId);
    }
    
    if (event.type === 'session_complete') completions++;
    if (event.type === 'session_abort') {
      aborts++;
      const reason = event.data?.reason || 'unknown';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
  }
  
  const topFailures = Object.entries(failureReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    sessions: sessions.size,
    completions,
    aborts,
    topFailures
  };
}

function closeTelemetryModal() {
  const modal = document.getElementById('telemetry-modal');
  if (modal) modal.remove();
}

async function exportTelemetryData() {
  const telemetry = await chrome.runtime.sendMessage({ type: 'GET_TELEMETRY' });
  const data = {
    exportDate: new Date().toISOString(),
    ...telemetry
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `walkthrough-telemetry-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearTelemetryData() {
  if (!confirm('Clear all telemetry data? This cannot be undone.')) return;
  
  await chrome.runtime.sendMessage({ type: 'CLEAR_TELEMETRY' });
  closeTelemetryModal();
  openTelemetryViewer(); // Refresh
}

// Global functions for onclick handlers
window.closeTelemetryModal = closeTelemetryModal;
window.exportTelemetryData = exportTelemetryData;
window.clearTelemetryData = clearTelemetryData;

// ============================================================================
// WALKTHROUGH AUTHORING (Admin Only)
// ============================================================================

const enterAuthoringBtn = document.getElementById('enter-authoring-btn');
const manageWalkthroughsBtn = document.getElementById('manage-walkthroughs-btn');
const authoringSection = document.getElementById('authoring-section');
const walkthroughListSection = document.getElementById('walkthrough-list-section');
const walkthroughContainer = document.getElementById('walkthrough-container');

/**
 * Initialize authoring section - show only for admins, hide old UI
 */
async function initAuthoringSection() {
  if (!authoringSection) return;
  
  const isAdmin = await checkAdminPermission();
  if (isAdmin) {
    authoringSection.classList.remove('hidden');
    
    // Hide old target UI when in admin mode
    const oldTargetUI = document.getElementById('create-target-btn');
    const oldManageBtn = document.getElementById('manage-targets-btn');
    const oldTargetsList = document.getElementById('targets-list');
    
    if (oldTargetUI) oldTargetUI.classList.add('hidden');
    if (oldManageBtn) oldManageBtn.classList.add('hidden');
    if (oldTargetsList) oldTargetsList.classList.add('hidden');
    
    loadAuthoringWalkthroughs();
  }
}

/**
 * Check if user has admin permission
 */
async function checkAdminPermission() {
  const stored = await chrome.storage.local.get(['ig_walkthrough_admin_mode']);
  return stored.ig_walkthrough_admin_mode === true;
}

/**
 * Load walkthroughs for authoring management
 */
async function loadAuthoringWalkthroughs() {
  if (!walkthroughContainer) return;
  
  try {
    // Load from repository
    const drafts = await window.walkthroughRepository?.getAllDrafts() || [];
    const published = await window.walkthroughRepository?.getAllPublished() || [];
    
    const allWalkthroughs = [...drafts, ...published].sort((a, b) => b.updatedAt - a.updatedAt);
    
    if (allWalkthroughs.length === 0) {
      walkthroughContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #9ca3af;">
          <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
          <div>No walkthroughs yet</div>
          <div style="font-size: 12px; margin-top: 4px;">Click "Enter Authoring Mode" to create one</div>
        </div>
      `;
      return;
    }
    
    walkthroughContainer.innerHTML = allWalkthroughs.map(w => {
      const isDraft = w.status === 'draft';
      const stepCount = w.steps?.length || 0;
      
      return `
        <div style="
          padding: 12px;
          background: ${isDraft ? '#fef3c7' : '#dcfce7'};
          border-radius: 8px;
          margin-bottom: 8px;
          border: 1px solid ${isDraft ? '#fcd34d' : '#86efac'};
        ">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <div style="font-weight: 600; font-size: 14px; color: #1f2937;">${escapeHtml(w.name)}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                ${stepCount} step${stepCount !== 1 ? 's' : ''} • ${isDraft ? 'Draft' : 'Published'}
              </div>
            </div>
            <span style="
              font-size: 10px;
              padding: 2px 6px;
              border-radius: 4px;
              background: ${isDraft ? '#f59e0b' : '#22c55e'};
              color: white;
              font-weight: 500;
            ">${isDraft ? 'DRAFT' : 'LIVE'}</span>
          </div>
          
          <div style="display: flex; gap: 6px; margin-top: 10px;">
            ${isDraft ? `
              <button class="wt-edit-btn" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Edit</button>
              <button class="wt-publish-btn" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: #4f46e5;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Publish</button>
              <button class="wt-test-btn" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Test</button>
            ` : `
              <button class="wt-test-btn" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Test</button>
              <button class="wt-archive-btn" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                color: #ef4444;
              ">Archive</button>
            `}
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners
    walkthroughContainer.querySelectorAll('.wt-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editWalkthrough(btn.dataset.id));
    });
    
    walkthroughContainer.querySelectorAll('.wt-publish-btn').forEach(btn => {
      btn.addEventListener('click', () => publishWalkthroughFromPopup(btn.dataset.id));
    });
    
    walkthroughContainer.querySelectorAll('.wt-test-btn').forEach(btn => {
      btn.addEventListener('click', () => testWalkthrough(btn.dataset.id));
    });
    
    walkthroughContainer.querySelectorAll('.wt-archive-btn').forEach(btn => {
      btn.addEventListener('click', () => archiveWalkthrough(btn.dataset.id));
    });
    
  } catch (error) {
    console.error('Failed to load walkthroughs:', error);
    walkthroughContainer.innerHTML = '<p style="color: #dc2626;">Failed to load walkthroughs</p>';
  }
}

/**
 * Enter authoring mode on current page
 */
async function enterAuthoringMode() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.id) {
    showError('Cannot access current tab');
    return;
  }
  
  // Send message to content script to enter authoring mode
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ENTER_AUTHORING_MODE' });
    window.close(); // Close popup
  } catch (error) {
    showError('Failed to enter authoring mode. Reload the page and try again.');
  }
}

/**
 * Toggle walkthrough list visibility
 */
async function toggleWalkthroughList() {
  if (!walkthroughListSection) return;
  
  const isVisible = !walkthroughListSection.classList.contains('hidden');
  if (isVisible) {
    walkthroughListSection.classList.add('hidden');
    manageWalkthroughsBtn.textContent = '📚 Manage Walkthroughs';
  } else {
    walkthroughListSection.classList.remove('hidden');
    manageWalkthroughsBtn.textContent = '📚 Hide Walkthroughs';
    await loadAuthoringWalkthroughs();
  }
}

/**
 * Edit walkthrough
 */
async function editWalkthrough(walkthroughId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.id) return;
  
  // Send message to content script to edit this walkthrough
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'EDIT_WALKTHROUGH',
      walkthroughId 
    });
    window.close();
  } catch (error) {
    showError('Failed to open walkthrough editor');
  }
}

/**
 * Publish walkthrough from popup
 */
async function publishWalkthroughFromPopup(walkthroughId) {
  if (!confirm('Publish this walkthrough? It will become live for all users.')) {
    return;
  }
  
  try {
    await window.walkthroughRepository?.publish(walkthroughId);
    showSuccess('Walkthrough published successfully!');
    await loadAuthoringWalkthroughs();
  } catch (error) {
    showError('Failed to publish: ' + error.message);
  }
}

/**
 * Start available guide in user mode
 */
async function startAvailableGuide() {
  try {
    console.log('[Popup] startAvailableGuide called');
    
    // Get the current tab's URL, not the popup's URL
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0]?.url || window.location.href;
    console.log('[Popup] Getting available guides for URL:', currentUrl);
    
    // Test if background is responding
    console.log('[Popup] Sending PING to background...');
    const pingResponse = await chrome.runtime.sendMessage({ type: 'PING' });
    console.log('[Popup] PING response:', pingResponse);
    
    // Check if there are any published walkthroughs for this URL
    console.log('[Popup] Sending GET_AVAILABLE_GUIDE to background...');
    chrome.runtime.sendMessage(
      {
        type: 'GET_AVAILABLE_GUIDE',
        url: currentUrl
      },
      (response) => {
        console.log('[Popup] GET_AVAILABLE_GUIDE response:', response);

        if (!response) {
          console.error('[Popup] No response from background');
          return;
        }

        if (response.error) {
          console.error('[Popup] Background error:', response.error);
          showError('Failed to load guides: ' + response.error);
          return;
        }

        const walkthroughs = response.walkthroughs || [];
        console.log('[Popup] Walkthrough count:', walkthroughs.length);

        if (walkthroughs.length > 0) {
          console.log('[Popup] Showing', walkthroughs.length, 'walkthroughs');
          renderGuideList(walkthroughs);
          showGuideList();
        } else {
          console.log('[Popup] No walkthroughs found for URL:', currentUrl);
          showGuideList();
          guideContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
              <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
              <h3 style="margin: 0 0 8px 0; color: #374151;">No guides available</h3>
              <p style="margin: 0 0 16px 0; font-size: 14px;">
                No walkthroughs have been created for this page yet.
              </p>
              <div style="font-size: 12px; color: #9ca3af; background: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 16px;">
                <strong>Tip:</strong> Use "Enter Authoring Mode" to create walkthroughs for this page.
              </div>
            </div>
          `;
          if (guideContainerBound) {
            guideContainerBound.innerHTML = `
              <p style="color: #059669; font-style: italic;">
                No guides available for this page
              </p>
            `;
          }
        }
      }
    );

  } catch (error) {
    console.error('[Popup] Failed to load guides:', error);
    showError('Failed to load guides: ' + error.message);
  }
}

/**
 * Show guide list view
 */
function showGuideList() {
  guideSelection.classList.add('hidden');
  guideList.classList.remove('hidden');
  stepsView.classList.add('hidden');
  
  // For bound state
  if (guideSelectionBound) {
    guideSelectionBound.classList.add('hidden');
    guideListBound.classList.remove('hidden');
    stepsViewBound.classList.add('hidden');
  }
}

/**
 * Show guide list view
 */
function showUserMode() {
  // Hide admin panel
  adminPanel.classList.add('hidden');
  
  // Hide Create New Guide buttons in user mode
  if (createNewGuideBtn) {
    createNewGuideBtn.classList.add('hidden');
  }
  if (createNewGuideBtnBound) {
    createNewGuideBtnBound.classList.add('hidden');
  }
  
  // Reset to guide selection
  guideSelection.classList.remove('hidden');
  guideList.classList.add('hidden');
  stepsView.classList.add('hidden');
  
  // For bound state
  if (guideSelectionBound) {
    guideSelectionBound.classList.remove('hidden');
    guideListBound.classList.add('hidden');
    stepsViewBound.classList.add('hidden');
  }
}

/**
 * Hide guide list and show steps view
 */
function showStepsView(walkthrough) {
  selectedWalkthrough = walkthrough;
  
  // Unbound state
  if (guideList) guideList.classList.add('hidden');
  if (stepsView) {
    stepsView.classList.remove('hidden');
    currentGuideName.textContent = walkthrough.name;
    renderStepsList(walkthrough);
  }
  
  // Bound state
  if (guideListBound) guideListBound.classList.add('hidden');
  if (stepsViewBound) {
    stepsViewBound.classList.remove('hidden');
    currentGuideNameBound.textContent = walkthrough.name;
    renderStepsListBound(walkthrough);
  }
}

/**
 * Render guide list
 */
function renderGuideList(walkthroughs) {
  const html = walkthroughs.map(wt => {
    const isPublished = wt.status === 'PUBLISHED';
    const statusColor = isPublished ? '#22c55e' : '#f59e0b';
    const statusText = isPublished ? 'Published' : 'Draft';
    
    return `
      <div style="
        padding: 12px;
        background: white;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.15s;
      " class="guide-item" data-walkthrough-id="${wt.walkthroughId}">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">
              ${escapeHtml(wt.name)}
            </div>
            <div style="font-size: 11px; color: #059669;">
              ${wt.steps?.length || 0} steps
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span style="
              font-size: 10px;
              padding: 2px 6px;
              background: ${statusColor};
              color: white;
              border-radius: 4px;
              font-weight: 600;
            ">
              ${statusText}
            </span>
            ${!isPublished ? `
              <button class="publish-guide-btn btn btn-primary" data-walkthrough-id="${wt.walkthroughId}" style="
                padding: 4px 8px;
                font-size: 10px;
                background: #22c55e;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
              ">
                Publish
              </button>
            ` : ''}
          </div>
        </div>
        <button class="view-steps-btn btn btn-primary" data-walkthrough-id="${wt.walkthroughId}" style="
          width: 100%;
          padding: 6px;
          font-size: 11px;
          background: #22c55e;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        ">
          View Steps
        </button>
      </div>
    `;
  }).join('');
  
  if (guideContainer) guideContainer.innerHTML = html;
  if (guideContainerBound) guideContainerBound.innerHTML = html;
  
  // Add click handlers for guide items
  const containers = [guideContainer, guideContainerBound].filter(Boolean);
  containers.forEach(container => {
    container.querySelectorAll('.guide-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-steps-btn')) {
          e.stopPropagation();
          e.preventDefault();
          const walkthroughId = item.dataset.walkthroughId;
          const walkthrough = walkthroughs.find(wt => wt.walkthroughId === walkthroughId);
          if (walkthrough) {
            showStepsView(walkthrough);
          }
        }
      });
    });
    
    // Add publish button handlers
    container.querySelectorAll('.publish-guide-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const walkthroughId = btn.dataset.walkthroughId;
        await publishGuideFromUserMode(walkthroughId);
      });
    });
  });
}

/**
 * Render steps list
 */
function renderStepsList(walkthrough) {
  const stepsHtml = (walkthrough.steps || []).map((step, index) => `
    <div style="
      padding: 8px;
      background: white;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      margin-bottom: 4px;
    ">
      <div style="font-weight: 600; color: #166534; font-size: 11px;">
        Step ${index + 1}
      </div>
      <div style="font-size: 10px; color: #059669; margin-top: 2px;">
        ${escapeHtml(step.instruction || 'No instruction')}
      </div>
    </div>
  `).join('');
  
  if (stepsContainer) stepsContainer.innerHTML = stepsHtml || '<p style="color: #059669; font-style: italic;">No steps available</p>';
  if (stepsContainerBound) stepsContainerBound.innerHTML = stepsHtml || '<p style="color: #059669; font-style: italic;">No steps available</p>';
}

/**
 * Publish a guide from user mode
 */
async function publishGuideFromUserMode(walkthroughId) {
  try {
    // Get the walkthrough data
    const response = await chrome.runtime.sendMessage({ 
      type: 'GET_AVAILABLE_GUIDE',
      url: window.location.href 
    });
    
    if (response.walkthroughs && response.walkthroughs.length > 0) {
      const walkthrough = response.walkthroughs.find(wt => wt.walkthroughId === walkthroughId);
      
      if (walkthrough) {
        // Update status to published
        walkthrough.status = 'PUBLISHED';
        walkthrough.publishedAt = Date.now();
        
        // Save to local storage
        const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
        const published = stored.ig_published_walkthroughs || {};
        published[walkthroughId] = walkthrough;
        await chrome.storage.local.set({
          ig_published_walkthroughs: published
        });
        
        // Also remove from drafts if it exists there
        await chrome.storage.local.remove([`ig_draft_walkthrough_${walkthroughId}`]);
        
        showSuccess('Guide published successfully!');
        
        // Refresh the guide list
        setTimeout(() => {
          startAvailableGuide();
        }, 1000);
      } else {
        showError('Guide not found');
      }
    } else {
      showError('No guides available');
    }
  } catch (error) {
    showError('Failed to publish guide: ' + error.message);
  }
}

/**
 * Render steps list for bound state
 */
function renderStepsListBound(walkthrough) {
  renderStepsList(walkthrough);
}

/**
 * Render user walkthrough list
 */
function renderUserWalkthroughs(walkthroughs) {
  if (!walkthroughs || walkthroughs.length === 0) {
    userWalkthroughContainer.innerHTML = `
      <p style="color: #059669; font-style: italic;">
        No guides available for this page
      </p>
    `;
    return;
  }
  
  userWalkthroughContainer.innerHTML = walkthroughs.map(wt => `
    <div style="
      padding: 12px;
      background: white;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s;
    " class="user-walkthrough-item" data-walkthrough-id="${wt.walkthroughId}">
      <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">
        ${escapeHtml(wt.name)}
      </div>
      <div style="font-size: 11px; color: #059669; margin-bottom: 8px;">
        ${wt.steps?.length || 0} steps
      </div>
      <button class="btn btn-primary" style="
        width: 100%;
        padding: 8px;
        font-size: 12px;
        background: #22c55e;
      ">
        Start Guide
      </button>
    </div>
  `).join('');
  
  // Add click handlers
  userWalkthroughContainer.querySelectorAll('.user-walkthrough-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        e.stopPropagation();
        e.preventDefault();
        const walkthroughId = item.dataset.walkthroughId;
        startUserWalkthrough(walkthroughId);
      }
    });
  });
}

// Check if walkthrough is active and update UI accordingly
async function checkWalkthroughStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_WALKTHROUGH_STATUS' });
    if (response && response.active) {
      // Walkthrough is active - show stop button only
      showWalkthroughActiveUI(response.walkthrough);
    } else {
      // No active walkthrough - show normal UI
      showNormalUI();
    }
  } catch (error) {
    console.error('[Popup] Failed to check walkthrough status:', error);
    showNormalUI();
  }
}

// Show UI when walkthrough is active
function showWalkthroughActiveUI(walkthrough) {
  // Hide all sections
  if (unboundSection) unboundSection.classList.add('hidden');
  if (boundSection) boundSection.classList.add('hidden');
  
  // Create walkthrough active section
  let activeSection = document.getElementById('walkthrough-active-section');
  if (!activeSection) {
    activeSection = document.createElement('div');
    activeSection.id = 'walkthrough-active-section';
    activeSection.className = 'section';
    activeSection.innerHTML = `
      <div class="section-title">Walkthrough in Progress</div>
      <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
        <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🚶</span>
          ${walkthrough?.name || 'Walkthrough'} in Progress
        </div>
        <p style="font-size: 13px; color: #92400e; margin-bottom: 12px;">
          A walkthrough is currently running on this page.
        </p>
        <button id="stop-walkthrough-btn" class="btn btn-danger">
          ⏹️ Stop Walkthrough
        </button>
      </div>
    `;
    document.body.appendChild(activeSection);
    
    // Add stop button listener
    document.getElementById('stop-walkthrough-btn').addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'WALKTHROUGH_ABORT', reason: 'user_stop' });
        window.close();
      } catch (error) {
        showError('Failed to stop walkthrough');
      }
    });
  }
}

// Show normal UI when no walkthrough is active
function showNormalUI() {
  // Remove walkthrough active section if it exists
  const activeSection = document.getElementById('walkthrough-active-section');
  if (activeSection) {
    activeSection.remove();
  }
  
  // Check current binding state by looking at which section is visible
  const isBoundVisible = boundSection && !boundSection.classList.contains('hidden');
  
  // Show appropriate section based on binding status
  if (isBoundVisible) {
    if (boundSection) boundSection.classList.remove('hidden');
    if (unboundSection) unboundSection.classList.add('hidden');
  } else {
    if (unboundSection) unboundSection.classList.remove('hidden');
    if (boundSection) boundSection.classList.add('hidden');
  }
}
async function startUserWalkthrough(walkthroughId) {
  try {
    console.log('[Popup] startUserWalkthrough called with ID:', walkthroughId);
    
    // Get the current tab's URL, not the popup's URL
    console.log('[Popup] Querying active tab...');
    const tabs = await chrome.tabs.query({ active: true });
    console.log('[Popup] Tabs query result:', tabs);
    const tabId = tabs[0]?.id;
    const currentUrl = tabs[0]?.url || window.location.href;
    console.log('[Popup] Current tab ID:', tabId);
    console.log('[Popup] Current tab URL:', currentUrl);
    
    if (!tabId) {
      console.error('[Popup] No active tab found - tabs array:', tabs);
      showError('No active tab found. Please refresh the page and try again.');
      return;
    }
    
    // Get all available walkthroughs
    const response = await chrome.runtime.sendMessage({ 
      type: 'GET_AVAILABLE_GUIDE',
      url: currentUrl 
    });
    console.log('[Popup] Available walkthroughs response:', response);
    
    if (response.walkthroughs && response.walkthroughs.length > 0) {
      // Find the specific walkthrough
      const walkthrough = response.walkthroughs.find(wt => wt.walkthroughId === walkthroughId);
      console.log('[Popup] Found walkthrough:', walkthrough);
      
      if (walkthrough) {
        // Use current URL for activation instead of walkthrough.startUrl
        const activationWalkthrough = {
          ...walkthrough,
          startUrl: currentUrl
        };
        
        // Start the walkthrough
        console.log('[Popup] Sending WALKTHROUGH_START message...');
        const startResponse = await chrome.runtime.sendMessage({
          type: 'WALKTHROUGH_START',
          walkthrough: activationWalkthrough,
          progress: { currentStep: 0, completed: false },
          tabId: tabId // Include the tab ID
        });
        console.log('[Popup] WALKTHROUGH_START response:', startResponse);
        window.close();
      } else {
        console.error('[Popup] Guide not found with ID:', walkthroughId);
        showError('Guide not found');
      }
    } else {
      console.error('[Popup] No guides available');
      showError('No guides available');
    }
  } catch (error) {
    console.error('[Popup] Failed to start guide:', error);
    showError('Failed to start guide: ' + error.message);
  }
}

/**
 * Test walkthrough
 */
async function testWalkthrough(walkthroughId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.id) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'TEST_WALKTHROUGH',
      walkthroughId 
    });
    window.close();
  } catch (error) {
    showError('Failed to start test mode');
  }
}

/**
 * Archive walkthrough
 */
async function archiveWalkthrough(walkthroughId) {
  if (!confirm('Archive this walkthrough? It will no longer be available to users.')) {
    return;
  }
  
  try {
    await window.walkthroughRepository?.archive(walkthroughId);
    showSuccess('Walkthrough archived');
    await loadAuthoringWalkthroughs();
  } catch (error) {
    showError('Failed to archive: ' + error.message);
  }
}

// Add event listeners for authoring buttons
if (enterAuthoringBtn) {
  enterAuthoringBtn.addEventListener('click', enterAuthoringMode);
}

if (manageWalkthroughsBtn) {
  manageWalkthroughsBtn.addEventListener('click', toggleWalkthroughList);
}

// Initialize authoring section on load
document.addEventListener('DOMContentLoaded', () => {
  initAuthoringSection();
});
