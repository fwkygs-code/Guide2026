const API_AUTH_ME_ENDPOINT = 'https://api.interguide.app/api/auth/me';
const ADMIN_ROLES = new Set(['owner', 'admin', 'manager']);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'CHECK_AUTH') {
    return false;
  }

  (async () => {
    try {
      const response = await fetch(API_AUTH_ME_ENDPOINT, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        sendResponse({ authenticated: false, status: response.status });
        return;
      }

      const data = await response.json();
      const role = (data?.role || '').toLowerCase();
      const authenticated = ADMIN_ROLES.has(role);
      sendResponse({ authenticated, role });
    } catch (error) {
      sendResponse({ authenticated: false, error: error?.message || 'auth_failed' });
    }
  })();

  return true; // keep the channel open for async response
});
