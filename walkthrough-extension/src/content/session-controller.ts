import { OverlayRenderer } from '../overlay/overlay-renderer';
import { SpotlightManager } from '../overlay/spotlight-manager';
import { StepUIManager } from '../overlay/step-ui-manager';
import { DEMO_WALKTHROUGH } from '../demo/walkthrough-definition';

export class SessionController {
  private overlayRenderer: OverlayRenderer;
  private spotlightManager: SpotlightManager;
  private stepUIManager: StepUIManager;
  private currentStepIndex: number = 0;
  private isActive: boolean = false;

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

    // Create overlay
    await this.overlayRenderer.createOverlay();

    // Start first step
    await this.activateStep(0);
  }

  async activateStep(stepIndex: number): Promise<void> {
    if (!this.isActive || stepIndex < 0 || stepIndex >= DEMO_WALKTHROUGH.steps.length) {
      return;
    }

    const step = DEMO_WALKTHROUGH.steps[stepIndex];
    this.currentStepIndex = stepIndex;

    // Clear existing spotlight and UI
    await this.spotlightManager.destroySpotlight();
    await this.stepUIManager.destroyStepUI();

    // Create new spotlight
    await this.spotlightManager.createSpotlight(step.targeting.selector);

    // Create step UI
    await this.stepUIManager.createStepUI(
      step.title,
      step.description,
      stepIndex,
      DEMO_WALKTHROUGH.steps.length,
      stepIndex > 0,
      stepIndex < DEMO_WALKTHROUGH.steps.length - 1,
      true
    );

    // Set callbacks
    this.stepUIManager.setCallbacks({
      onNext: this.handleNext.bind(this),
      onPrevious: this.handlePrevious.bind(this),
      onClose: this.handleClose.bind(this)
    });
  }

  async nextStep(): Promise<void> {
    if (this.currentStepIndex < DEMO_WALKTHROUGH.steps.length - 1) {
      await this.activateStep(this.currentStepIndex + 1);
    } else {
      await this.endWalkthrough();
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

    // Cleanup
    await this.spotlightManager.destroySpotlight();
    await this.stepUIManager.destroyStepUI();
    await this.overlayRenderer.destroyOverlay();

    this.isActive = false;
    this.currentStepIndex = 0;
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
