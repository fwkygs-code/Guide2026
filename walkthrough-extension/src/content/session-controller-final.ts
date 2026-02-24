interface WalkthroughStep {
  id: string;
  index: number;
  title: string;
  description: string;
  targeting: {
    selector: string;
  };
}

interface WalkthroughDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WalkthroughStep[];
}

const DEMO_WALKTHROUGH: WalkthroughDefinition = {
  id: 'demo-walkthrough',
  name: 'Demo Walkthrough',
  description: 'A simple demonstration walkthrough',
  version: '1.0.0',
  steps: [
    {
      id: 'step-1',
      index: 0,
      title: 'Welcome to the Demo',
      description: 'This is a simple walkthrough demonstration. Click Next to continue.',
      targeting: {
        selector: 'body'
      }
    },
    {
      id: 'step-2',
      index: 1,
      title: 'Step 2: Target Element',
      description: 'This step targets a specific element. Notice how the spotlight highlights it.',
      targeting: {
        selector: 'h1'
      }
    },
    {
      id: 'step-3',
      index: 2,
      title: 'Final Step',
      description: 'This is the final step. Click Finish to complete the walkthrough.',
      targeting: {
        selector: 'body'
      }
    }
  ]
};

class OverlayRenderer {
  private overlayElement: HTMLElement | null = null;
  private isVisible: boolean = false;

  async createOverlay(): Promise<void> {
    if (this.overlayElement) {
      return;
    }

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'walkthrough-overlay';
    this.overlayElement.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background-color: rgba(0, 0, 0, 0.7) !important;
      z-index: 999999 !important;
      pointer-events: auto !important;
      opacity: 0 !important;
      transition: opacity 300ms ease-in-out !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      outline: none !important;
    `;

    document.body.appendChild(this.overlayElement);
    this.isVisible = true;

    await this.waitForNextFrame();
    if (this.overlayElement) {
      this.overlayElement.style.opacity = '1';
    }
  }

  async destroyOverlay(): Promise<void> {
    if (!this.overlayElement) {
      return;
    }

    this.overlayElement.style.opacity = '0';
    this.isVisible = false;

    await this.sleep(300);

    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }
    
    this.overlayElement = null;
  }

  private async waitForNextFrame(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  isOverlayVisible(): boolean {
    return this.isVisible;
  }
}

class SpotlightManager {
  private spotlightElement: HTMLElement | null = null;
  private targetElement: HTMLElement | null = null;

  async createSpotlight(targetSelector: string): Promise<void> {
    const target = document.querySelector(targetSelector) as HTMLElement;
    if (!target) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }

    this.targetElement = target;
    await this.createSpotlightElement();
    await this.updateSpotlightPosition();
  }

  async updateSpotlight(): Promise<void> {
    if (!this.targetElement || !this.spotlightElement) {
      return;
    }

    await this.updateSpotlightPosition();
  }

  async destroySpotlight(): Promise<void> {
    if (this.spotlightElement && this.spotlightElement.parentNode) {
      this.spotlightElement.parentNode.removeChild(this.spotlightElement);
    }
    
    this.spotlightElement = null;
    this.targetElement = null;
  }

  private async createSpotlightElement(): Promise<void> {
    if (this.spotlightElement) {
      return;
    }

    this.spotlightElement = document.createElement('div');
    this.spotlightElement.id = 'walkthrough-spotlight';
    this.spotlightElement.style.cssText = `
      position: absolute !important;
      border: 3px solid #ffffff !important;
      background-color: transparent !important;
      pointer-events: none !important;
      z-index: 1000000 !important;
      transition: all 300ms ease-in-out !important;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7) !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
    `;

    document.body.appendChild(this.spotlightElement);
  }

  private async updateSpotlightPosition(): Promise<void> {
    if (!this.targetElement || !this.spotlightElement) {
      return;
    }

    const rect = this.targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const padding = 10;
    const top = rect.top + scrollTop - padding;
    const left = rect.left + scrollLeft - padding;
    const width = rect.width + (padding * 2);
    const height = rect.height + (padding * 2);

    this.spotlightElement.style.top = `${top}px`;
    this.spotlightElement.style.left = `${left}px`;
    this.spotlightElement.style.width = `${width}px`;
    this.spotlightElement.style.height = `${height}px`;
    this.spotlightElement.style.borderRadius = '8px';
  }
}

class StepUIManager {
  private stepElement: HTMLElement | null = null;
  private onNextCallback: (() => void) | null = null;
  private onPreviousCallback: (() => void) | null = null;
  private onCloseCallback: (() => void) | null = null;

  async createStepUI(
    title: string,
    description: string,
    currentStep: number,
    totalSteps: number,
    showPrevious: boolean = true,
    showNext: boolean = true,
    showClose: boolean = true
  ): Promise<void> {
    if (this.stepElement) {
      return;
    }

    this.stepElement = document.createElement('div');
    this.stepElement.id = 'walkthrough-step-ui';
    this.stepElement.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: white !important;
      border-radius: 8px !important;
      padding: 24px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
      z-index: 1000001 !important;
      max-width: 400px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      opacity: 0 !important;
      transition: opacity 300ms ease-in-out !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      border: none !important;
      outline: none !important;
    `;

    this.stepElement.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px; font-weight: 600;">${title}</h3>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">${description}</p>
      </div>
      ${totalSteps > 1 ? `
        <div style="margin-bottom: 16px; font-size: 12px; color: #999;">
          Step ${currentStep + 1} of ${totalSteps}
        </div>
      ` : ''}
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        ${showPrevious ? `
          <button id="walkthrough-previous" style="
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Previous</button>
        ` : ''}
        ${showNext ? `
          <button id="walkthrough-next" style="
            padding: 8px 16px;
            border: none;
            background: #007cba;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">${currentStep === totalSteps - 1 ? 'Finish' : 'Next'}</button>
        ` : ''}
        ${showClose ? `
          <button id="walkthrough-close" style="
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Close</button>
        ` : ''}
      </div>
    `;

    document.body.appendChild(this.stepElement);

    this.attachEventListeners();

    await this.waitForNextFrame();
    if (this.stepElement) {
      this.stepElement.style.opacity = '1';
    }
  }

  async destroyStepUI(): Promise<void> {
    if (!this.stepElement) {
      return;
    }

    this.stepElement.style.opacity = '0';
    
    await this.sleep(300);
    
    if (this.stepElement.parentNode) {
      this.stepElement.parentNode.removeChild(this.stepElement);
    }
    
    this.stepElement = null;
    this.onNextCallback = null;
    this.onPreviousCallback = null;
    this.onCloseCallback = null;
  }

  setCallbacks(callbacks: {
    onNext?: () => void;
    onPrevious?: () => void;
    onClose?: () => void;
  }): void {
    this.onNextCallback = callbacks.onNext || null;
    this.onPreviousCallback = callbacks.onPrevious || null;
    this.onCloseCallback = callbacks.onClose || null;
  }

  private attachEventListeners(): void {
    if (!this.stepElement) {
      return;
    }

    const nextButton = this.stepElement.querySelector('#walkthrough-next') as HTMLButtonElement;
    const previousButton = this.stepElement.querySelector('#walkthrough-previous') as HTMLButtonElement;
    const closeButton = this.stepElement.querySelector('#walkthrough-close') as HTMLButtonElement;

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (this.onNextCallback) {
          this.onNextCallback();
        }
      });
    }

    if (previousButton) {
      previousButton.addEventListener('click', () => {
        if (this.onPreviousCallback) {
          this.onPreviousCallback();
        }
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (this.onCloseCallback) {
          this.onCloseCallback();
        }
      });
    }
  }

  private async waitForNextFrame(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

export class SessionController {
  private overlayRenderer: OverlayRenderer;
  private spotlightManager: SpotlightManager;
  private stepUIManager: StepUIManager;
  private currentStepIndex: number = 0;
  private isActive: boolean = false;
  private isStepComplete: boolean = false;

  constructor() {
    this.overlayRenderer = new OverlayRenderer();
    this.spotlightManager = new SpotlightManager();
    this.stepUIManager = new StepUIManager();
  }

  async startWalkthrough(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.currentStepIndex = 0;
    this.isStepComplete = false;

    await this.overlayRenderer.createOverlay();
    await this.activateStep(0);
  }

  async activateStep(stepIndex: number): Promise<void> {
    if (!this.isActive || stepIndex < 0 || stepIndex >= DEMO_WALKTHROUGH.steps.length) {
      return;
    }

    const step = DEMO_WALKTHROUGH.steps[stepIndex];
    this.currentStepIndex = stepIndex;
    this.isStepComplete = false;

    await this.spotlightManager.destroySpotlight();
    await this.stepUIManager.destroyStepUI();

    if (step.targeting.selector !== 'body') {
      await this.spotlightManager.createSpotlight(step.targeting.selector);
    }

    await this.stepUIManager.createStepUI(
      step.title,
      step.description,
      stepIndex,
      DEMO_WALKTHROUGH.steps.length,
      stepIndex > 0,
      stepIndex < DEMO_WALKTHROUGH.steps.length - 1,
      true
    );

    this.stepUIManager.setCallbacks({
      onNext: this.handleNext.bind(this),
      onPrevious: this.handlePrevious.bind(this),
      onClose: this.handleClose.bind(this)
    });
  }

  async nextStep(): Promise<void> {
    if (!this.isStepComplete) {
      this.isStepComplete = true;
      
      if (this.currentStepIndex < DEMO_WALKTHROUGH.steps.length - 1) {
        await this.activateStep(this.currentStepIndex + 1);
      } else {
        await this.endWalkthrough();
      }
    }
  }

  async previousStep(): Promise<void> {
    if (this.currentStepIndex > 0) {
      await this.activateStep(this.currentStepIndex - 1);
    }
  }

  async endWalkthrough(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    await this.spotlightManager.destroySpotlight();
    await this.stepUIManager.destroyStepUI();
    await this.overlayRenderer.destroyOverlay();

    this.isActive = false;
    this.currentStepIndex = 0;
    this.isStepComplete = false;

    const startButton = document.getElementById('walkthrough-start-button') as HTMLElement;
    if (startButton) {
      startButton.style.display = 'block';
    }
  }

  private async handleNext(): Promise<void> {
    await this.nextStep();
  }

  private async handlePrevious(): Promise<void> {
    await this.previousStep();
  }

  private async handleClose(): Promise<void> {
    await this.endWalkthrough();
  }

  isWalkthroughActive(): boolean {
    return this.isActive;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }
}
