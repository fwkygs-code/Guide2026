/**
 * ADMIN TEST MODE
 * QA interface for testing walkthroughs without saving progress
 */

class AdminTestMode {
  constructor() {
    this.isActive = false;
    this.testWalkthrough = null;
    this.currentStepIndex = 0;
    this.testResults = [];
    this.controlPanel = null;
    this.diagnosticsPanel = null;
  }

  /**
   * Start test mode for a walkthrough
   */
  async startTest(walkthroughId) {
    // Load walkthrough
    const walkthrough = await window.walkthroughRepository.getPublished(walkthroughId) ||
                       await window.walkthroughRepository.getDraft(walkthroughId);
    
    if (!walkthrough) {
      alert('Walkthrough not found');
      return;
    }

    this.testWalkthrough = walkthrough;
    this.currentStepIndex = 0;
    this.testResults = [];
    this.isActive = true;

    // Show test control panel
    this.showControlPanel();
    
    // Show diagnostics
    this.showDiagnosticsPanel();

    // Start at first step
    this.loadTestStep(0);

    console.log('[IG Test Mode] Started testing:', walkthrough.name);
  }

  /**
   * Load specific step for testing
   */
  async loadTestStep(index) {
    if (!this.testWalkthrough || !this.testWalkthrough.steps[index]) {
      console.error('[IG Test Mode] Invalid step index:', index);
      return;
    }

    this.currentStepIndex = index;
    const step = this.testWalkthrough.steps[index];

    // Update control panel
    this.updateControlPanel();

    // Run diagnostics on step
    const diagnostics = await this.runStepDiagnostics(step);
    this.updateDiagnostics(diagnostics);

    // Try to activate step using engine (in test mode)
    this.activateTestStep(step);
  }

  /**
   * Activate step in test mode
   */
  async activateTestStep(step) {
    // Use the locked engine but in test mode
    chrome.runtime.sendMessage({
      type: 'WALKTHROUGH_START',
      walkthrough: {
        ...this.testWalkthrough,
        steps: [step] // Only current step
      },
      isTestMode: true,
      stepIndex: this.currentStepIndex
    });

    // Log test action
    this.logTestAction('STEP_ACTIVATED', {
      stepId: step.id,
      stepIndex: this.currentStepIndex,
      selector: step.targetSelectors?.primary?.value
    });
  }

  /**
   * Run diagnostics on step
   */
  async runStepDiagnostics(step) {
    const diagnostics = {
      stepId: step.id,
      stepNumber: this.currentStepIndex + 1,
      timestamp: Date.now(),
      checks: []
    };

    // Check 1: Selector validity
    const selectorCheck = await this.checkSelector(step.targetSelectors?.primary);
    diagnostics.checks.push({
      name: 'Selector Resolution',
      status: selectorCheck.found ? 'PASS' : 'FAIL',
      details: selectorCheck.found ? 
        `Found: ${selectorCheck.element.tagName}` : 
        'Element not found on current page'
    });

    // Check 2: Selector stability
    const stability = this.calculateStability(step.targetSelectors?.primary);
    diagnostics.checks.push({
      name: 'Selector Stability',
      status: stability >= 0.5 ? 'PASS' : 'WARNING',
      details: `Score: ${(stability * 100).toFixed(0)}%`,
      stability
    });

    // Check 3: URL scope match
    const urlMatch = this.checkUrlScope(step.urlScope);
    diagnostics.checks.push({
      name: 'URL Scope',
      status: urlMatch ? 'PASS' : 'FAIL',
      details: urlMatch ? 'Current URL matches scope' : 'URL mismatch'
    });

    // Check 4: Element visibility
    if (selectorCheck.found) {
      const visible = this.isElementVisible(selectorCheck.element);
      diagnostics.checks.push({
        name: 'Element Visibility',
        status: visible ? 'PASS' : 'WARNING',
        details: visible ? 'Element is visible' : 'Element may be hidden'
      });
    }

    // Check 5: Instruction clarity
    const instructionLength = step.instruction?.length || 0;
    diagnostics.checks.push({
      name: 'Instruction Length',
      status: instructionLength >= 10 ? 'PASS' : 'WARNING',
      details: `${instructionLength} characters`
    });

    diagnostics.overallStatus = diagnostics.checks.every(c => c.status === 'PASS') ? 'PASS' :
                               diagnostics.checks.some(c => c.status === 'FAIL') ? 'FAIL' : 'WARNING';

    return diagnostics;
  }

  /**
   * Check if selector resolves
   */
  async checkSelector(selector) {
    if (!selector || !selector.value) {
      return { found: false };
    }

    try {
      let element = null;

      switch (selector.type) {
        case 'css_id':
        case 'css_class':
        case 'css_path':
          element = document.querySelector(selector.value);
          break;
        case 'test_id':
          element = document.querySelector(`[data-testid="${selector.raw}"]`);
          break;
        case 'aria_label':
          element = document.querySelector(`[aria-label="${selector.raw}"]`);
          break;
      }

      return { found: !!element, element };
    } catch (e) {
      return { found: false, error: e.message };
    }
  }

  /**
   * Calculate selector stability
   */
  calculateStability(selector) {
    if (!selector) return 0;

    const scores = {
      'css_id': 1.0,
      'test_id': 1.0,
      'aria_label': 0.95,
      'css_class': 0.5,
      'css_path': 0.3
    };

    let score = scores[selector.type] || 0.5;

    // Penalize dynamic classes
    if (selector.type === 'css_class' && /[a-f0-9]{5,}/i.test(selector.raw)) {
      score *= 0.5;
    }

    // Penalize deep paths
    if (selector.type === 'css_path' && selector.value.split('>').length > 3) {
      score *= 0.7;
    }

    return score;
  }

  /**
   * Check URL scope
   */
  checkUrlScope(urlScope) {
    if (!urlScope || !urlScope.value) return true;

    const currentUrl = window.location.href;
    return currentUrl.includes(urlScope.value);
  }

  /**
   * Check element visibility
   */
  isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.visibility !== 'hidden' && 
           style.display !== 'none';
  }

  /**
   * Show test control panel
   */
  showControlPanel() {
    if (this.controlPanel) {
      this.controlPanel.remove();
    }

    this.controlPanel = document.createElement('div');
    this.controlPanel.id = 'ig-test-control-panel';
    this.controlPanel.style.cssText = `
      position: fixed;
      top: 16px;
      left: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483646;
      width: 280px;
      border: 2px solid #f59e0b;
    `;

    this.controlPanel.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 12px 16px;
        border-radius: 10px 10px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="font-weight: 600;">🧪 TEST MODE</div>
        <button id="ig-test-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
        ">×</button>
      </div>
      
      <div style="padding: 16px;">
        <div id="ig-test-walkthrough-name" style="
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
          color: #1f2937;
        "></div>
        
        <div id="ig-test-step-info" style="
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 16px;
        "></div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="ig-test-prev" style="
            flex: 1;
            padding: 8px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
          ">← Prev</button>
          <button id="ig-test-next" style="
            flex: 1;
            padding: 8px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
          ">Next →</button>
        </div>
        
        <button id="ig-test-force-pass" style="
          width: 100%;
          padding: 8px;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-bottom: 8px;
        ">
          ✓ Force Validation Pass
        </button>
        
        <button id="ig-test-force-fail" style="
          width: 100%;
          padding: 8px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        ">
          ✗ Force Validation Fail
        </button>
      </div>
      
      <div style="
        padding: 12px 16px;
        background: #fef3c7;
        border-top: 1px solid #fcd34d;
        font-size: 11px;
        color: #92400e;
      ">
        ⚠️ Progress not saved in test mode
      </div>
    `;

    document.body.appendChild(this.controlPanel);

    // Event listeners
    this.controlPanel.querySelector('#ig-test-close').addEventListener('click', () => {
      this.stopTest();
    });

    this.controlPanel.querySelector('#ig-test-prev').addEventListener('click', () => {
      this.previousStep();
    });

    this.controlPanel.querySelector('#ig-test-next').addEventListener('click', () => {
      this.nextStep();
    });

    this.controlPanel.querySelector('#ig-test-force-pass').addEventListener('click', () => {
      this.forceValidation(true);
    });

    this.controlPanel.querySelector('#ig-test-force-fail').addEventListener('click', () => {
      this.forceValidation(false);
    });

    this.updateControlPanel();
  }

  /**
   * Update control panel with current state
   */
  updateControlPanel() {
    if (!this.controlPanel || !this.testWalkthrough) return;

    const nameEl = this.controlPanel.querySelector('#ig-test-walkthrough-name');
    const infoEl = this.controlPanel.querySelector('#ig-test-step-info');
    const prevBtn = this.controlPanel.querySelector('#ig-test-prev');
    const nextBtn = this.controlPanel.querySelector('#ig-test-next');

    nameEl.textContent = this.testWalkthrough.name;
    infoEl.textContent = `Step ${this.currentStepIndex + 1} of ${this.testWalkthrough.steps.length}`;

    prevBtn.disabled = this.currentStepIndex === 0;
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';

    nextBtn.disabled = this.currentStepIndex >= this.testWalkthrough.steps.length - 1;
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
  }

  /**
   * Show diagnostics panel
   */
  showDiagnosticsPanel() {
    if (this.diagnosticsPanel) {
      this.diagnosticsPanel.remove();
    }

    this.diagnosticsPanel = document.createElement('div');
    this.diagnosticsPanel.id = 'ig-test-diagnostics';
    this.diagnosticsPanel.style.cssText = `
      position: fixed;
      top: 16px;
      left: 310px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483645;
      width: 320px;
      max-height: 400px;
      overflow-y: auto;
    `;

    this.diagnosticsPanel.innerHTML = `
      <div style="
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 10px 10px 0 0;
        font-weight: 600;
        font-size: 14px;
      ">
        📊 Step Diagnostics
      </div>
      <div id="ig-diagnostics-content" style="padding: 16px;">
        <div style="color: #9ca3af; text-align: center; padding: 20px;">
          Run diagnostics to see step health
        </div>
      </div>
    `;

    document.body.appendChild(this.diagnosticsPanel);
  }

  /**
   * Update diagnostics display
   */
  updateDiagnostics(diagnostics) {
    if (!this.diagnosticsPanel) return;

    const content = this.diagnosticsPanel.querySelector('#ig-diagnostics-content');
    
    const overallColor = diagnostics.overallStatus === 'PASS' ? '#22c55e' :
                        diagnostics.overallStatus === 'FAIL' ? '#ef4444' : '#f59e0b';

    content.innerHTML = `
      <div style="
        text-align: center;
        padding: 12px;
        background: ${overallColor}15;
        border-radius: 8px;
        margin-bottom: 16px;
      ">
        <div style="
          font-size: 24px;
          font-weight: 700;
          color: ${overallColor};
        ">${diagnostics.overallStatus}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          Step ${diagnostics.stepNumber} • ${new Date(diagnostics.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      ${diagnostics.checks.map(check => {
        const color = check.status === 'PASS' ? '#22c55e' :
                     check.status === 'FAIL' ? '#ef4444' : '#f59e0b';
        const icon = check.status === 'PASS' ? '✓' :
                      check.status === 'FAIL' ? '✗' : '⚠';
        
        return `
          <div style="
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: ${color}; font-weight: 600;">${icon}</span>
                <span style="font-size: 13px; color: #374151; font-weight: 500;">${check.name}</span>
              </div>
              <span style="
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 4px;
                background: ${color}15;
                color: ${color};
                font-weight: 500;
              ">${check.status}</span>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px; margin-left: 24px;">
              ${check.details}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  /**
   * Navigate to previous step
   */
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.loadTestStep(this.currentStepIndex - 1);
    }
  }

  /**
   * Navigate to next step
   */
  nextStep() {
    if (this.currentStepIndex < this.testWalkthrough.steps.length - 1) {
      this.loadTestStep(this.currentStepIndex + 1);
    }
  }

  /**
   * Force validation result
   */
  forceValidation(shouldPass) {
    chrome.runtime.sendMessage({
      type: 'TEST_FORCE_VALIDATION',
      result: shouldPass,
      stepIndex: this.currentStepIndex
    });

    this.logTestAction('FORCED_VALIDATION', { 
      passed: shouldPass,
      stepIndex: this.currentStepIndex 
    });
  }

  /**
   * Log test action
   */
  logTestAction(action, data) {
    this.testResults.push({
      timestamp: Date.now(),
      action,
      data,
      stepIndex: this.currentStepIndex
    });
  }

  /**
   * Stop test mode
   */
  stopTest() {
    this.isActive = false;
    
    if (this.controlPanel) {
      this.controlPanel.remove();
      this.controlPanel = null;
    }
    
    if (this.diagnosticsPanel) {
      this.diagnosticsPanel.remove();
      this.diagnosticsPanel = null;
    }

    // Abort any active walkthrough
    chrome.runtime.sendMessage({
      type: 'WALKTHROUGH_ABORT',
      reason: 'TEST_MODE_EXIT'
    });

    console.log('[IG Test Mode] Test session ended');
    console.log('[IG Test Mode] Results:', this.testResults);
  }

  /**
   * Export test results
   */
  exportResults() {
    const report = {
      walkthroughId: this.testWalkthrough?.walkthroughId,
      walkthroughName: this.testWalkthrough?.name,
      testedAt: new Date().toISOString(),
      stepsTested: this.testResults.filter(r => r.action === 'STEP_ACTIVATED').length,
      actions: this.testResults
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${this.testWalkthrough?.walkthroughId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global instance
window.adminTestMode = new AdminTestMode();
