  const ensureAdminPanel = () => {
    if (adminPanelRoot) return adminPanelRoot;
    const panel = document.createElement('div');
    panel.id = 'ig-ext-admin-panel';
    panel.innerHTML = `
      <style>
        #ig-ext-admin-panel {
          position: fixed;
          right: 24px;
          bottom: 86px;
          width: 280px;
          padding: 16px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.95);
          color: #fff;
          font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          box-shadow: 0 15px 30px rgba(2, 6, 23, 0.45);
          display: none;
          z-index: 2147483646;
        }
        #ig-ext-admin-panel h4 {
          margin: 0 0 8px;
          font-size: 16px;
        }
        #ig-ext-admin-panel label {
          display: block;
          margin: 8px 0 4px;
          font-size: 13px;
          color: #cbd5f5;
        }
        #ig-ext-admin-panel select,
        #ig-ext-admin-panel input {
          width: 100%;
          border-radius: 8px;
          border: 1px solid rgba(148,163,184,0.4);
          padding: 6px 8px;
          background: rgba(15,23,42,0.7);
          color: #fff;
          font-size: 13px;
        }
        #ig-ext-admin-panel button {
          width: 100%;
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          font-weight: 600;
          cursor: pointer;
        }
        #ig-ext-admin-panel .primary {
          background: linear-gradient(135deg,#7c3aed,#4338ca);
          color: #fff;
        }
        #ig-ext-admin-panel .secondary {
          background: rgba(15,23,42,0.6);
          color: #cbd5f5;
          border: 1px solid rgba(148,163,184,0.4);
        }
      </style>
      <h4>Admin target</h4>
      <label>URL rule</label>
      <div style="display:flex; gap:8px;">
        <select id="ig-ext-rule-type" style="flex:1;">
          <option value="exact">Exact</option>
          <option value="prefix">Prefix</option>
        </select>
        <input id="ig-ext-rule-value" placeholder="https://" />
      </div>
      <label>Selector</label>
      <div style="display:flex; gap:8px;">
        <input id="ig-ext-selector" placeholder="Click to pick" readonly />
        <button id="ig-ext-picker-btn" class="secondary" type="button" style="flex:0 0 80px;">Pick</button>
      </div>
      <label>Walkthrough</label>
      <select id="ig-ext-walkthrough"></select>
      <label>Step (optional)</label>
      <select id="ig-ext-step">
        <option value="">All steps</option>
      </select>
      <div style="display:flex; gap:8px;">
        <button id="ig-ext-cancel-admin" class="secondary" type="button">Cancel</button>
        <button id="ig-ext-save-admin" class="primary" type="button">Save</button>
      </div>
    `;
    document.documentElement.appendChild(panel);
    adminPanelRoot = panel;
    return panel;
  };

  const populateWalkthroughs = () => {
    const panel = ensureAdminPanel();
    const wSelect = panel.querySelector('#ig-ext-walkthrough');
    const stepSelect = panel.querySelector('#ig-ext-step');
    wSelect.innerHTML = '';
    adminWalkthroughs.forEach((wt) => {
      const option = document.createElement('option');
      option.value = wt.walkthrough_id;
      option.textContent = wt.title;
      wSelect.appendChild(option);
    });
    const first = adminWalkthroughs[0];
    wSelect.value = adminPanelState.walkthroughId || (first ? first.walkthrough_id : '');
    updateStepOptions();
  };

  const updateStepOptions = () => {
    const panel = ensureAdminPanel();
    const wSelect = panel.querySelector('#ig-ext-walkthrough');
    const stepSelect = panel.querySelector('#ig-ext-step');
    const selected = adminWalkthroughs.find((w) => w.walkthrough_id === wSelect.value);
    stepSelect.innerHTML = '<option value="">All steps</option>';
    if (selected) {
      selected.steps.forEach((step) => {
        const option = document.createElement('option');
        option.value = step.id;
        option.textContent = `${step.order + 1}. ${step.title}`;
        stepSelect.appendChild(option);
      });
    }
  };

  const showAdminPanel = async () => {
    if (!isAdminModeEnabled()) return;
    ensureAdminPanel();
    if (!adminWalkthroughs.length) {
      try {
        const response = await fetch(API_ADMIN_WALKTHROUGHS, { credentials: 'include' });
        if (response.ok) {
          adminWalkthroughs = await response.json();
        }
      } catch (_err) {
        adminWalkthroughs = [];
      }
    }

    populateWalkthroughs();
    const panel = ensureAdminPanel();
    const ruleType = panel.querySelector('#ig-ext-rule-type');
    const ruleValue = panel.querySelector('#ig-ext-rule-value');
    const selectorInput = panel.querySelector('#ig-ext-selector');
    const pickerBtn = panel.querySelector('#ig-ext-picker-btn');
    const wSelect = panel.querySelector('#ig-ext-walkthrough');
    const stepSelect = panel.querySelector('#ig-ext-step');
    const cancelBtn = panel.querySelector('#ig-ext-cancel-admin');
    const saveBtn = panel.querySelector('#ig-ext-save-admin');

    ruleType.value = adminPanelState.urlRuleType;
    ruleValue.value = adminPanelState.urlRuleValue;
    selectorInput.value = adminPanelState.selector || '';
    wSelect.value = adminPanelState.walkthroughId || wSelect.value;
    updateStepOptions();
    stepSelect.value = adminPanelState.stepId || '';

    const onRuleChange = () => {
      adminPanelState.urlRuleType = ruleType.value;
      adminPanelState.urlRuleValue = ruleValue.value;
    };
    ruleType.addEventListener('change', onRuleChange);
    ruleValue.addEventListener('input', onRuleChange);

    pickerBtn.onclick = () => {
      if (window.InterguideExtensionPicker?.isActive()) {
        window.InterguideExtensionPicker.cancel();
        selectorInput.value = '';
        adminPanelState.selector = null;
        return;
      }
      window.InterguideExtensionPicker?.start();
    };

    const onWalkthroughChange = () => {
      adminPanelState.walkthroughId = wSelect.value;
      adminPanelState.stepId = '';
      updateStepOptions();
    };
    const onStepChange = () => {
      adminPanelState.stepId = stepSelect.value;
    };
    wSelect.addEventListener('change', onWalkthroughChange);
    stepSelect.addEventListener('change', onStepChange);

    const cleanupPanel = () => {
      ruleType.removeEventListener('change', onRuleChange);
      ruleValue.removeEventListener('input', onRuleChange);
      wSelect.removeEventListener('change', onWalkthroughChange);
      stepSelect.removeEventListener('change', onStepChange);
      cancelBtn.onclick = null;
      saveBtn.onclick = null;
      pickerBtn.onclick = null;
    };

    cancelBtn.onclick = () => {
      cleanupPanel();
      window.InterguideExtensionPicker?.cancel();
      adminPanelRoot.style.display = 'none';
      adminPanelVisible = false;
    };

    saveBtn.onclick = async () => {
      if (!ruleValue.value.trim() || !wSelect.value) {
        ruleValue.focus();
        return;
      }

      const selectorValue = window.InterguideExtensionPicker?.getSelector?.() || selectorInput.value || null;
      adminPanelState.selector = selectorValue;

      const payload = {
        url_rule: {
          type: ruleType.value,
          value: ruleValue.value.trim(),
        },
        selector: selectorValue,
        walkthrough_id: wSelect.value,
        step_id: stepSelect.value || null,
      };

      try {
        const response = await fetch(API_EXTENSION_TARGETS, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          cleanupPanel();
          window.InterguideExtensionPicker?.cancel();
          adminPanelRoot.style.display = 'none';
          adminPanelVisible = false;
          adminPanelState = {
            urlRuleType: 'exact',
            urlRuleValue: '',
            selector: null,
            walkthroughId: '',
            stepId: '',
          };
          matches = [];
          await resolveTargets(currentUrl || window.location.href);
        }
      } catch (_err) {
        // Silent failure
      }
    };

    adminPanelVisible = true;
    adminPanelRoot.style.display = 'block';
  };
  const checkAdminStatus = async () => {
    try {
      const response = await fetch(API_AUTH_ME_ENDPOINT, { credentials: 'include' });
      if (!response.ok) {
        adminMode = false;
        return;
      }

      const data = await response.json();
      const role = (data?.role || '').toLowerCase();
      adminMode = role === 'manager' || role === 'admin' || role === 'owner';
      window.__IG_EXTENSION_ADMIN_MODE__ = adminMode;
    } catch {
      adminMode = false;
    }
  };

  const ensurePickerOverlay = () => {
    if (pickerOverlay) return pickerOverlay;
    const overlayEl = document.createElement('div');
    overlayEl.id = 'ig-ext-picker-overlay';
    overlayEl.style.position = 'fixed';
    overlayEl.style.pointerEvents = 'none';
    overlayEl.style.zIndex = '2147483647';
    overlayEl.style.border = '2px solid #00c4ff';
    overlayEl.style.borderRadius = '4px';
    overlayEl.style.background = 'rgba(0,196,255,0.15)';
    overlayEl.style.transition = 'all 80ms ease-out';
    overlayEl.style.display = 'none';
    document.documentElement.appendChild(overlayEl);
    pickerOverlay = overlayEl;
    return overlayEl;
  };

  const getElementSelector = (element) => {
    if (!element || element === document.body) return 'body';
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    const path = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let selector = current.nodeName.toLowerCase();
      if (current.classList.length) {
        selector += '.' + Array.from(current.classList)
          .map((cls) => CSS.escape(cls))
          .join('.');
      }

      const siblingIndex = (() => {
        let index = 1;
        let sibling = current;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          index += 1;
        }
        return index;
      })();

      selector += `:nth-of-type(${siblingIndex})`;
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  };

  const updatePickerOverlay = (target) => {
    const overlayEl = ensurePickerOverlay();
    if (!target) {
      overlayEl.style.display = 'none';
      pickerTarget = null;
      return;
    }
    const rect = target.getBoundingClientRect();
    overlayEl.style.display = 'block';
    overlayEl.style.left = `${rect.left + window.scrollX}px`;
    overlayEl.style.top = `${rect.top + window.scrollY}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;
    pickerTarget = target;
  };

  const handlePickerMove = (event) => {
    if (!pickerActive) return;
    const target = event.target;
    if (!target || target === pickerOverlay) return;
    updatePickerOverlay(target);
  };

  const handlePickerClick = (event) => {
    if (!pickerActive) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target || pickerTarget;
    if (!target) return;
    lastCapturedSelector = getElementSelector(target);
    window.__IG_EXTENSION_LAST_SELECTOR__ = lastCapturedSelector;
    stopElementPicker();
  };

  const handlePickerKeydown = (event) => {
    if (!pickerActive) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stopElementPicker();
    }
  };

  const attachPickerListeners = () => {
    if (pickerListenersAttached) return;
    pickerListenersAttached = true;
    document.addEventListener('mousemove', handlePickerMove, true);
    document.addEventListener('click', handlePickerClick, true);
    document.addEventListener('keydown', handlePickerKeydown, true);
  };

  const detachPickerListeners = () => {
    if (!pickerListenersAttached) return;
    pickerListenersAttached = false;
    document.removeEventListener('mousemove', handlePickerMove, true);
    document.removeEventListener('click', handlePickerClick, true);
    document.removeEventListener('keydown', handlePickerKeydown, true);
  };

  const startElementPicker = () => {
    if (!isAdminModeEnabled() || pickerActive) return;
    pickerActive = true;
    lastCapturedSelector = null;
    ensurePickerOverlay();
    updatePickerOverlay(null);
    attachPickerListeners();
  };

  const stopElementPicker = () => {
    if (!pickerActive) return;
    pickerActive = false;
    detachPickerListeners();
    updatePickerOverlay(null);
    if (pickerOverlay) {
      pickerOverlay.style.display = 'none';
    }
  };

  window.InterguideExtensionPicker = {
    start: startElementPicker,
    cancel: stopElementPicker,
    getSelector: () => lastCapturedSelector,
    isActive: () => pickerActive,
  };

(() => {
  const API_RESOLVE_ENDPOINT = 'https://api.interguide.app/api/extension/resolve';
  const API_RESOLVE_PUBLIC_ENDPOINT = 'https://api.interguide.app/api/extension/resolve-public';
  const API_AUTH_ME_ENDPOINT = 'https://api.interguide.app/api/auth/me';
  const API_ADMIN_WALKTHROUGHS = 'https://api.interguide.app/api/extension/admin/walkthroughs';
  const API_EXTENSION_TARGETS = 'https://api.interguide.app/api/extension/targets';
  const WALKTHROUGH_BASE_URL = 'https://www.interguide.app/portal/walkthrough';

  let currentUrl = null;
  let matches = [];
  let overlayRoot = null;
  let triggerButton = null;
  let overlay = null;
  let frame = null;
  let unauthorized = false;
  let adminMode = false;
  let pickerActive = false;
  let pickerOverlay = null;
  let pickerTarget = null;
  let pickerListenersAttached = false;
  let lastCapturedSelector = null;
  let adminPanelRoot = null;
  let adminWalkthroughs = [];
  let adminPanelVisible = false;
  let adminPanelState = {
    urlRuleType: 'exact',
    urlRuleValue: '',
    selector: null,
    walkthroughId: '',
    stepId: '',
  };

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

  const isAdminModeEnabled = () => {
    if (adminMode) return true;
    if (typeof window.__IG_EXTENSION_ADMIN_MODE__ === 'boolean') {
      return window.__IG_EXTENSION_ADMIN_MODE__;
    }
    try {
      return localStorage.getItem('ig-extension-admin-mode') === 'true';
    } catch {
      return false;
    }
  };

  const applyMatches = (data) => {
    matches = Array.isArray(data?.matches) ? data.matches.slice().sort((a, b) => {
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
  };

  const runAuthResolve = async (url) => {
    try {
      const response = await fetch(`${API_RESOLVE_ENDPOINT}?url=${encodeURIComponent(url)}`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        unauthorized = true;
        matches = [];
        hideButton();
        teardownOverlay();
        return true;
      }
      if (!response.ok) throw new Error('resolve_failed');
      const data = await response.json();
      applyMatches(data);
      return true;
    } catch {
      matches = [];
      hideButton();
      return false;
    }
  };

  const runPublicResolve = async (url) => {
    try {
      const response = await fetch(`${API_RESOLVE_PUBLIC_ENDPOINT}?url=${encodeURIComponent(url)}`);
      if (response.status === 401 || response.status === 403) {
        return { fallback: true };
      }
      if (!response.ok) throw new Error('public_resolve_failed');
      const data = await response.json();
      applyMatches(data);
      return { handled: true };
    } catch {
      matches = [];
      hideButton();
      return { handled: true };
    }
  };

  const resolveTargets = async (url) => {
    const adminMode = isAdminModeEnabled();
    if (unauthorized && !adminMode) return;

    if (!adminMode) {
      const publicResult = await runPublicResolve(url);
      if (publicResult?.handled && !publicResult?.fallback) {
        return;
      }
    }

    await runAuthResolve(url);
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

  const init = async () => {
    await checkAdminStatus();
    installNavigationHooks();
    handleNavigation();
    if (isAdminModeEnabled()) {
      window.__IG_EXTENSION_ADMIN_UI__ = {
        open: showAdminPanel,
        startPicker: () => window.InterguideExtensionPicker?.start(),
        cancelPicker: () => window.InterguideExtensionPicker?.cancel(),
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); }, { once: true });
  } else {
    init();
  }
})();
