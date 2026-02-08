/**
 * STEP EDITOR UI
 * Interface for configuring individual walkthrough steps
 */

class StepEditor {
  constructor() {
    this.element = null;
    this.currentStep = null;
    this.currentSelector = null;
    this.onSave = null;
    this.onCancel = null;
    this.onNext = null;
  }

  show(walkthrough) {
    if (this.element) {
      this.element.style.display = 'block';
      this.updateStepCounter(walkthrough);
      return;
    }

    this.element = document.createElement('div');
    this.element.id = 'ig-step-editor';
    this.element.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483645;
      width: 380px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    this.element.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        padding: 16px 20px;
        border-radius: 16px 16px 0 0;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 16px;">Step Editor</div>
            <div id="ig-step-counter" style="font-size: 13px; opacity: 0.9;">
              Step ${(walkthrough.steps?.length || 0) + 1} of ${(walkthrough.steps?.length || 0) + 1}
            </div>
          </div>
          <button id="ig-editor-close" style="
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
          ">×</button>
        </div>
      </div>
      
      <div style="padding: 20px;">
        <div id="ig-step-form">
          <div style="margin-bottom: 16px;">
            <button id="ig-pick-element" style="
              width: 100%;
              padding: 14px;
              background: #f3f4f6;
              border: 2px dashed #d1d5db;
              border-radius: 10px;
              font-size: 14px;
              font-weight: 600;
              color: #4f46e5;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            ">
              🖱️ Click to Pick Element
            </button>
          </div>
          
          <div id="ig-selector-preview" style="display: none; margin-bottom: 16px;">
            <div style="
              background: #f0fdf4;
              border: 1px solid #86efac;
              border-radius: 8px;
              padding: 12px;
              font-size: 13px;
            ">
              <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">
                ✅ Element Selected
              </div>
              <div id="ig-selector-display" style="
                font-family: monospace;
                color: #374151;
                word-break: break-all;
              "></div>
              <div id="ig-stability-display" style="margin-top: 8px; font-size: 12px;"></div>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">
              Instruction Text *
            </label>
            <textarea id="ig-instruction" placeholder="e.g., 'Click the Save button to continue'" style="
              width: 100%;
              padding: 10px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              font-size: 14px;
              min-height: 80px;
              resize: vertical;
              box-sizing: border-box;
            "></textarea>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">
              Required Action
            </label>
            <select id="ig-action-type" style="
              width: 100%;
              padding: 10px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              font-size: 14px;
              background: white;
            ">
              <option value="click">Click</option>
              <option value="input">Type text</option>
              <option value="select">Select option</option>
              <option value="check">Check checkbox</option>
              <option value="wait">Wait for condition</option>
            </select>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">
              Validation Rule
            </label>
            <select id="ig-validation" style="
              width: 100%;
              padding: 10px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              font-size: 14px;
              background: white;
            ">
              <option value="clicked">Element clicked</option>
              <option value="value_present">Has any value</option>
              <option value="value_equals">Value equals...</option>
              <option value="navigated">Page navigated</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="ig-allow-skip" style="width: 16px; height: 16px;">
              <span>Allow skip</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="ig-is-optional" style="width: 16px; height: 16px;">
              <span>Optional step</span>
            </label>
          </div>
        </div>
        
        <div id="ig-editor-actions" style="display: flex; gap: 10px;">
          <button id="ig-save-step" style="
            flex: 1;
            padding: 12px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          ">Save Step</button>
          <button id="ig-next-step" style="
            flex: 1;
            padding: 12px;
            background: #22c55e;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          ">Save & Add Next</button>
        </div>
        
        <div id="ig-finish-actions" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <button id="ig-finish-walkthrough" style="
            width: 100%;
            padding: 12px;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          ">
            ✅ Finish & Publish Walkthrough
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);

    // Event listeners
    this.element.querySelector('#ig-editor-close').addEventListener('click', () => {
      this.hide();
      if (this.onCancel) this.onCancel();
    });

    this.element.querySelector('#ig-pick-element').addEventListener('click', () => {
      this.startElementPicking();
    });

    this.element.querySelector('#ig-save-step').addEventListener('click', () => {
      this.saveCurrentStep();
    });

    this.element.querySelector('#ig-next-step').addEventListener('click', () => {
      this.saveAndNext();
    });

    const finishBtn = this.element.querySelector('#ig-finish-walkthrough');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        if (window.authoringController) {
          window.authoringController.publishWalkthrough();
        }
      });
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  showConfiguration(selector, stability) {
    this.currentSelector = selector;

    const preview = this.element.querySelector('#ig-selector-preview');
    const display = this.element.querySelector('#ig-selector-display');
    const stabilityDisplay = this.element.querySelector('#ig-stability-display');
    const pickButton = this.element.querySelector('#ig-pick-element');

    preview.style.display = 'block';
    pickButton.style.display = 'none';

    display.textContent = selector.value;

    // Show stability
    const stabilityColor = stability >= 0.7 ? '#166534' : stability >= 0.4 ? '#b45309' : '#dc2626';
    const stabilityText = stability >= 0.7 ? 'Stable' : stability >= 0.4 ? 'Fair' : 'Fragile';

    stabilityDisplay.innerHTML = `
      <span style="color: ${stabilityColor}; font-weight: 600;">
        ${stabilityText} (${(stability * 100).toFixed(0)}%)
      </span>
      ${stability < 0.5 ? '<br><span style="color: #dc2626;">⚠️ Consider adding data-testid</span>' : ''}
    `;
  }

  startElementPicking() {
    if (window.authoringController) {
      window.authoringController.startElementPicking();
    }
  }

  updateStepCounter(walkthrough) {
    const counter = this.element?.querySelector('#ig-step-counter');
    if (counter) {
      const stepNum = (walkthrough.steps?.length || 0) + 1;
      counter.textContent = `Step ${stepNum} of ${stepNum}`;
    }
  }

  saveCurrentStep() {
    const instruction = this.element.querySelector('#ig-instruction').value;
    const actionType = this.element.querySelector('#ig-action-type').value;
    const validation = this.element.querySelector('#ig-validation').value;
    const allowSkip = this.element.querySelector('#ig-allow-skip').checked;
    const isOptional = this.element.querySelector('#ig-is-optional').checked;

    if (!instruction) {
      alert('Please enter instruction text');
      return;
    }

    if (!this.currentSelector) {
      alert('Please pick an element first');
      return;
    }

    const stepConfig = {
      instruction,
      actionType,
      validation: { rule: validation },
      selector: this.currentSelector,
      fallbacks: [],
      allowSkip,
      isOptional,
      tooltipPosition: 'bottom',
      highlightPadding: 8
    };

    if (window.authoringController) {
      window.authoringController.saveStep(stepConfig).then(() => {
        // Reset form for next step
        this.resetForm();

        // Show finish button after first step
        const finishActions = this.element.querySelector('#ig-finish-actions');
        if (finishActions) {
          finishActions.style.display = 'block';
        }

        // Update counter
        if (window.authoringController.currentWalkthrough) {
          this.updateStepCounter(window.authoringController.currentWalkthrough);
        }
      });
    }
  }

  saveAndNext() {
    this.saveCurrentStep();
    // Form is reset, ready for next step
  }

  resetForm() {
    this.currentSelector = null;

    const preview = this.element.querySelector('#ig-selector-preview');
    const pickButton = this.element.querySelector('#ig-pick-element');
    const instruction = this.element.querySelector('#ig-instruction');

    preview.style.display = 'none';
    pickButton.style.display = 'flex';
    instruction.value = '';
  }
}

// Global instance
window.StepEditor = new StepEditor();
