import { DarkeningConfig, SpotlightConfig, OverlayState } from '../types';

export class OverlayRenderer {
  private overlayElement: HTMLElement | null = null;
  private state: OverlayState = 'hidden';
  private darkeningConfig: DarkeningConfig;
  private spotlightConfig: SpotlightConfig;

  constructor() {
    this.darkeningConfig = {
      opacity: 0.7,
      blur: false,
      animation: {
        type: 'fade',
        duration: 300,
        easing: 'ease-in-out'
      }
    };

    this.spotlightConfig = {
      padding: 10,
      borderRadius: 8,
      animation: {
        type: 'scale',
        duration: 300,
        easing: 'ease-in-out'
      }
    };
  }

  async createOverlay(): Promise<void> {
    if (this.overlayElement) {
      return;
    }

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'walkthrough-overlay';
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, ${this.darkeningConfig.opacity});
      z-index: 999999;
      pointer-events: auto;
      opacity: 0;
      transition: opacity ${this.darkeningConfig.animation.duration}ms ${this.darkeningConfig.animation.easing};
    `;

    document.body.appendChild(this.overlayElement);
    this.state = 'visible';

    // Trigger animation
    await this.waitForNextFrame();
    if (this.overlayElement) {
      this.overlayElement.style.opacity = '1';
    }
  }

  async destroyOverlay(): Promise<void> {
    if (!this.overlayElement) {
      return;
    }

    this.state = 'hiding';
    
    // Fade out animation
    this.overlayElement.style.opacity = '0';
    
    // Wait for animation to complete
    await this.sleep(this.darkeningConfig.animation.duration);
    
    // Remove from DOM
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }
    
    this.overlayElement = null;
    this.state = 'hidden';
  }

  getState(): OverlayState {
    return this.state;
  }

  getOverlayElement(): HTMLElement | null {
    return this.overlayElement;
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
