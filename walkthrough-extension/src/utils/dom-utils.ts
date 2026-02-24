export class DOMUtils {
  static isElementVisible(element: Element): boolean {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           (element as HTMLElement).offsetWidth > 0 && 
           (element as HTMLElement).offsetHeight > 0;
  }
  
  static isElementInteractable(element: Element): boolean {
    if (!element || !this.isElementVisible(element)) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Check if element is not disabled
    if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
      if ((element as any).disabled) return false;
    }
    
    // Check if element is not covered by another element
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);
    
    return topElement === element || element.contains(topElement);
  }
  
  static isElementInViewport(element: Element, margin: number = 0): boolean {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
    
    return (
      rect.top >= -margin &&
      rect.left >= -margin &&
      rect.bottom <= viewport.height + margin &&
      rect.right <= viewport.width + margin
    );
  }
  
  static getElementBounds(element: Element): DOMRect {
    if (!element) return new DOMRect();
    
    return element.getBoundingClientRect();
  }
  
  static scrollElementIntoView(element: Element, options: ScrollIntoViewOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      const defaultOptions: ScrollIntoViewOptions = {
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
        ...options
      };
      
      element.scrollIntoView(defaultOptions);
      
      // Wait for scroll to complete
      const checkScroll = () => {
        const rect = element.getBoundingClientRect();
        const isInView = this.isElementInViewport(element, 50);
        
        if (isInView) {
          resolve();
        } else {
          requestAnimationFrame(checkScroll);
        }
      };
      
      setTimeout(checkScroll, 100);
    });
  }
  
  static waitForElement(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id', 'style']
      });
      
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
  
  static waitForElementVisible(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const checkVisibility = () => {
        const element = document.querySelector(selector);
        if (element && this.isElementVisible(element)) {
          resolve(element);
          return;
        }
        
        if (timeout <= 0) {
          resolve(null);
          return;
        }
        
        timeout -= 100;
        setTimeout(checkVisibility, 100);
      };
      
      checkVisibility();
    });
  }
  
  static isElementStable(element: Element, threshold: number = 500): Promise<boolean> {
    return new Promise((resolve) => {
      if (!element) {
        resolve(false);
        return;
      }
      
      let lastBounds = this.getElementBounds(element);
      let stableCount = 0;
      const requiredStableCount = Math.ceil(threshold / 100); // Check every 100ms
      
      const checkStability = () => {
        const currentBounds = this.getElementBounds(element);
        
        if (this.boundsEqual(lastBounds, currentBounds)) {
          stableCount++;
          if (stableCount >= requiredStableCount) {
            resolve(true);
            return;
          }
        } else {
          stableCount = 0;
          lastBounds = currentBounds;
        }
        
        setTimeout(checkStability, 100);
      };
      
      checkStability();
    });
  }
  
  private static boundsEqual(bounds1: DOMRect, bounds2: DOMRect): boolean {
    return (
      bounds1.x === bounds2.x &&
      bounds1.y === bounds2.y &&
      bounds1.width === bounds2.width &&
      bounds1.height === bounds2.height
    );
  }
  
  static getComputedStyle(element: Element, property: string): string {
    return window.getComputedStyle(element).getPropertyValue(property);
  }
  
  static addTemporaryClass(element: Element, className: string, duration: number): void {
    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  }
  
  static createElement(tag: string, attributes: Record<string, string> = {}, styles: Record<string, string> = {}): HTMLElement {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    Object.entries(styles).forEach(([property, value]) => {
      (element.style as any)[property] = value;
    });
    
    return element;
  }
  
  static removeElement(element: Element): void {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  
  static removeAllElements(selector: string): void {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => this.removeElement(element));
  }
  
  static findParent(element: Element, predicate: (parent: Element) => boolean): Element | null {
    let current = element.parentElement;
    
    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.parentElement;
    }
    
    return null;
  }
  
  static findChild(element: Element, predicate: (child: Element) => boolean): Element | null {
    const children = element.children;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (predicate(child)) {
        return child;
      }
      
      const found = this.findChild(child, predicate);
      if (found) {
        return found;
      }
    }
    
    return null;
  }
  
  static getZIndex(element: Element): number {
    const style = window.getComputedStyle(element);
    const zIndex = parseInt(style.zIndex) || 0;
    return zIndex;
  }
  
  static getHighestZIndex(): number {
    const allElements = document.querySelectorAll('*');
    let maxZ = 0;
    
    allElements.forEach(element => {
      const zIndex = this.getZIndex(element);
      if (zIndex > maxZ) {
        maxZ = zIndex;
      }
    });
    
    return maxZ;
  }
  
  static isElementAccessible(element: Element): boolean {
    try {
      // Check if element is in the same origin
      const ownerDocument = element.ownerDocument;
      return ownerDocument === document;
    } catch (error) {
      return false;
    }
  }
  
  static getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(cls => cls.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }
    
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    
    if (!parent) {
      return tagName;
    }
    
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    
    return `${this.getElementSelector(parent)} > ${tagName}:nth-child(${index + 1})`;
  }
}
