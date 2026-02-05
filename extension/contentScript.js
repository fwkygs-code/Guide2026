(() => {
  const API_RESOLVE_ENDPOINT = 'https://api.interguide.app/api/extension/resolve';
  const WALKTHROUGH_BASE_URL = 'https://www.interguide.app/portal/walkthrough';

  let currentUrl = null;
  let matches = [];
  let overlayRoot = null;
  let triggerButton = null;
  let overlay = null;
  let frame = null;
  let unauthorized = false;

  const state = {
    button: null,
    overlay: null,
    frame: null,
  };

  const ensureOverlay = () => {
    if (overlayRoot) return;
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'ig-extension-root';
    overlayRoot.innerHTML = `
      <style>
        #ig-extension-root { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
        #ig-ext-button { pointer-events: auto; position: fixed; right: 24px; bottom: 24px; padding: 14px 20px; border: none; border-radius: 999px; background: linear-gradient(135deg,#6d28d9,#4f46e5); color: #fff; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size: 15px; box-shadow: 0 15px 35px rgba(79,70,229,.35); cursor: pointer; display: none; }
        #ig-ext-overlay { pointer-events: auto; position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,.65); z-index: 2147483647; }
        #ig-ext-panel { width: min(90vw,960px); height: min(85vh,720px); background: #0f172a; border-radius: 24px; box-shadow: 0 40px 120px rgba(15,23,42,.65); overflow: hidden; position: relative; display: flex; flex-direction: column; }
        #ig-ext-close { position: absolute; top: 14px; right: 18px; border: none; background: rgba(15,23,42,.7); color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; }
        #ig-ext-frame { flex: 1; border: none; width: 100%; height: 100%; background: #0b1220; }
        body.ig-ext-locked { overflow: hidden !important; }
      </style>
      <button id="ig-ext-button">Need help?</button>
      <div id="ig-ext-overlay">
        <div id="ig-ext-panel">
          <button id="ig-ext-close" aria-label="Close">×</button>
          <iframe id="ig-ext-frame" title="Interguide Walkthrough"></iframe>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlayRoot);

    state.button = overlayRoot.querySelector('#ig-ext-button');
    state.overlay = overlayRoot.querySelector('#ig-ext-overlay');
    state.frame = overlayRoot.querySelector('#ig-ext-frame');

    triggerButton = state.button;
    overlay = state.overlay;
    frame = state.frame;

    state.button.addEventListener('click', () => openOverlay());
    overlayRoot.querySelector('#ig-ext-close').addEventListener('click', closeOverlay);
    state.overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeOverlay();
    });
  };

  const teardownOverlay = () => {
    if (!overlayRoot) return;
    overlayRoot.remove();
    overlayRoot = null;
    triggerButton = null;
    overlay = null;
    frame = null;
    document.body.classList.remove('ig-ext-locked');
  };

  const showButton = () => {
    ensureOverlay();
    triggerButton.style.display = 'block';
  };

  const hideButton = () => {
    if (triggerButton) triggerButton.style.display = 'none';
    closeOverlay();
  };

  const openOverlay = (index = 0) => {
    if (!matches[index]) return;
    ensureOverlay();
    const { walkthrough_id, step_id } = matches[index];
    const hasValidStep = Number.isInteger(step_id) && step_id > 0;
    const stepHash = hasValidStep ? `#step=${step_id}` : '';
    frame.src = `https://www.interguide.app/portal/walkthrough/${walkthrough_id}${stepHash}`;
    overlay.style.display = 'flex';
    document.body.classList.add('ig-ext-locked');
  };

  const closeOverlay = () => {
    if (state.overlay) {
      state.overlay.style.display = 'none';
    }
    if (state.frame) {
      state.frame.removeAttribute('src');
    }
    document.body.classList.remove('ig-ext-locked');
  };

  const resolveTargets = async (url) => {
    if (unauthorized) return;
    try {
      const response = await fetch(`${API_RESOLVE_ENDPOINT}?url=${encodeURIComponent(url)}`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        unauthorized = true;
        matches = [];
        hideButton();
        teardownOverlay();
        return;
      }
      if (!response.ok) throw new Error('resolve_failed');

      const data = await response.json();
      matches = Array.isArray(data.matches) ? data.matches.slice().sort((a, b) => {
        const walkCompare = (a.walkthrough_id || '').localeCompare(b.walkthrough_id || '');
        if (walkCompare !== 0) return walkCompare;
        const stepA = Number.isInteger(a.step_id) ? a.step_id : Infinity;
        const stepB = Number.isInteger(b.step_id) ? b.step_id : Infinity;
        return stepA - stepB;
      }) : [];
      if (matches.length > 0) {
        showButton();
      } else {
        hideButton();
      }
    } catch {
      matches = [];
      hideButton();
    }
  };

  const handleNavigation = () => {
    const nextUrl = window.location.href;
    if (nextUrl === currentUrl) return;
    currentUrl = nextUrl;
    resolveTargets(nextUrl);
  };

  const installNavigationHooks = () => {
    const methods = ['pushState', 'replaceState'];
    methods.forEach((method) => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('ig-ext-url-change'));
        return result;
      };
    });
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('ig-ext-url-change')));
    window.addEventListener('ig-ext-url-change', handleNavigation);
  };

  const init = () => {
    installNavigationHooks();
    handleNavigation();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
