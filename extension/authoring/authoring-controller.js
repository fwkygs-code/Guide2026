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
    
    // Persist across URL changes
    this.initializePersistence();
  }
  
  /**
   * Initialize persistence across URL changes
   */
  initializePersistence() {
    // Check for active authoring session on load
    this.checkActiveAuthoringSession();
    
    // Listen for URL changes
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.onUrlChange();
      }
    };
    
    // Use multiple methods to detect URL changes
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('hashchange', checkUrlChange);
    
    // Also check periodically for SPA navigation
    setInterval(checkUrlChange, 1000);
  }
  
  /**
   * Check for active authoring session
   */
  async checkActiveAuthoringSession() {
    try {
      const stored = await chrome.storage.local.get(['ig_active_authoring_session']);
      if (stored.ig_active_authoring_session) {
        const session = stored.ig_active_authoring_session;
        
        // Restore session if recent (within 30 minutes)
        if (Date.now() - session.timestamp < 30 * 60 * 1000) {
          this.currentWalkthrough = session.walkthrough;
          this.state = AuthoringState.CONFIGURING_STEP;
          
          // Show UI
          this.showAuthoringToolbar();
          this.showStepEditor();
          
          console.log('[IG Authoring] Restored active session');
        } else {
          // Clear old session
          chrome.storage.local.remove(['ig_active_authoring_session']);
        }
      }
    } catch (e) {
      console.error('[IG Authoring] Failed to check session:', e);
    }
  }
  
  /**
   * Save active authoring session
   */
  async saveActiveSession() {
    if (this.currentWalkthrough && this.state !== AuthoringState.IDLE) {
      await chrome.storage.local.set({
        ig_active_authoring_session: {
          walkthrough: this.currentWalkthrough,
          state: this.state,
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle URL change during authoring
   */
  onUrlChange() {
    if (this.state !== AuthoringState.IDLE && this.currentWalkthrough) {
      console.log('[IG Authoring] URL changed, preserving session');
      
      // Save session
      this.saveActiveSession();
      
      // Re-show UI if it was hidden
      setTimeout(() => {
        if (this.state !== AuthoringState.IDLE) {
          this.showAuthoringToolbar();
          if (this.state === AuthoringState.CONFIGURING_STEP) {
            this.showStepEditor();
          }
        }
      }, 500);
    }
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
    
    // Auto-enable admin mode if not set
    await chrome.storage.local.set({ 'ig_walkthrough_admin_mode': true });
    console.log('[IG Authoring] Admin mode auto-enabled');
    
    // Check admin permission
    const isAdmin = await this.checkAdminPermission();
    if (!isAdmin) {
      alert('Admin permission required');
      return;
    }
    
    // Try to restore active session first
    const restored = await this.restoreActiveSession();
    
    if (!restored) {
      this.state = AuthoringState.CREATING_WALKTHROUGH;
    }
    
    // Show authoring UI
    this.showAuthoringToolbar();
    
    if (!this.currentWalkthrough) {
      this.showWalkthroughList();
    } else {
      this.showStepEditor();
    }
    
    // EMIT TELEMETRY: AUTHORING_START
    this.logTelemetry('AUTHORING_START', {
      mode: 'authoring',
      url: window.location.href
    });
    
    console.log('[IG Authoring] Entered authoring mode');
  }
  
  /**
   * Restore active session from storage
   */
  async restoreActiveSession() {
    try {
      const stored = await chrome.storage.local.get(['ig_active_authoring_session']);
      const session = stored.ig_active_authoring_session;
      
      if (session && session.walkthroughId) {
        console.log('[IG Authoring] Restoring active session:', session);
        
        // Load walkthrough from storage
        const walkthroughs = await this.loadWalkthroughs();
        const walkthrough = walkthroughs.all.find(w => w.walkthroughId === session.walkthroughId);
        
        if (walkthrough) {
          this.currentWalkthrough = walkthrough;
          this.currentStepIndex = session.currentStepIndex || -1;
          this.state = AuthoringState.CONFIGURING_STEP;
          console.log('[IG Authoring] Restored walkthrough:', walkthrough.walkthroughId);
          return true;
        }
      }
    } catch (e) {
      console.error('[IG Authoring] Failed to restore session:', e);
    }
    
    return false;
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
    await this.saveActiveSession();
    
    // Update toolbar with current walkthrough
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.setCurrentWalkthrough(this.currentWalkthrough);
    }
    
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
    
    // Hide UI panels while picking
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.hide();
    }
    if (window.StepEditor) {
      window.StepEditor.hide();
    }
    
    // Disable old picker if it's active
    const oldPickerOverlay = document.querySelector('.ig-picker-overlay');
    if (oldPickerOverlay) {
      oldPickerOverlay.style.display = 'none';
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
    
    // Restore UI panels
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.show();
    }
    if (window.StepEditor) {
      window.StepEditor.show(this.currentWalkthrough);
    }
    
    console.log('[IG Authoring] Element picked:', selector);
  }

  /**
   * Save current step configuration
   */
  async saveStep(stepConfig) {
    if (!this.currentWalkthrough) return;
    
    console.log('[IG Authoring] Saving step:', stepConfig);
    
    const step = {
      id: crypto.randomUUID(),
      order: this.currentWalkthrough.steps.length,
      urlScope: {
        type: 'page',
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
    
    console.log('[IG Authoring] Walkthrough now has', this.currentWalkthrough.steps.length, 'steps');
    
    // Save draft
    await this.saveDraft();
    
    // Save active session for persistence
    await this.saveActiveSession();
    
    // EMIT TELEMETRY: STEP_CREATED
    this.logTelemetry('STEP_CREATED', {
      stepId: step.id,
      stepOrder: step.order,
      selectorType: step.targetSelectors?.primary?.type,
      hasFallbacks: step.targetSelectors?.fallbacks?.length > 0
    });
    
    // Show success feedback
    this.showStepSavedFeedback();
    
    // Reset for next step
    this.pickedElement = null;
    this.selectorPreview = null;
    
    console.log('[IG Authoring] Step saved:', step.id);
    return step;
  }
  
  /**
   * Show feedback when step is saved
   */
  showStepSavedFeedback() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #22c55e;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 2147483647;
      animation: ig-slide-up 0.3s ease;
    `;
    feedback.textContent = '✓ Step saved successfully';
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ig-slide-up {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(feedback);
    
    // Remove after 2 seconds
    setTimeout(() => {
      feedback.style.animation = 'ig-slide-up 0.3s ease reverse';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  /**
   * Finish and publish walkthrough
   */
  async publishWalkthrough() {
    console.log('[IG Authoring] Publish walkthrough called');
    console.log('[IG Authoring] Current walkthrough:', this.currentWalkthrough);
    
    if (!this.currentWalkthrough) {
      console.error('[IG Authoring] No current walkthrough to publish');
      alert('No walkthrough to publish');
      return;
    }
    
    // Validate all steps
    const validation = await this.validateWalkthrough();
    if (!validation.valid) {
      console.error('[IG Authoring] Validation failed:', validation.errors);
      alert('Cannot publish: ' + validation.errors.join(', '));
      return;
    }
    
    // Check minimum requirements
    if (this.currentWalkthrough.steps.length === 0) {
      console.error('[IG Authoring] No steps defined');
      alert('Cannot publish: No steps defined');
      return;
    }
    
    console.log('[IG Authoring] Publishing walkthrough with', this.currentWalkthrough.steps.length, 'steps');
    
    // Update status
    this.currentWalkthrough.status = WalkthroughStatus.PUBLISHED;
    this.currentWalkthrough.publishedAt = Date.now();
    
    console.log('[IG Authoring] Updated status to PUBLISHED');
    
    // Save to published storage
    await this.savePublished();
    console.log('[IG Authoring] Saved to published storage');
    
    // Clear draft
    await this.clearDraft();
    console.log('[IG Authoring] Cleared draft');
    
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
    
    console.log('[IG Authoring] Walkthrough published successfully');
    alert('Walkthrough published successfully!');
    
    // Exit authoring mode after successful publish
    setTimeout(() => {
      this.exitAuthoringMode();
    }, 1000);
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
    console.log('[IG Authoring] Loading walkthroughs...');
    
    const [drafts, published] = await Promise.all([
      this.loadDrafts(),
      this.loadPublished()
    ]);
    
    console.log('[IG Authoring] Loaded walkthroughs:', {
      drafts: drafts.length,
      published: published.length,
      all: [...drafts, ...published].length
    });
    
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
    
    console.log('[IG Authoring] All storage keys:', Object.keys(all));
    
    for (const key of Object.keys(all)) {
      if (key.startsWith('ig_draft_walkthrough_')) {
        console.log('[IG Authoring] Found draft:', key);
        drafts.push(all[key]);
      }
    }
    
    console.log('[IG Authoring] Draft walkthroughs:', drafts);
    return drafts;
  }

  /**
   * Load published walkthroughs
   */
  async loadPublished() {
    const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
    const published = stored.ig_published_walkthroughs || {};
    const publishedArray = Object.values(published);
    
    console.log('[IG Authoring] Published walkthroughs:', publishedArray);
    return publishedArray;
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
    if (!selector) {
      console.warn('[IG Authoring] No selector provided for stability calculation');
      return 0.1; // Very low score for missing selector
    }
    
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
    console.log('[IG Authoring] Admin permission check:', stored.ig_walkthrough_admin_mode);
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
    // Show toolbar and connect events
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.show();
      
      // Connect event handlers
      window.AuthoringToolbar.onCreateClick = (name, url) => {
        this.createNewWalkthrough(name, url);
      };
      
      window.AuthoringToolbar.onEditClick = (walkthroughId) => {
        this.editWalkthrough(walkthroughId);
      };
      
      window.AuthoringToolbar.onPublishClick = (walkthroughId) => {
        this.publishWalkthroughById(walkthroughId);
      };
      
      window.AuthoringToolbar.onTestClick = (walkthroughId) => {
        this.testWalkthrough(walkthroughId);
      };
      
      window.AuthoringToolbar.onDeleteClick = (walkthroughId) => {
        this.deleteWalkthrough(walkthroughId);
      };
      
      window.AuthoringToolbar.onStepEdit = (index) => {
        this.editStep(index);
      };
      
      window.AuthoringToolbar.onStepDelete = (index) => {
        this.deleteStep(index);
      };
      
      // Override close button to properly exit
      const closeBtn = window.AuthoringToolbar.element?.querySelector('#ig-toolbar-close');
      if (closeBtn) {
        // Remove existing listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        // Add proper exit handler
        newCloseBtn.addEventListener('click', () => {
          if (confirm('Exit authoring mode? Any unsaved changes will be lost.')) {
            this.exitAuthoringMode();
          }
        });
      }
      
      // Add minimize button listener
      const minimizeBtn = window.AuthoringToolbar.element?.querySelector('#ig-toolbar-minimize');
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
          window.AuthoringToolbar.toggleMinimize();
        });
      }
      
      // Add create walkthrough button listener
      const createBtn = window.AuthoringToolbar.element?.querySelector('#ig-create-walkthrough');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          window.AuthoringToolbar.showCreateModal();
        });
      }
      
      // Add publish walkthrough button listener
      const publishBtn = window.AuthoringToolbar.element?.querySelector('#ig-publish-walkthrough');
      if (publishBtn) {
        publishBtn.addEventListener('click', () => {
          if (window.AuthoringController) {
            window.AuthoringController.publishWalkthrough();
          }
        });
      }
      
      // Add exit admin mode button listener
      const exitAdminBtn = window.AuthoringToolbar.element?.querySelector('#ig-exit-admin');
      if (exitAdminBtn) {
        exitAdminBtn.addEventListener('click', () => {
          if (window.AuthoringController) {
            window.AuthoringController.exitAuthoringMode();
          }
        });
      }
      
      // Add steps overview listeners
      const viewStepsBtn = window.AuthoringToolbar.element?.querySelector('#ig-view-steps');
      if (viewStepsBtn) {
        viewStepsBtn.addEventListener('click', () => {
          window.AuthoringToolbar.showStepsOverview();
        });
      }
      
      const closeStepsBtn = window.AuthoringToolbar.element?.querySelector('#ig-close-steps');
      if (closeStepsBtn) {
        closeStepsBtn.addEventListener('click', () => {
          window.AuthoringToolbar.hideStepsOverview();
        });
      }
      
      // Update toolbar with current walkthrough
      if (this.currentWalkthrough) {
        window.AuthoringToolbar.setCurrentWalkthrough(this.currentWalkthrough);
      }
    }
  }

  hideAuthoringToolbar() {
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.hide();
    }
  }

  showWalkthroughList() {
    console.log('[IG Authoring] Showing walkthrough list...');
    // Load and display walkthrough list
    this.loadWalkthroughs().then(walkthroughs => {
      console.log('[IG Authoring] Walkthroughs to display:', walkthroughs);
      if (window.AuthoringToolbar) {
        window.AuthoringToolbar.setWalkthroughList(walkthroughs);
      } else {
        console.error('[IG Authoring] AuthoringToolbar not available');
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
      background: #f59e0b;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: system-ui, sans-serif;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      font-size: 15px;
    `;
    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">🖱️</div>
        <div>
          <div style="font-weight: 700; margin-bottom: 2px;">Click any element to select it</div>
          <div style="font-size: 12px; opacity: 0.9;">This will be the target for your step</div>
        </div>
        <button id="ig-authoring-picker-cancel" style="
          margin-left: 12px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-weight: 500;
          font-size: 12px;
        ">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Add cancel handler
    document.getElementById('ig-authoring-picker-cancel').addEventListener('click', () => {
      this.stopElementPicking();
    });
    
    // Remove on next click
    this.pickingCleanup = () => {
      overlay.remove();
    };
  }
  
  /**
   * Stop element picking
   */
  stopElementPicking() {
    if (this.pickingListener) {
      document.removeEventListener('click', this.pickingListener, true);
      this.pickingListener = null;
    }
    
    window.elementPickerEnabled = false;
    document.body.style.cursor = '';
    
    // Restore old picker if it was hidden
    const oldPickerOverlay = document.querySelector('.ig-picker-overlay');
    if (oldPickerOverlay) {
      oldPickerOverlay.style.display = '';
    }
    
    // Restore UI panels
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.show();
    }
    if (window.StepEditor) {
      window.StepEditor.show(this.currentWalkthrough);
    }
    
    if (this.pickingCleanup) {
      this.pickingCleanup();
      this.pickingCleanup = null;
    }
    
    this.state = AuthoringState.CONFIGURING_STEP;
    console.log('[IG Authoring] Element picking stopped');
  }

  exitAuthoringMode() {
    this.state = AuthoringState.IDLE;
    this.currentWalkthrough = null;
    this.currentStepIndex = -1;
    this.pickedElement = null;
    this.selectorPreview = null;
    
    // Clear active session
    chrome.storage.local.remove(['ig_active_authoring_session']);
    
    // Clear admin mode when exiting authoring (with delay to ensure proper state)
    setTimeout(() => {
      chrome.storage.local.remove(['ig_walkthrough_admin_mode']);
      
      // Trigger launcher recheck after clearing admin mode
      if (window.onboardingLauncher) {
        window.onboardingLauncher.init();
      }
    }, 500);
    
    this.hideAuthoringToolbar();
    this.hideStepEditor();
    
    if (this.pickingCleanup) {
      this.pickingCleanup();
      this.pickingCleanup = null;
    }
    
    console.log('[IG Authoring] Exited authoring mode');
  }
  
  /**
   * Edit existing walkthrough
   */
  async editWalkthrough(walkthroughId) {
    // Load walkthrough from storage
    const walkthroughs = await this.loadWalkthroughs();
    const walkthrough = walkthroughs.all.find(w => w.walkthroughId === walkthroughId);
    
    if (!walkthrough) {
      console.error('[IG Authoring] Walkthrough not found:', walkthroughId);
      return;
    }
    
    this.currentWalkthrough = walkthrough;
    this.state = AuthoringState.CONFIGURING_STEP;
    
    // Show authoring UI
    this.showAuthoringToolbar();
    this.showStepEditor();
    
    // Update toolbar with current walkthrough
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.setCurrentWalkthrough(this.currentWalkthrough);
    }
    
    console.log('[IG Authoring] Editing walkthrough:', walkthroughId);
  }
  
  /**
   * Edit existing step
   */
  async editStep(index) {
    console.log('[IG Authoring] Editing step:', index, 'total steps:', this.currentWalkthrough?.steps?.length);
    
    if (!this.currentWalkthrough || index < 0 || index >= this.currentWalkthrough.steps.length) {
      console.error('[IG Authoring] Invalid step index:', index);
      return;
    }
    
    const step = this.currentWalkthrough.steps[index];
    console.log('[IG Authoring] Step data:', step);
    
    this.currentStepIndex = index;
    
    // Load step data into step editor
    if (window.StepEditor) {
      window.StepEditor.currentSelector = step.targetSelectors?.primary;
      window.StepEditor.isMultiField = step.isMultiField || false;
      window.StepEditor.fieldSelectors = step.isMultiField ? (step.fields || []) : [];
      
      // Show step editor with loaded data
      window.StepEditor.show(this.currentWalkthrough);
      window.StepEditor.showConfiguration(step.targetSelectors?.primary, 0.8);
      
      // Update form fields
      const instruction = window.StepEditor.element.querySelector('#ig-instruction');
      const actionType = window.StepEditor.element.querySelector('#ig-action-type');
      const validation = window.StepEditor.element.querySelector('#ig-validation');
      const allowSkip = window.StepEditor.element.querySelector('#ig-allow-skip');
      const isOptional = window.StepEditor.element.querySelector('#ig-is-optional');
      const multiField = window.StepEditor.element.querySelector('#ig-multi-field');
      
      console.log('[IG Authoring] Form elements found:', {
        instruction: !!instruction,
        actionType: !!actionType,
        validation: !!validation,
        allowSkip: !!allowSkip,
        isOptional: !!isOptional,
        multiField: !!multiField
      });
      
      if (instruction) {
        instruction.value = step.instruction || '';
        console.log('[IG Authoring] Set instruction to:', step.instruction);
      }
      if (actionType) {
        actionType.value = step.actionType || 'click';
        console.log('[IG Authoring] Set actionType to:', step.actionType);
      }
      if (validation) {
        validation.value = step.validation?.rule || 'clicked';
        console.log('[IG Authoring] Set validation to:', step.validation?.rule);
      }
      if (allowSkip) {
        allowSkip.checked = step.ui?.allowSkip || false;
        console.log('[IG Authoring] Set allowSkip to:', step.ui?.allowSkip);
      }
      if (isOptional) {
        isOptional.checked = step.isOptional || false;
        console.log('[IG Authoring] Set isOptional to:', step.isOptional);
      }
      if (multiField) {
        multiField.checked = step.isMultiField || false;
        multiField.dispatchEvent(new Event('change'));
        console.log('[IG Authoring] Set multiField to:', step.isMultiField);
      }
      
      window.StepEditor.renderFieldList();
    }
    
    console.log('[IG Authoring] Editing step:', index);
  }
  
  /**
   * Delete step
   */
  async deleteStep(index) {
    if (!this.currentWalkthrough || index < 0 || index >= this.currentWalkthrough.steps.length) {
      console.error('[IG Authoring] Invalid step index:', index);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this step?')) {
      return;
    }
    
    // Remove step
    this.currentWalkthrough.steps.splice(index, 1);
    
    // Reorder remaining steps
    this.currentWalkthrough.steps.forEach((step, i) => {
      step.order = i;
    });
    
    // Save draft
    await this.saveDraft();
    await this.saveActiveSession();
    
    // Update UI
    if (window.AuthoringToolbar) {
      window.AuthoringToolbar.setCurrentWalkthrough(this.currentWalkthrough);
    }
    
    // If we deleted the current step being edited, reset step editor
    if (this.currentStepIndex === index) {
      this.currentStepIndex = -1;
      if (window.StepEditor) {
        window.StepEditor.resetForm();
      }
    } else if (this.currentStepIndex > index) {
      this.currentStepIndex--;
    }
    
    console.log('[IG Authoring] Deleted step:', index);
  }
  
  /**
   * Publish walkthrough by ID
   */
  async publishWalkthroughById(walkthroughId) {
    // Load walkthrough
    const walkthroughs = await this.loadWalkthroughs();
    const walkthrough = walkthroughs.all.find(w => w.walkthroughId === walkthroughId);
    
    if (!walkthrough) {
      console.error('[IG Authoring] Walkthrough not found:', walkthroughId);
      return;
    }
    
    this.currentWalkthrough = walkthrough;
    await this.publishWalkthrough();
  }
  
  /**
   * Delete walkthrough by ID
   */
  async deleteWalkthrough(walkthroughId) {
    if (!confirm('Are you sure you want to delete this walkthrough? This action cannot be undone.')) {
      return;
    }
    
    console.log('[IG Authoring] Deleting walkthrough:', walkthroughId);
    
    try {
      // Remove from draft storage
      await chrome.storage.local.remove([`ig_draft_walkthrough_${walkthroughId}`]);
      
      // Remove from published storage if it exists
      const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
      const published = stored.ig_published_walkthroughs || {};
      if (published[walkthroughId]) {
        delete published[walkthroughId];
        await chrome.storage.local.set({ ig_published_walkthroughs: published });
      }
      
      // Clear active session if it's the current walkthrough
      if (this.currentWalkthrough?.walkthroughId === walkthroughId) {
        await chrome.storage.local.remove(['ig_active_authoring_session']);
        this.currentWalkthrough = null;
        this.currentStepIndex = -1;
        this.state = AuthoringState.IDLE;
        this.hideStepEditor();
      }
      
      // Refresh the walkthrough list
      this.showWalkthroughList();
      
      console.log('[IG Authoring] Walkthrough deleted successfully');
      alert('Walkthrough deleted successfully');
    } catch (e) {
      console.error('[IG Authoring] Failed to delete walkthrough:', e);
      alert('Failed to delete walkthrough');
    }
  }
  
  /**
   * Test walkthrough
   */
  async testWalkthrough(walkthroughId) {
    console.log('[IG Authoring] Testing walkthrough:', walkthroughId);
    
    // Initialize admin test mode if available
    if (window.AdminTestMode) {
      window.AdminTestMode.startTest(walkthroughId);
    } else {
      // Fallback: start the walkthrough directly
      const walkthroughs = await this.loadWalkthroughs();
      const walkthrough = walkthroughs.all.find(w => w.walkthroughId === walkthroughId);
      
      if (walkthrough) {
        // Send to background to start walkthrough
        chrome.runtime.sendMessage({
          type: 'WALKTHROUGH_START',
          walkthrough: walkthrough,
          progress: { currentStep: 0, completed: false }
        });
      }
    }
  }
}

// Global instance
window.AuthoringController = window.authoringController = new AuthoringController();
