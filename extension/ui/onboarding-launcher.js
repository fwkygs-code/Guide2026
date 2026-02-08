/**
 * ONBOARDING LAUNCHER
 * User-facing entry point for walkthroughs
 * Detects matching walkthroughs and offers/auto-starts them
 */

class OnboardingLauncher {
  constructor() {
    this.activeWalkthrough = null;
    this.userProgress = null;
    this.launcherElement = null;
    this.isVisible = false;
  }

  /**
   * Initialize launcher - check for applicable walkthroughs
   */
  async init() {
    // Check if user is admin (don't show launcher in authoring mode)
    const isAdmin = await this.checkAdminMode();
    if (isAdmin) return;

    // Find walkthroughs matching current URL
    const matchingWalkthroughs = await this.findMatchingWalkthroughs();
    
    if (matchingWalkthroughs.length === 0) return;

    // Check if user has already completed any
    const incompleteWalkthroughs = await this.filterIncomplete(matchingWalkthroughs);
    
    if (incompleteWalkthroughs.length === 0) return;

    // Show launcher for first matching walkthrough
    this.showLauncher(incompleteWalkthroughs[0]);
  }

  /**
   * Find walkthroughs that match current URL
   */
  async findMatchingWalkthroughs() {
    const currentUrl = window.location.href;
    
    // Get published walkthroughs from storage
    const stored = await chrome.storage.local.get(['ig_published_walkthroughs']);
    const published = stored.ig_published_walkthroughs || {};
    
    return Object.values(published).filter(w => {
      // Check if walkthrough is published
      if (w.status !== 'published') return false;
      
      // Check URL match
      return w.targetUrls.some(targetUrl => {
        if (targetUrl.includes('*')) {
          // Glob pattern matching
          const pattern = targetUrl.replace(/\*/g, '.*');
          return new RegExp(pattern).test(currentUrl);
        }
        
        // Simple includes matching
        return currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl);
      });
    });
  }

  /**
   * Filter out completed walkthroughs
   */
  async filterIncomplete(walkthroughs) {
    const userId = await this.getUserId();
    const incomplete = [];
    
    for (const walkthrough of walkthroughs) {
      const isCompleted = await window.walkthroughRepository.hasUserCompleted(
        userId, 
        walkthrough.walkthroughId
      );
      
      if (!isCompleted) {
        incomplete.push(walkthrough);
      }
    }
    
    return incomplete;
  }

  /**
   * Show onboarding launcher UI
   */
  showLauncher(walkthrough) {
    this.activeWalkthrough = walkthrough;
    
    if (walkthrough.settings?.autoStart) {
      // Auto-start after short delay
      setTimeout(() => this.startWalkthrough(), 1500);
      return;
    }

    // Show manual start button
    this.createLauncherUI(walkthrough);
  }

  /**
   * Create launcher UI element
   */
  createLauncherUI(walkthrough) {
    if (this.launcherElement) {
      this.launcherElement.remove();
    }

    this.launcherElement = document.createElement('div');
    this.launcherElement.id = 'ig-onboarding-launcher';
    this.launcherElement.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483640;
      width: 320px;
      overflow: hidden;
      animation: ig-slide-up 0.3s ease-out;
    `;

    // Add animation
    if (!document.getElementById('ig-launcher-styles')) {
      const style = document.createElement('style');
      style.id = 'ig-launcher-styles';
      style.textContent = `
        @keyframes ig-slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    this.launcherElement.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        padding: 20px;
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">🎯</div>
          <div>
            <div style="font-weight: 700; font-size: 16px;">${walkthrough.name}</div>
            <div style="font-size: 13px; opacity: 0.9;">${walkthrough.steps?.length || 0} steps</div>
          </div>
        </div>
        <div style="font-size: 14px; line-height: 1.5; opacity: 0.95;">
          ${walkthrough.description || 'Learn how to use this feature with a guided tour.'}
        </div>
      </div>
      
      <div style="padding: 16px 20px;">
        <button id="ig-start-tour" style="
          width: 100%;
          padding: 14px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          margin-bottom: 10px;
        ">
          🚀 Start Tour
        </button>
        
        <div style="display: flex; gap: 10px;">
          <button id="ig-remind-later" style="
            flex: 1;
            padding: 10px;
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            color: #6b7280;
            cursor: pointer;
          ">
            Remind me later
          </button>
          <button id="ig-dismiss-tour" style="
            flex: 1;
            padding: 10px;
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            color: #6b7280;
            cursor: pointer;
          ">
            Dismiss
          </button>
        </div>
      </div>
      
      <button id="ig-launcher-close" style="
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    `;

    document.body.appendChild(this.launcherElement);
    this.isVisible = true;

    // Event listeners
    this.launcherElement.querySelector('#ig-start-tour').addEventListener('click', () => {
      this.startWalkthrough();
    });

    this.launcherElement.querySelector('#ig-remind-later').addEventListener('click', () => {
      this.remindLater();
    });

    this.launcherElement.querySelector('#ig-dismiss-tour').addEventListener('click', () => {
      this.dismissTour();
    });

    this.launcherElement.querySelector('#ig-launcher-close').addEventListener('click', () => {
      this.hideLauncher();
    });
  }

  /**
   * Start the walkthrough
   */
  async startWalkthrough() {
    if (!this.activeWalkthrough) return;

    this.hideLauncher();

    // Initialize user progress
    const userId = await this.getUserId();
    this.userProgress = await window.walkthroughRepository.getUserProgress(
      userId,
      this.activeWalkthrough.walkthroughId
    ) || {
      userId,
      walkthroughId: this.activeWalkthrough.walkthroughId,
      currentStep: 0,
      completedSteps: [],
      completed: false,
      startedAt: Date.now()
    };

    // Show progress indicator
    this.showProgressIndicator();

    // EMIT TELEMETRY: ONBOARDING_STARTED
    this.logTelemetry('ONBOARDING_STARTED', {
      walkthroughId: this.activeWalkthrough.walkthroughId,
      walkthroughName: this.activeWalkthrough.name,
      stepCount: this.activeWalkthrough.steps?.length || 0,
      userId: userId,
      autoStarted: this.activeWalkthrough.settings?.autoStart || false
    });

    // Start the walkthrough using the locked v1.0.0 engine
    chrome.runtime.sendMessage({
      type: 'WALKTHROUGH_START',
      walkthrough: this.activeWalkthrough,
      progress: this.userProgress
    });

    console.log('[IG Launcher] Started walkthrough:', this.activeWalkthrough.walkthroughId);
  }

  /**
   * Log telemetry event
   */
  async logTelemetry(eventType, data = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'TELEMETRY_LOG',
        eventType,
        data: {
          ...data,
          timestamp: Date.now(),
          sessionId: this.activeWalkthrough?.walkthroughId || 'unknown'
        }
      });
    } catch (e) {
      console.warn('[IG Launcher] Telemetry failed:', e);
    }
  }

  /**
   * Validate step transition - check next step exists and preconditions met
   */
  async validateStepTransition(nextStepIndex) {
    if (!this.activeWalkthrough) return false;
    
    const nextStep = this.activeWalkthrough.steps[nextStepIndex];
    if (!nextStep) {
      console.warn('[IG Launcher] Next step not found:', nextStepIndex);
      return false;
    }
    
    // Check preconditions if defined
    if (nextStep.preconditions && nextStep.preconditions.length > 0) {
      for (const precondition of nextStep.preconditions) {
        const met = await this.checkPrecondition(precondition);
        if (!met) {
          // Log blocked by precondition
          this.logErrorTelemetry('STEP_BLOCKED_BY_PRECONDITION', {
            stepIndex: nextStepIndex,
            preconditionType: precondition.type,
            walkthroughId: this.activeWalkthrough.walkthroughId
          });
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Check a single precondition
   */
  async checkPrecondition(precondition) {
    try {
      switch (precondition.type) {
        case 'element_visible':
          return !!document.querySelector(precondition.selector);
        case 'element_clicked':
          // Track clicks in a set
          if (!this.clickedElements) this.clickedElements = new Set();
          return this.clickedElements.has(precondition.selector);
        case 'url_contains':
          return window.location.href.includes(precondition.value);
        case 'custom':
          return precondition.check ? precondition.check() : true;
        default:
          return true;
      }
    } catch (e) {
      console.warn('[IG Launcher] Precondition check failed:', e);
      return false;
    }
  }

  /**
   * Log error telemetry
   */
  async logErrorTelemetry(errorType, details = {}) {
    const userId = await this.getUserId();
    await this.logTelemetry(errorType, {
      ...details,
      userId,
      error: true,
      timestamp: Date.now()
    });
  }

  /**
   * Show floating progress indicator during walkthrough
   */
  showProgressIndicator() {
    if (!this.activeWalkthrough) return;

    const indicator = document.createElement('div');
    indicator.id = 'ig-progress-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 8px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    const totalSteps = this.activeWalkthrough.steps?.length || 0;
    const currentStep = this.userProgress?.currentStep || 0;

    indicator.innerHTML = `
      <div style="
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 700;
      ">IG</div>
      <div>
        <div>${this.activeWalkthrough.name}</div>
        <div style="font-size: 12px; color: #6b7280;">
          Step ${currentStep + 1} of ${totalSteps}
        </div>
      </div>
      <div style="
        width: 80px;
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
      ">
        <div style="
          width: ${((currentStep + 1) / totalSteps * 100)}%;
          height: 100%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          transition: width 0.3s ease;
        "></div>
      </div>
    `;

    document.body.appendChild(indicator);

    // Listen for step changes
    this.progressListener = (message) => {
      if (message.type === 'STEP_ADVANCE') {
        // Validate next step exists before advancing
        this.validateStepTransition(message.stepIndex).then(valid => {
          if (valid) {
            this.updateProgressIndicator(message.stepIndex + 1);
          } else {
            // Log error and pause
            this.logErrorTelemetry('STEP_TARGET_NOT_FOUND', {
              stepIndex: message.stepIndex,
              walkthroughId: this.activeWalkthrough?.walkthroughId
            });
          }
        });
      }
      if (message.type === 'WALKTHROUGH_COMPLETE') {
        this.onWalkthroughComplete();
      }
    };

    chrome.runtime.onMessage.addListener(this.progressListener);
  }

  /**
   * Update progress indicator
   */
  async updateProgressIndicator(stepIndex) {
    const indicator = document.getElementById('ig-progress-indicator');
    if (!indicator || !this.activeWalkthrough) return;

    const totalSteps = this.activeWalkthrough.steps?.length || 0;
    const stepText = indicator.querySelector('div > div:last-child');
    const progressBar = indicator.querySelector('div:last-child > div');

    if (stepText) {
      stepText.textContent = `Step ${stepIndex} of ${totalSteps}`;
    }
    if (progressBar) {
      progressBar.style.width = `${(stepIndex / totalSteps * 100)}%`;
    }

    // Update stored progress
    this.userProgress.currentStep = stepIndex - 1;
    
    // EMIT TELEMETRY: STEP_COMPLETED (for the previous step)
    if (stepIndex > 1) {
      const completedStep = this.activeWalkthrough.steps[stepIndex - 2];
      const userId = await this.getUserId();
      this.logTelemetry('STEP_COMPLETED', {
        walkthroughId: this.activeWalkthrough.walkthroughId,
        stepId: completedStep?.id,
        stepOrder: stepIndex - 1,
        userId: userId,
        completedAt: Date.now()
      });
    }
    
    this.saveProgress();
  }

  /**
   * Handle walkthrough completion
   */
  async onWalkthroughComplete() {
    // Remove progress indicator
    const indicator = document.getElementById('ig-progress-indicator');
    if (indicator) indicator.remove();

    // Remove listener
    if (this.progressListener) {
      chrome.runtime.onMessage.removeListener(this.progressListener);
    }

    // Mark as completed
    const userId = await this.getUserId();
    await window.walkthroughRepository.markCompleted(
      userId,
      this.activeWalkthrough.walkthroughId
    );

    // EMIT TELEMETRY: ONBOARDING_COMPLETED
    this.logTelemetry('ONBOARDING_COMPLETED', {
      walkthroughId: this.activeWalkthrough.walkthroughId,
      walkthroughName: this.activeWalkthrough.name,
      userId: userId,
      totalSteps: this.activeWalkthrough.steps?.length || 0,
      completedAt: Date.now()
    });

    // Show completion celebration
    this.showCompletionUI();

    console.log('[IG Launcher] Walkthrough completed');
  }

  /**
   * Show completion UI
   */
  showCompletionUI() {
    const completion = document.createElement('div');
    completion.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ig-fade-in 0.3s ease;
    `;

    completion.innerHTML = `
      <div style="
        background: white;
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 400px;
        animation: ig-scale-in 0.3s ease;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
        <h2 style="margin: 0 0 12px; font-size: 24px; color: #1f2937;">
          Tour Complete!
        </h2>
        <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.5;">
          You've completed "${this.activeWalkthrough?.name}". 
          You're all set to use this feature!
        </p>
        <button id="ig-completion-close" style="
          padding: 12px 32px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
        ">
          Got it!
        </button>
      </div>
    `;

    document.body.appendChild(completion);

    completion.querySelector('#ig-completion-close').addEventListener('click', () => {
      completion.remove();
    });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      completion.remove();
    }, 5000);
  }

  /**
   * Save current progress
   */
  async saveProgress() {
    if (!this.userProgress) return;

    const userId = await this.getUserId();
    await window.walkthroughRepository.saveUserProgress(
      userId,
      this.activeWalkthrough.walkthroughId,
      this.userProgress
    );
  }

  /**
   * Remind me later
   */
  remindLater() {
    this.hideLauncher();
    // Store reminder preference
    chrome.storage.local.set({
      'ig_onboarding_remind_at': Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
  }

  /**
   * Dismiss tour permanently for this walkthrough
   */
  async dismissTour() {
    this.hideLauncher();
    
    // EMIT TELEMETRY: ONBOARDING_ABORTED
    const userId = await this.getUserId();
    this.logTelemetry('ONBOARDING_ABORTED', {
      walkthroughId: this.activeWalkthrough?.walkthroughId,
      walkthroughName: this.activeWalkthrough?.name,
      userId: userId,
      reason: 'user_dismissed',
      abortedAt: Date.now()
    });
    
    // Mark as dismissed (won't show again)
    if (this.activeWalkthrough) {
      chrome.storage.local.set({
        [`ig_dismissed_${this.activeWalkthrough.walkthroughId}`]: true
      });
    }
  }

  /**
   * Hide launcher
   */
  hideLauncher() {
    if (this.launcherElement) {
      this.launcherElement.remove();
      this.launcherElement = null;
    }
    this.isVisible = false;
  }

  /**
   * Check admin mode
   */
  async checkAdminMode() {
    const stored = await chrome.storage.local.get(['ig_walkthrough_admin_mode']);
    return stored.ig_walkthrough_admin_mode === true;
  }

  /**
   * Get or create user ID
   */
  async getUserId() {
    const stored = await chrome.storage.local.get(['ig_user_id']);
    if (stored.ig_user_id) return stored.ig_user_id;
    
    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ ig_user_id: newId });
    return newId;
  }
}

// Initialize on page load
window.onboardingLauncher = new OnboardingLauncher();

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.onboardingLauncher.init();
  });
} else {
  window.onboardingLauncher.init();
}
