import { SessionController } from './session-controller';

export class ContentScript {
  private sessionController: SessionController;
  private startButton: HTMLElement | null = null;

  constructor() {
    this.sessionController = new SessionController();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Create start button for demo
    this.createStartButton();

    // Setup message handling
    this.setupMessageHandling();

    console.log('Walkthrough Extension content script initialized');
  }

  private createStartButton(): void {
    this.startButton = document.createElement('button');
    this.startButton.id = 'walkthrough-start-button';
    this.startButton.textContent = 'Start Walkthrough';
    this.startButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999998;
      padding: 12px 24px;
      background: #007cba;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 124, 186, 0.3);
      transition: all 200ms ease;
    `;

    this.startButton.addEventListener('click', () => {
      this.handleStartWalkthrough();
    });

    this.startButton.addEventListener('mouseenter', () => {
      if (this.startButton) {
        this.startButton.style.background = '#005a87';
        this.startButton.style.transform = 'translateY(-1px)';
      }
    });

    this.startButton.addEventListener('mouseleave', () => {
      if (this.startButton) {
        this.startButton.style.background = '#007cba';
        this.startButton.style.transform = 'translateY(0)';
      }
    });

    document.body.appendChild(this.startButton);
  }

  private async handleStartWalkthrough(): Promise<void> {
    if (this.sessionController.isWalkthroughActive()) {
      return;
    }

    // Hide start button
    if (this.startButton) {
      this.startButton.style.display = 'none';
    }

    // Start walkthrough
    await this.sessionController.startWalkthrough();
  }

  private setupMessageHandling(): void {
    // Listen for messages from background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;
      });
    }

    // Listen for page messages (for debugging)
    window.addEventListener('message', (event) => {
      if (event.source === window && event.data.type === 'walkthrough_start') {
        this.handleStartWalkthrough();
      }
    });
  }

  private async handleMessage(
    message: any,
    sender: any,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'START_WALKTHROUGH':
          await this.handleStartWalkthrough();
          sendResponse({ success: true });
          break;
        case 'END_WALKTHROUGH':
          await this.sessionController.endWalkthrough();
          if (this.startButton) {
            this.startButton.style.display = 'block';
          }
          sendResponse({ success: true });
          break;
        case 'GET_STATUS':
          sendResponse({
            success: true,
            data: {
              isActive: this.sessionController.isWalkthroughActive(),
              currentStep: this.sessionController.getCurrentStepIndex()
            }
          });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Content script message handling error:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }

  public cleanup(): void {
    this.sessionController.endWalkthrough();
    if (this.startButton && this.startButton.parentNode) {
      this.startButton.parentNode.removeChild(this.startButton);
    }
  }
}

// Initialize the content script
const contentScript = new ContentScript();

// Handle page unload
window.addEventListener('beforeunload', () => {
  contentScript.cleanup();
});

// Export for debugging
(window as any).walkthroughContentScript = contentScript;
