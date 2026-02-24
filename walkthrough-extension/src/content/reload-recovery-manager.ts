import { RecoveryState, RecoveryResult } from '../types';

export class ReloadRecoveryManager {
  private readonly STORAGE_KEY = 'walkthrough_recovery_state';
  private recoveryState: RecoveryState | null = null;

  constructor() {
    this.loadRecoveryState();
    this.setupUnloadHandler();
  }

  saveRecoveryState(walkthroughState: any): void {
    this.recoveryState = {
      walkthroughId: walkthroughState.walkthroughId,
      sessionId: walkthroughState.sessionId,
      currentStep: walkthroughState.currentStep,
      stepHistory: walkthroughState.completedSteps || [],
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.recoveryState));
    } catch (error) {
      console.warn('Failed to save recovery state:', error);
    }
  }

  attemptRecovery(): RecoveryResult {
    if (!this.recoveryState) {
      return { canRecover: false, reason: 'no-recovery-state' };
    }

    // Check if recovery is still valid
    const age = Date.now() - this.recoveryState.timestamp;
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (age > maxAge) {
      this.clearRecoveryState();
      return { canRecover: false, reason: 'recovery-expired' };
    }

    // Check if URL is compatible
    if (!this.isURLCompatible(this.recoveryState.url, window.location.href)) {
      return { canRecover: false, reason: 'url-incompatible' };
    }

    // Check user agent (optional, for debugging)
    if (this.recoveryState.userAgent !== navigator.userAgent) {
      console.warn('User agent changed during recovery');
    }

    return {
      canRecover: true,
      recoveryState: this.recoveryState
    };
  }

  clearRecoveryState(): void {
    this.recoveryState = null;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear recovery state:', error);
    }
  }

  private loadRecoveryState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.recoveryState = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load recovery state:', error);
      this.clearRecoveryState();
    }
  }

  private isURLCompatible(savedURL: string, currentURL: string): boolean {
    try {
      const saved = new URL(savedURL);
      const current = new URL(currentURL);

      // Same origin is required
      if (saved.origin !== current.origin) {
        return false;
      }

      // Same path is preferred but not required
      // This allows recovery across SPA navigation
      return true;
    } catch (error) {
      return false;
    }
  }

  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Clear recovery state on clean exit
      if (this.recoveryState && !this.isWalkthroughActive()) {
        this.clearRecoveryState();
      }
    });
  }

  private isWalkthroughActive(): boolean {
    // Check if walkthrough is currently active
    return document.querySelector('.walkthrough-overlay') !== null;
  }

  cleanup(): void {
    this.clearRecoveryState();
  }
}
