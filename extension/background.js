// Interguide Extension Background Service Worker
// Capability-based binding: zero cookies, zero session, token-only

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
  
  // Handle revocation
  if (response.status === 401 || response.status === 403) {
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
  
  return response;
}

// Resolve targets for current URL
async function resolveTargets(url) {
  try {
    const response = await apiCall(`/extension/resolve?url=${encodeURIComponent(url)}`);
    if (!response.ok) return { matches: [] };
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Resolve error:', error);
    return { matches: [] };
  }
}

// Get walkthroughs for bound workspace
async function getWalkthroughs() {
  try {
    const response = await apiCall('/extension/walkthroughs');
    if (!response.ok) return { walkthroughs: [] };
    return await response.json();
  } catch (error) {
    console.error('[IG Background] Walkthroughs error:', error);
    return { walkthroughs: [] };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;
  
  (async () => {
    switch (message.type) {
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
        // Content script requesting walkthrough data
        const walkthroughs = await getWalkthroughs();
        sendResponse(walkthroughs);
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
