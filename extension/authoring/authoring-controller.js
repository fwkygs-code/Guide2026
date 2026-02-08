/**
 * ADMIN AUTHORING CONTROLLER
 * Product layer for creating walkthroughs interactively
 * Builds ON TOP of locked v1.0.0 engine (no engine modifications)
 */

const AuthoringState = {
  IDLE: 'idle',
  CREATING_WALKTHROUGH: 'creating_walkthrough',
  PICKING_ELEMENT: 'picking_element',
  CONFIGURING_STEP: 'configuring_step',
  REVIEWING: 'reviewing',
  TESTING: 'testing'
};

const WalkthroughStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

/**
 * Main authoring controller - manages the entire authoring lifecycle
 */
class AuthoringController {
  constructor() {
    this.state = AuthoringState.IDLE;
    this.currentWalkthrough = null;
    this.currentStepIndex = -1;
    this.pickedElement = null;
    this.selectorPreview = null;
    
    // UI references
    this.toolbar = null;
    this.stepEditor = null;
    this.walkthroughList = null;
  }

  /**
   * Initialize authoring mode
   * Called when admin clicks "Create Walkthrough"
   */
  async enterAuthoringMode() {
    if (this.state !== AuthoringState.IDLE) {
      console.warn('[IG Authoring] Already in authoring mode');
      return;
    }
    
    // Check admin permission
    const isAdmin = await this.checkAdminPermission();
    if (!isAdmin) {
      alert('Admin permission required');
      return;
    }
    
    this.state = AuthoringState.CREATING_WALKTHROUGH;
    
    // Show authoring UI
    this.showAuthoringToolbar();
    this.showWalkthroughList();
    
    // EMIT TELEMETRY: AUTHORING_START
    this.logTelemetry('AUTHORING_START', {
      mode: 'authoring',
      url: window.location.href
    });
    
    console.log('[IG Authoring] Entered authoring mode');
  }

  /**
   * Log telemetry event via background
   */
  async logTelemetry(eventType, data = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'TELEMETRY_LOG',
        eventType,
        data: {
          ...data,
          timestamp: Date.now(),
          sessionId: this.currentWalkthrough?.walkthroughId || 'unknown'
        }
      });
    } catch (e) {
      console.warn('[IG Authoring] Telemetry failed:', e);
    }
  }

  /**
   * Start creating a new walkthrough
   */
  async createNewWalkthrough(name, startUrl) {
    if (this.state !== AuthoringState.CREATING_WALKTHROUGH) {
      console.error('[IG Authoring] Not in creating state');
      return;
    }
    
    this.currentWalkthrough = {
      walkthroughId: crypto.randomUUID(),
      name: name,
      startUrl: startUrl,
      steps: [],
      status: WalkthroughStatus.DRAFT,
      createdBy: await this.getCurrentUser(),
      createdAt: Date.now(),
      version: 1
    };
    
    this.currentStepIndex = 0;
    
    // Save as draft
    await this.saveDraft();
    
    // Show step editor
    this.showStepEditor();
    
    console.log('[IG Authoring] Created walkthrough:', this.currentWalkthrough.walkthroughId);
    return this.currentWalkthrough;
  }

  /**
   * Enter element picking mode
   * Admin clicks "Add Step" then clicks on page element
   */
  async startElementPicking() {
    if (!this.currentWalkthrough) {
      console.error('[IG Authoring] No active walkthrough');
      return;
    }
    
    this.state = AuthoringState.PICKING_ELEMENT;
    
    // Enable element picker (reuses existing picker from contentScript.js)
    window.elementPickerEnabled = true;
    document.body.style.cursor = 'crosshair';
    
    // Show picking indicator
    this.showPickingOverlay();
    
    // Listen for element picks
    this.pickingListener = (event) => {
      if (!window.elementPickerEnabled) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      const element = event.target;
      this.onElementPicked(element);
    };
    
    document.addEventListener('click', this.pickingListener, true);
    
    console.log('[IG Authoring] Element picking started');
  }

  /**
   * Handle element pick
   */
  async onElementPicked(element) {
    // Disable picker
    window.elementPickerEnabled = false;
    document.body.style.cursor = '';
    document.removeEventListener('click', this.pickingListener, true);
    
    // Generate selector for picked element
    const selector = this.generateSelector(element);
    this.pickedElement = element;
    this.selectorPreview = selector;
    
    // Calculate stability score
    const stability = this.calculateStabilityScore(selector);
    
    // Show step configuration
    this.state = AuthoringState.CONFIGURING_STEP;
    this.showStepConfiguration(selector, stability);
    
    console.log('[IG Authoring] Element picked:', selector);
  }

  /**
   * Save current step configuration
   */
  async saveStep(stepConfig) {
    if (!this.currentWalkthrough) return;
    
    const step = {
      id: crypto.randomUUID(),
      order: this.currentWalkthrough.steps.length,
      urlScope: {
        type: 'url_pattern',
        value: window.location.href
      },
      targetSelectors: {
        primary: stepConfig.selector,
        fallbacks: stepConfig.fallbacks || []
      },
      instruction: stepConfig.instruction,
      actionType: stepConfig.actionType || 'click',
      validation: stepConfig.validation || { rule: 'clicked' },
      ui: {
        tooltipPosition: stepConfig.tooltipPosition || 'bottom',
        allowSkip: stepConfig.allowSkip || false,
        highlightPadding: stepConfig.highlightPadding || 8
      },
      isOptional: stepConfig.isOptional || false,
      preconditions: stepConfig.preconditions || [],
      domFingerprint: stepConfig.domFingerprint || this.generateDomFingerprint(stepConfig.selector)
    };
    
    this.currentWalkthrough.steps.push(step);
    
    // Save draft
    await this.saveDraft();
    
    // EMIT TELEMETRY: STEP_CREATED
    this.logTelemetry('STEP_CREATED', {
      stepId: step.id,
      stepOrder: step.order,
      selectorType: step.targetSelectors?.primary?.type,
      hasFallbacks: step.targetSelectors?.fallbacks?.length > 0
    });
    
    // Reset for next step
    this.pickedElement = null;
    this.selectorPreview = null;
    
    console.log('[IG Authoring] Step saved:', step.id);
    return step;
  }

  /**
   * Finish and publish walkthrough
   */
  async publishWalkthrough() {
    if (!this.currentWalkthrough) return;
    
    // Validate all steps
    const validation = await this.validateWalkthrough();
    if (!validation.valid) {
      alert('Cannot publish: ' + validation.errors.join(', '));
      return;
    }
    
    // Check minimum requirements
    if (this.currentWalkthrough.steps.length === 0) {
      alert('Cannot publish: No steps defined');
      return;
    }
    
    // Update status
    this.currentWalkthrough.status = WalkthroughStatus.PUBLISHED;
    this.currentWalkthrough.publishedAt = Date.now();
    
    // Save to published storage
    await this.savePublished();
    
    // Clear draft
    await this.clearDraft();
    
    // EMIT TELEMETRY: WALKTHROUGH_PUBLISHED
    this.logTelemetry('WALKTHROUGH_PUBLISHED', {
      walkthroughId: this.currentWalkthrough.walkthroughId,
      stepCount: this.currentWalkthrough.steps.length,
      publishedAt: this.currentWalkthrough.publishedAt
    });
    
    // Reset state
    this.state = AuthoringState.IDLE;
    this.currentWalkthrough = null;
    this.currentStepIndex = -1;
    
    // Hide authoring UI
    this.hideAuthoringToolbar();
    this.hideStepEditor();
    
    console.log('[IG Authoring] Walkthrough published');
    alert('Walkthrough published successfully!');
  }

  /**
   * Save as draft
   */
  async saveDraft() {
    if (!this.currentWalkthrough) return;
    
    await chrome.storage.local.set({
      [`ig_draft_walkthrough_${this.currentWalkthrough.walkthroughId}`]: this.currentWalkthrough
    });
  }

  /**
   * Save published walkthrough
   */
  async savePublished() {
    if (!this.currentWalkthrough) return;
    
    // Get existing published walkthroughs
    const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
    const published = stored.ig_published_walkthroughs || {};
    
    // Add/update this walkthrough
    published[this.currentWalkthrough.walkthroughId] = this.currentWalkthrough;
    
    await chrome.storage.local.set({
      ig_published_walkthroughs: published
    });
  }

  /**
   * Clear draft
   */
  async clearDraft() {
    if (!this.currentWalkthrough) return;
    
    await chrome.storage.local.remove([
      `ig_draft_walkthrough_${this.currentWalkthrough.walkthroughId}`
    ]);
  }

  /**
   * Load all walkthroughs for admin
   */
  async loadWalkthroughs() {
    const [drafts, published] = await Promise.all([
      this.loadDrafts(),
      this.loadPublished()
    ]);
    
    return {
      drafts,
      published,
      all: [...drafts, ...published]
    };
  }

  /**
   * Load draft walkthroughs
   */
  async loadDrafts() {
    const all = await chrome.storage.local.get(null);
    const drafts = [];
    
    for (const key of Object.keys(all)) {
      if (key.startsWith('ig_draft_walkthrough_')) {
        drafts.push(all[key]);
      }
    }
    
    return drafts;
  }

  /**
   * Load published walkthroughs
   */
  async loadPublished() {
    const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
    const published = stored.ig_published_walkthroughs || {};
    return Object.values(published);
  }

  /**
   * Validate walkthrough before publishing
   */
  async validateWalkthrough() {
    if (!this.currentWalkthrough) {
      return { valid: false, errors: ['No walkthrough'] };
    }
    
    const errors = [];
    const warnings = [];
    
    // Check each step
    for (const step of this.currentWalkthrough.steps) {
      // Validate selector stability
      const stability = this.calculateStabilityScore(step.targetSelectors.primary);
      if (stability < 0.5) {
        warnings.push(`Step ${step.order + 1} has low selector stability`);
      }
      
      // Check for instruction
      if (!step.instruction || step.instruction.length < 10) {
        errors.push(`Step ${step.order + 1} needs clearer instruction`);
      }
      
      // Check URL scope
      if (!step.urlScope || !step.urlScope.value) {
        errors.push(`Step ${step.order + 1} missing URL scope`);
      }
      
      // Check DOM fingerprint if available
      if (step.domFingerprint) {
        const currentFingerprint = this.generateDomFingerprint(step.targetSelectors.primary);
        if (currentFingerprint && !this.fingerprintsMatch(step.domFingerprint, currentFingerprint)) {
          warnings.push(`Step ${step.order + 1}: DOM structure may have changed since creation`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canPublish: errors.length === 0
    };
  }

  /**
   * Generate selector for element
   */
  generateSelector(element) {
    // Try ID first
    if (element.id) {
      return {
        type: 'css_id',
        value: `#${element.id}`,
        raw: element.id
      };
    }
    
    // Try data-testid
    if (element.dataset.testid) {
      return {
        type: 'test_id',
        value: `[data-testid="${element.dataset.testid}"]`,
        raw: element.dataset.testid
      };
    }
    
    // Try aria-label
    if (element.getAttribute('aria-label')) {
      return {
        type: 'aria_label',
        value: `[aria-label="${element.getAttribute('aria-label')}"]`,
        raw: element.getAttribute('aria-label')
      };
    }
    
    // Try unique class
    if (element.className && !element.className.includes(' ')) {
      return {
        type: 'css_class',
        value: `.${element.className}`,
        raw: element.className
      };
    }
    
    // Fall back to CSS path
    const path = this.getElementPath(element);
    return {
      type: 'css_path',
      value: path,
      raw: path
    };
  }

  /**
   * Get CSS path for element
   */
  getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c).join('.');
        if (classes) selector += `.${classes}`;
      }
      
      const siblings = Array.from(current.parentNode?.children || []);
      const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
    }
    
    return path.join(' > ');
  }

  /**
   * Calculate selector stability score
   */
  calculateStabilityScore(selector) {
    const scores = {
      'css_id': 1.0,
      'test_id': 1.0,
      'aria_label': 0.95,
      'css_class': 0.5,
      'css_path': 0.3,
      'xpath': 0.3,
      'text_match': 0.4
    };
    
    // Check for dynamic classes
    if (selector.type === 'css_class') {
      const isHash = /[a-z0-9]{5,}/.test(selector.raw);
      if (isHash) return 0.3;
    }
    
    // Check for long paths
    if (selector.type === 'css_path') {
      const depth = selector.value.split('>').length;
      if (depth > 3) return 0.3;
    }
    
    return scores[selector.type] || 0.5;
  }

  /**
   * Check admin permission
   */
  async checkAdminPermission() {
    const stored = await chrome.storage.local.get(['ig_walkthrough_admin_mode']);
    return stored.ig_walkthrough_admin_mode === true;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    // In real implementation, this would come from auth
    return 'admin-user';
  }

  /**
   * Generate DOM fingerprint for selector stability tracking
   */
  generateDomFingerprint(selector) {
    try {
      const element = document.querySelector(selector.value);
      if (!element) return null;
      
      return {
        tagName: element.tagName,
        classList: Array.from(element.classList).slice(0, 5),
        parentTag: element.parentElement?.tagName,
        siblingCount: element.parentElement?.children.length,
        hasId: !!element.id,
        hasTestId: !!element.dataset.testid,
        timestamp: Date.now()
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Compare two DOM fingerprints
   */
  fingerprintsMatch(a, b) {
    if (!a || !b) return false;
    return a.tagName === b.tagName && 
           a.hasId === b.hasId && 
           a.hasTestId === b.hasTestId;
  }

  // UI Methods
  showAuthoringToolbar() {
    // Implemented in admin-toolbar.js
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.show();
    }
  }

  hideAuthoringToolbar() {
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.hide();
    }
  }

  showWalkthroughList() {
    // Load and display walkthrough list
    this.loadWalkthroughs().then(walkthroughs => {
      if (window.AuthoringToolbar) {
        window.AuthoringToolbar.setWalkthroughList(walkthroughs);
      }
    });
  }

  showStepEditor() {
    if (window.StepEditor) {
      window.StepEditor.show(this.currentWalkthrough);
    }
  }

  hideStepEditor() {
    if (window.StepEditor) {
      window.StepEditor.hide();
    }
  }

  showStepConfiguration(selector, stability) {
    if (window.StepEditor) {
      window.StepEditor.showConfiguration(selector, stability);
    }
  }

  showPickingOverlay() {
    // Show "Click an element" indicator
    const overlay = document.createElement('div');
    overlay.id = 'ig-authoring-picking-indicator';
    overlay.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #4f46e5;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    overlay.innerHTML = '🖱️ Click any element to select it';
    document.body.appendChild(overlay);
    
    // Remove on next click
    this.pickingCleanup = () => {
      overlay.remove();
    };
  }

  exitAuthoringMode() {
    this.state = AuthoringState.IDLE;
    this.currentWalkthrough = null;
    this.currentStepIndex = -1;
    this.pickedElement = null;
    this.selectorPreview = null;
    
    this.hideAuthoringToolbar();
    this.hideStepEditor();
    
    if (this.pickingCleanup) {
      this.pickingCleanup();
      this.pickingCleanup = null;
    }
    
    console.log('[IG Authoring] Exited authoring mode');
  }
}

// Global instance
window.authoringController = new AuthoringController();
