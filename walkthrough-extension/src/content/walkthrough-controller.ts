import { WalkthroughState, WalkthroughDefinition, NavigationChange, RecoveryState } from '../types';
import { MESSAGE_TYPES } from '../constants';
import { SPANavigationDetector } from './spa-navigation-detector';
import { ReloadRecoveryManager } from './reload-recovery-manager';

export class WalkthroughController {
  private state: WalkthroughState | null = null;
  private walkthroughDefinition: WalkthroughDefinition | null = null;
  private isActive = false;
  private isPaused = false;

  constructor(
    private navigationDetector: SPANavigationDetector,
    private recoveryManager: ReloadRecoveryManager
  ) {}

  async onSystemReady(payload: any): Promise<void> {
    try {
      console.log('System ready:', payload);
      // System ready initialization logic here
    } catch (error) {
      console.error('System ready failed:', error);
      throw error;
    }
  }

  async startWalkthrough(payload: any): Promise<any> {
    try {
      if (this.isActive && !this.isPaused) {
        return {
          success: false,
          error: 'Walkthrough already active'
        };
      }

      const { walkthroughId, startStep = 0 } = payload;

      // Load walkthrough definition
      this.walkthroughDefinition = await this.loadWalkthroughDefinition(walkthroughId);
      
      if (!this.walkthroughDefinition) {
        return {
          success: false,
          error: 'Walkthrough definition not found'
        };
      }

      // Initialize state
      this.state = this.createInitialState(walkthroughId, startStep);
      this.isActive = true;
      this.isPaused = false;

      // Save recovery state
      this.recoveryManager.saveRecoveryState(this.state);

      // Notify background
      await this.sendProgressUpdate();

      // Start first step
      await this.activateStep(startStep);

      return {
        success: true,
        data: {
          sessionId: this.state.sessionId,
          totalSteps: this.walkthroughDefinition.steps.length
        }
      };

    } catch (error) {
      console.error('Failed to start walkthrough:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async pauseWalkthrough(): Promise<void> {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.isPaused = true;
    
    // Pause current step
    if (this.state) {
      await this.deactivateStep(this.state.currentStep);
    }

    await this.sendProgressUpdate();
  }

  async resumeWalkthrough(): Promise<void> {
    if (!this.isActive || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    
    // Resume current step
    if (this.state) {
      await this.activateStep(this.state.currentStep);
    }

    await this.sendProgressUpdate();
  }

  async abortWalkthrough(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      // Deactivate current step
      if (this.state) {
        await this.deactivateStep(this.state.currentStep);
      }

      // Update state
      if (this.state) {
        this.state.status = 'aborted';
        await this.sendProgressUpdate();
      }

      // Clear recovery state
      this.recoveryManager.clearRecoveryState();

      // Reset
      this.isActive = false;
      this.isPaused = false;
      this.state = null;
      this.walkthroughDefinition = null;

    } catch (error) {
      console.error('Failed to abort walkthrough:', error);
      throw error;
    }
  }

  async activateStep(stepIndex: number): Promise<void> {
    if (!this.state || !this.walkthroughDefinition) {
      throw new Error('Walkthrough not initialized');
    }

    if (stepIndex < 0 || stepIndex >= this.walkthroughDefinition.steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const step = this.walkthroughDefinition.steps[stepIndex];
    
    // Validate step location
    const locationValid = await this.validateStepLocation(step);
    if (!locationValid.valid) {
      throw new Error(`Step location validation failed: ${locationValid.reason}`);
    }

    // Deactivate previous step
    if (this.state.currentStep !== stepIndex) {
      await this.deactivateStep(this.state.currentStep);
    }

    // Update state
    this.state.currentStep = stepIndex;
    this.state.lastActivity = Date.now();

    // Save recovery state
    this.recoveryManager.saveRecoveryState(this.state);

    // Send progress update
    await this.sendProgressUpdate();

    console.log(`Activated step ${stepIndex}: ${step.title}`);
  }

  async completeStep(stepIndex: number): Promise<void> {
    if (!this.state || !this.walkthroughDefinition) {
      throw new Error('Walkthrough not initialized');
    }

    if (this.state.currentStep !== stepIndex) {
      throw new Error('Cannot complete different step than current');
    }

    // Add to completed steps
    if (!this.state.completedSteps.includes(stepIndex)) {
      this.state.completedSteps.push(stepIndex);
    }

    // Check if walkthrough is complete
    if (stepIndex === this.walkthroughDefinition.steps.length - 1) {
      this.state.status = 'completed';
      this.isActive = false;
      this.recoveryManager.clearRecoveryState();
    } else {
      // Move to next step
      await this.activateStep(stepIndex + 1);
    }

    await this.sendProgressUpdate();
  }

  async handleNavigationChange(change: NavigationChange): Promise<void> {
    if (!this.isActive || !this.state || this.isPaused) {
      return;
    }

    try {
      // Check if current step is still valid
      const currentStep = this.walkthroughDefinition?.steps[this.state.currentStep];
      if (currentStep) {
        const locationValid = await this.validateStepLocation(currentStep);
        
        if (!locationValid.valid) {
          console.warn('Navigation change invalidated current step:', locationValid.reason);
          // Handle invalid step (pause, retry, or abort)
          await this.handleInvalidStep(locationValid);
        }
      }
    } catch (error) {
      console.error('Failed to handle navigation change:', error);
    }
  }

  async syncState(payload: any): Promise<void> {
    // Handle state synchronization from background
    if (payload.state) {
      this.state = payload.state;
      this.isActive = this.state.status === 'active';
      this.isPaused = this.state.status === 'paused';
    }
  }

  async recoverSession(recoveryState: RecoveryState): Promise<void> {
    try {
      // Load walkthrough definition
      this.walkthroughDefinition = await this.loadWalkthroughDefinition(recoveryState.walkthroughId);
      
      if (!this.walkthroughDefinition) {
        throw new Error('Cannot recover: walkthrough definition not found');
      }

      // Restore state
      this.state = {
        id: recoveryState.walkthroughId,
        sessionId: recoveryState.sessionId,
        walkthroughId: recoveryState.walkthroughId,
        currentStep: recoveryState.currentStep,
        totalSteps: this.walkthroughDefinition.steps.length,
        completedSteps: recoveryState.stepHistory,
        stepHistory: [],
        status: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        configuration: this.walkthroughDefinition.configuration
      };

      this.isActive = true;
      this.isPaused = false;

      // Activate current step
      await this.activateStep(this.state.currentStep);

      console.log('Session recovered successfully');

    } catch (error) {
      console.error('Failed to recover session:', error);
      throw error;
    }
  }

  getState(): WalkthroughState | null {
    return this.state;
  }

  getDebugInfo(): any {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      state: this.state,
      walkthroughDefinition: this.walkthroughDefinition ? {
        id: this.walkthroughDefinition.id,
        name: this.walkthroughDefinition.name,
        stepCount: this.walkthroughDefinition.steps.length
      } : null,
      navigationDetector: this.navigationDetector ? 'active' : 'inactive',
      recoveryManager: this.recoveryManager ? 'active' : 'inactive'
    };
  }

  cleanup(): void {
    try {
      this.abortWalkthrough();
      this.navigationDetector?.cleanup();
      this.recoveryManager?.cleanup();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // Private methods
  private async loadWalkthroughDefinition(walkthroughId: string): Promise<WalkthroughDefinition | null> {
    try {
      // Request from background script
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WALKTHROUGH_DEFINITION',
        payload: { walkthroughId }
      });

      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to load walkthrough definition:', error);
      return null;
    }
  }

  private createInitialState(walkthroughId: string, startStep: number): WalkthroughState {
    return {
      id: walkthroughId,
      sessionId: this.generateSessionId(),
      walkthroughId,
      currentStep: startStep,
      totalSteps: this.walkthroughDefinition?.steps.length || 0,
      completedSteps: [],
      stepHistory: [],
      status: 'active',
      startTime: Date.now(),
      lastActivity: Date.now(),
      configuration: this.walkthroughDefinition?.configuration || {}
    };
  }

  private async validateStepLocation(step: any): Promise<{ valid: boolean; reason?: string }> {
    // Basic validation - in a real implementation, this would use the StepLocationValidator
    const currentUrl = window.location.href;
    
    if (step.validation?.preconditions?.urlPattern) {
      const pattern = new RegExp(step.validation.preconditions.urlPattern);
      if (!pattern.test(currentUrl)) {
        return {
          valid: false,
          reason: 'URL pattern mismatch'
        };
      }
    }

    return { valid: true };
  }

  private async deactivateStep(stepIndex: number): Promise<void> {
    // Deactivate step logic here
    console.log(`Deactivated step ${stepIndex}`);
  }

  private async handleInvalidStep(validationResult: any): Promise<void> {
    // Handle invalid step based on configuration
    if (this.state?.configuration.errorHandling?.allowRetry) {
      console.log('Retrying step due to navigation change');
      // Retry logic here
    } else {
      console.log('Pausing walkthrough due to navigation change');
      await this.pauseWalkthrough();
    }
  }

  private async sendProgressUpdate(): Promise<void> {
    if (!this.state) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.PROGRESS_UPDATE,
        payload: {
          sessionId: this.state.sessionId,
          currentStep: this.state.currentStep,
          totalSteps: this.state.totalSteps,
          completedSteps: this.state.completedSteps,
          status: this.state.status
        }
      });
    } catch (error) {
      console.error('Failed to send progress update:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
