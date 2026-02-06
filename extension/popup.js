// Interguide Extension Popup
// Handles token binding UI and state transitions

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

// Track picked element data
let pickedData = null;
let adminWalkthroughs = [];

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
      option.value = wt.walkthrough_id;
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
    const walkthrough = adminWalkthroughs.find(wt => wt.walkthrough_id === walkthroughId);
    if (walkthrough?.steps) {
      walkthrough.steps.forEach(step => {
        const option = document.createElement('option');
        option.value = step.id || step.step_id;
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

// Show/hide sections based on state
function showState(state) {
  // Hide all sections
  unboundSection.classList.add('hidden');
  boundSection.classList.add('hidden');
  revokedSection.classList.add('hidden');
  errorMessage.classList.add('hidden');
  successMessage.classList.add('hidden');
  
  // Update badge
  statusBadge.className = 'status-badge';
  
  switch (state) {
    case 'unbound':
      unboundSection.classList.remove('hidden');
      statusBadge.classList.add('status-unbound');
      statusBadge.textContent = 'Unbound';
      break;
    case 'bound':
      boundSection.classList.remove('hidden');
      statusBadge.classList.add('status-bound');
      statusBadge.textContent = 'Bound';
      break;
    case 'revoked':
      revokedSection.classList.remove('hidden');
      statusBadge.classList.add('status-revoked');
      statusBadge.textContent = 'Revoked';
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

// Target Creation Event Listeners
createTargetBtn.addEventListener('click', startElementPicker);
walkthroughSelect.addEventListener('change', handleWalkthroughChange);
urlScopeSelect.addEventListener('change', handleUrlScopeChange);
saveTargetBtn.addEventListener('click', saveTarget);
cancelTargetBtn.addEventListener('click', cancelTargetCreation);

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  
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
});
