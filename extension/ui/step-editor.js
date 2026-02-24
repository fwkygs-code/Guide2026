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
    this.isMultiField = false;
    this.fieldSelectors = [];
    this.isMinimized = false;
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
          <div style="display: flex; gap: 4px;">
            <button id="ig-editor-minimize" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              font-size: 16px;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">−</button>
            <button id="ig-editor-close" style="
              background: none;
              border: none;
              color: white;
              font-size: 20px;
              cursor: pointer;
              padding: 4px;
            ">×</button>
          </div>
        </div>
      </div>
      
      <div id="ig-editor-content" style="padding: 20px;">
        <div id="ig-step-form">
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="ig-multi-field" style="width: 16px; height: 16px;">
              <span>Multi-field step (collect multiple inputs)</span>
            </label>
          </div>
          
          <div id="ig-multi-field-fields" style="display: none; margin-bottom: 16px;">
            <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 8px;">
              Fields to collect:
            </div>
            <div id="ig-field-list" style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 80px;">
              <!-- Fields will be added here -->
            </div>
            <button id="ig-add-field" style="
              margin-top: 8px;
              padding: 6px 12px;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 12px;
              cursor: pointer;
            ">+ Add Field</button>
          </div>
          
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

    this.element.querySelector('#ig-editor-minimize').addEventListener('click', () => {
      this.toggleMinimize();
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

    // Multi-field toggle
    this.element.querySelector('#ig-multi-field').addEventListener('change', (e) => {
      this.isMultiField = e.target.checked;
      const multiFieldSection = this.element.querySelector('#ig-multi-field-fields');
      multiFieldSection.style.display = this.isMultiField ? 'block' : 'none';
      
      if (this.isMultiField) {
        this.fieldSelectors = [];
        this.renderFieldList();
      }
    });

    // Add field button
    this.element.querySelector('#ig-add-field').addEventListener('click', () => {
      this.addField();
    });

    const finishBtn = this.element.querySelector('#ig-finish-walkthrough');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        if (window.AuthoringController) {
          window.AuthoringController.publishWalkthrough();
        }
      });
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }
  
  minimize() {
    const content = this.element?.querySelector('#ig-editor-content');
    const minimizeBtn = this.element?.querySelector('#ig-editor-minimize');
    
    if (content && minimizeBtn) {
      content.style.display = 'none';
      minimizeBtn.textContent = '+';
      this.isMinimized = true;
      
      // Shrink editor
      if (this.element) {
        this.element.style.width = '300px';
        this.element.style.maxHeight = '60px';
        this.element.style.overflow = 'hidden';
      }
    }
  }
  
  restore() {
    const content = this.element?.querySelector('#ig-editor-content');
    const minimizeBtn = this.element?.querySelector('#ig-editor-minimize');
    
    if (content && minimizeBtn) {
      content.style.display = 'block';
      minimizeBtn.textContent = '−';
      this.isMinimized = false;
      
      // Restore editor size
      if (this.element) {
        this.element.style.width = '380px';
        this.element.style.maxHeight = '80vh';
        this.element.style.overflow = '';
      }
    }
  }
  
  toggleMinimize() {
    if (this.isMinimized) {
      this.restore();
    } else {
      this.minimize();
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
    if (window.AuthoringController) {
      window.AuthoringController.startElementPicking();
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
    console.log('[IG Step Editor] saveCurrentStep called');
    
    const instruction = this.element.querySelector('#ig-instruction').value;
    const actionTypeSelect = this.element.querySelector('#ig-action-type');
    const validationSelect = this.element.querySelector('#ig-validation');
    const actionType = actionTypeSelect && actionTypeSelect.value ? actionTypeSelect.value : 'click';
    const validation = validationSelect && validationSelect.value ? validationSelect.value : 'clicked';
    const allowSkip = this.element.querySelector('#ig-allow-skip').checked;
    const isOptional = this.element.querySelector('#ig-is-optional').checked;

    console.log('[IG Step Editor] Saving step:', {
      instruction,
      actionType,
      validation,
      allowSkip,
      isOptional,
      selector: this.currentSelector
    });

    if (!instruction) {
      alert('Please enter instruction text');
      return;
    }

    // For multi-field steps, check that all fields have selectors
    if (this.isMultiField) {
      const invalidFields = this.fieldSelectors.filter(f => !f.selector || !f.name);
      if (invalidFields.length > 0) {
        alert('Please add a name and select an element for all fields');
        return;
      }
    } else if (!this.currentSelector) {
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
      highlightPadding: 8,
      isMultiField: this.isMultiField,
      fields: this.isMultiField ? this.fieldSelectors : null
    };

    console.log('[IG Step Editor] Step config:', stepConfig);

    if (window.AuthoringController) {
      window.AuthoringController.saveStep(stepConfig).then(() => {
        console.log('[IG Step Editor] Step saved successfully');
        
        // Reset form for next step
        this.resetForm();

        // Show finish button after first step
        const finishActions = this.element.querySelector('#ig-finish-actions');
        console.log('[IG Step Editor] Finish actions element:', finishActions);
        if (finishActions) {
          finishActions.style.display = 'block';
          console.log('[IG Step Editor] Showing finish actions');
        }

        // Update counter
        if (window.AuthoringController && window.AuthoringController.currentWalkthrough) {
          this.updateStepCounter(window.AuthoringController.currentWalkthrough);
        }
      });
    }
  }

  saveAndNext() {
    this.saveCurrentStep().then(() => {
      // After saving, increment step index and prepare for next step
      if (window.AuthoringController && window.AuthoringController.currentWalkthrough) {
        window.AuthoringController.currentStepIndex = window.AuthoringController.currentWalkthrough.steps.length;
      }
      // Form is already reset by saveCurrentStep
    });
  }

  resetForm() {
    this.currentSelector = null;
    this.isMultiField = false;
    this.fieldSelectors = [];

    const preview = this.element.querySelector('#ig-selector-preview');
    const pickButton = this.element.querySelector('#ig-pick-element');
    const instruction = this.element.querySelector('#ig-instruction');
    const multiFieldCheckbox = this.element.querySelector('#ig-multi-field');
    const multiFieldSection = this.element.querySelector('#ig-multi-field-fields');

    preview.style.display = 'none';
    pickButton.style.display = 'flex';
    instruction.value = '';
    multiFieldCheckbox.checked = false;
    multiFieldSection.style.display = 'none';
    this.renderFieldList();
  }

  addField() {
    const field = {
      id: crypto.randomUUID(),
      name: '',
      selector: null,
      type: 'input'
    };
    this.fieldSelectors.push(field);
    this.renderFieldList();
  }

  removeField(fieldId) {
    this.fieldSelectors = this.fieldSelectors.filter(f => f.id !== fieldId);
    this.renderFieldList();
  }

  renderFieldList() {
    const container = this.element.querySelector('#ig-field-list');
    if (!container) return;

    if (this.fieldSelectors.length === 0) {
      container.innerHTML = '<div style="color: #9ca3af; font-style: italic;">No fields added yet. Click "Add Field" to start.</div>';
      return;
    }

    container.innerHTML = this.fieldSelectors.map((field, index) => `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 6px;">
        <span style="font-weight: 600; color: #4f46e5;">${index + 1}</span>
        <input type="text" placeholder="Field name (e.g., First Name)" value="${field.name}" 
               data-field-id="${field.id}" data-field-prop="name" style="
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 12px;
        ">
        <button data-field-id="${field.id}" class="ig-pick-field" style="
          padding: 4px 8px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        ">Pick</button>
        <button data-field-id="${field.id}" class="ig-remove-field" style="
          padding: 4px 8px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        ">×</button>
      </div>
    `).join('');

    // Add event listeners for field inputs
    container.querySelectorAll('input[data-field-id]').forEach(input => {
      input.addEventListener('change', (e) => {
        const fieldId = e.target.dataset.fieldId;
        const prop = e.target.dataset.fieldProp;
        const field = this.fieldSelectors.find(f => f.id === fieldId);
        if (field) {
          field[prop] = e.target.value;
        }
      });
    });

    // Add event listeners for pick buttons
    container.querySelectorAll('.ig-pick-field').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldId = e.target.dataset.fieldId;
        this.pickFieldElement(fieldId);
      });
    });

    // Add event listeners for remove buttons
    container.querySelectorAll('.ig-remove-field').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldId = e.target.dataset.fieldId;
        this.removeField(fieldId);
      });
    });
  }

  pickFieldElement(fieldId) {
    const field = this.fieldSelectors.find(f => f.id === fieldId);
    if (!field) return;

    // Hide step editor temporarily
    this.element.style.display = 'none';

    // Start element picking for this field
    window.elementPickerEnabled = true;
    document.body.style.cursor = 'crosshair';

    const pickListener = (event) => {
      if (!window.elementPickerEnabled) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      const element = event.target;
      
      // Generate selector
      if (window.AuthoringController) {
        const selector = window.AuthoringController.generateSelector(element);
        field.selector = selector;
        
        // Show feedback
        const feedback = document.createElement('div');
        feedback.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #22c55e;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          z-index: 2147483647;
        `;
        feedback.textContent = `✓ Element selected for "${field.name || 'Field'}"`;
        document.body.appendChild(feedback);
        
        setTimeout(() => feedback.remove(), 2000);
      }
      
      // Stop picking
      window.elementPickerEnabled = false;
      document.body.style.cursor = '';
      document.removeEventListener('click', pickListener, true);
      
      // Show step editor again
      this.element.style.display = 'block';
      this.renderFieldList();
    };

    document.addEventListener('click', pickListener, true);
  }
}

// Global instance
window.StepEditor = new StepEditor();
