export class OverlayRenderer {
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

  getOverlayElement(): HTMLElement | null {
    return this.overlayElement;
  }
}
