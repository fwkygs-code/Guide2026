export class SpotlightManager {
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

  getTargetElement(): HTMLElement | null {
    return this.targetElement;
  }

  getSpotlightElement(): HTMLElement | null {
    return this.spotlightElement;
  }
}
