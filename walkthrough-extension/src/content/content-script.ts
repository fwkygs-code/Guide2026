import { WalkthroughController } from './walkthrough-controller';
import { SPANavigationDetector } from './spa-navigation-detector';
import { ReloadRecoveryManager } from './reload-recovery-manager';
import { MESSAGE_TYPES } from '../constants';

export class ContentScript {
  private walkthroughController: WalkthroughController;
  private navigationDetector: SPANavigationDetector;
  private recoveryManager: ReloadRecoveryManager;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Initialize components
      this.navigationDetector = new SPANavigationDetector();
      this.recoveryManager = new ReloadRecoveryManager();
      this.walkthroughController = new WalkthroughController(
        this.navigationDetector,
        this.recoveryManager
      );

      // Setup message handling
      this.setupMessageHandling();
      
      // Setup navigation handling
      this.setupNavigationHandling();

      // Attempt recovery if needed
      await this.attemptRecovery();

      this.initialized = true;
      console.log('Walkthrough Extension content script initialized');

    } catch (error) {
      console.error('Failed to initialize content script:', error);
      this.sendErrorToBackground('ContentScript', error as Error, { phase: 'initialization' });
    }
  }

  private setupMessageHandling(): void {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for messages from page (for debugging)
    window.addEventListener('message', (event) => {
      if (event.source === window && event.data.type?.startsWith('walkthrough_')) {
        this.handlePageMessage(event.data);
      }
    });
  }

  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.SYSTEM_READY:
          await this.walkthroughController.onSystemReady(message.payload);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.WALKTHROUGH_START:
          const result = await this.walkthroughController.startWalkthrough(message.payload);
          sendResponse(result);
          break;

        case MESSAGE_TYPES.WALKTHROUGH_PAUSE:
          await this.walkthroughController.pauseWalkthrough();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.WALKTHROUGH_RESUME:
          await this.walkthroughController.resumeWalkthrough();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.WALKTHROUGH_ABORT:
          await this.walkthroughController.abortWalkthrough();
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.STEP_ACTIVATE:
          await this.walkthroughController.activateStep(message.payload.stepIndex);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.STEP_COMPLETE:
          await this.walkthroughController.completeStep(message.payload.stepIndex);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.STATE_SYNC:
          await this.walkthroughController.syncState(message.payload);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.DEBUG_INFO:
          const debugInfo = this.walkthroughController.getDebugInfo();
          sendResponse({ success: true, data: debugInfo });
          break;

        case MESSAGE_TYPES.PING:
          sendResponse({
            success: true,
            data: {
              timestamp: Date.now(),
              initialized: this.initialized,
              url: window.location.href
            }
          });
          break;

        default:
          sendResponse({
            success: false,
            error: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      this.sendErrorToBackground('ContentScript', error as Error, { message, sender });
      sendResponse({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private handlePageMessage(message: any): void {
    // Handle debugging messages from the page
    if (message.type === 'walkthrough_debug_command') {
      this.handleDebugCommand(message.payload);
    }
  }

  private async handleDebugCommand(command: any): Promise<void> {
    try {
      switch (command.action) {
        case 'start_walkthrough':
          await this.walkthroughController.startWalkthrough(command.data);
          break;
        case 'pause_walkthrough':
          await this.walkthroughController.pauseWalkthrough();
          break;
        case 'resume_walkthrough':
          await this.walkthroughController.resumeWalkthrough();
          break;
        case 'abort_walkthrough':
          await this.walkthroughController.abortWalkthrough();
          break;
        case 'get_state':
          const state = this.walkthroughController.getState();
          window.postMessage({
            type: 'walkthrough_debug_response',
            payload: { command: command.action, state }
          }, '*');
          break;
        default:
          console.warn('Unknown debug command:', command.action);
      }
    } catch (error) {
      console.error('Debug command failed:', error);
    }
  }

  private setupNavigationHandling(): void {
    // Listen for navigation changes
    this.navigationDetector.onNavigationChange(async (change) => {
      try {
        await this.walkthroughController.handleNavigationChange(change);
      } catch (error) {
        this.sendErrorToBackground('ContentScript', error as Error, { 
          phase: 'navigation_handling',
          navigationChange: change 
        });
      }
    });
  }

  private async attemptRecovery(): Promise<void> {
    try {
      const recoveryResult = this.recoveryManager.attemptRecovery();
      
      if (recoveryResult.canRecover && recoveryResult.recoveryState) {
        console.log('Attempting walkthrough recovery');
        await this.walkthroughController.recoverSession(recoveryResult.recoveryState);
      }
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      this.sendErrorToBackground('ContentScript', error as Error, { phase: 'recovery' });
    }
  }

  private sendErrorToBackground(
    component: string,
    error: Error,
    context?: any
  ): void {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.ERROR_OCCURRED,
      payload: {
        component,
        error: {
          message: error.message,
          stack: error.stack
        },
        context: {
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent
        },
        severity: 'medium',
        recoverable: true
      }
    }).catch(() => {
      // Background script might not be available
      console.error('Failed to send error to background:', error);
    });
  }

  // Public API for external access
  public isInitialized(): boolean {
    return this.initialized;
  }

  public getWalkthroughController(): WalkthroughController {
    return this.walkthroughController;
  }

  public getNavigationDetector(): SPANavigationDetector {
    return this.navigationDetector;
  }

  public getRecoveryManager(): ReloadRecoveryManager {
    return this.recoveryManager;
  }

  // Cleanup method
  public cleanup(): void {
    try {
      this.walkthroughController?.cleanup();
      this.navigationDetector?.cleanup();
      this.recoveryManager?.cleanup();
      this.initialized = false;
    } catch (error) {
      console.error('Cleanup failed:', error);
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
