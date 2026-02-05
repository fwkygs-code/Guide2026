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
    const extensionId = getExtensionId();
    
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
    const data = await chrome.storage.local.get([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_WORKSPACE,
      STORAGE_KEY_EXTENSION_ID
    ]);
    
    if (data[STORAGE_KEY_TOKEN] && data[STORAGE_KEY_WORKSPACE]) {
      // We have a token - check if it's still valid
      workspaceNameEl.textContent = data[STORAGE_KEY_WORKSPACE].name;
      extensionIdShortEl.textContent = (data[STORAGE_KEY_EXTENSION_ID] || getExtensionId()).substring(0, 8) + '...';
      showState('bound');
    } else {
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

// Initialize on load
document.addEventListener('DOMContentLoaded', loadState);
