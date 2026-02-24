export class StepUIManager {
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
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 1000001;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transition: opacity 300ms ease-in-out;
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

    // Add event listeners
    this.attachEventListeners();

    // Trigger animation
    await this.waitForNextFrame();
    if (this.stepElement) {
      this.stepElement.style.opacity = '1';
    }
  }

  async destroyStepUI(): Promise<void> {
    if (!this.stepElement) {
      return;
    }

    // Fade out animation
    this.stepElement.style.opacity = '0';
    
    // Wait for animation to complete
    await this.sleep(300);
    
    // Remove from DOM
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
