import { NavigationChange } from '../types';

export class SPANavigationDetector {
  private currentURL: string;
  private navigationHistory: string[] = [];
  private observers: Set<(change: NavigationChange) => void> = new Set();
  private mutationObserver: MutationObserver | null = null;
  private titleObserver: MutationObserver | null = null;

  constructor() {
    this.currentURL = window.location.href;
    this.setupDetection();
  }

  private setupDetection(): void {
    // Monitor History API
    this.interceptHistoryAPI();

    // Listen for popstate events
    window.addEventListener('popstate', this.handlePopState.bind(this));

    // Listen for hashchange events
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Monitor DOM mutations for SPA indicators
    this.observeDOMChanges();

    // Monitor title changes (common in SPAs)
    this.observeTitleChanges();
  }

  private interceptHistoryAPI(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args: any[]) => {
      const result = originalPushState.apply(history, args);
      this.scheduleNavigationCheck('pushState');
      return result;
    };

    history.replaceState = (...args: any[]) => {
      const result = originalReplaceState.apply(history, args);
      this.scheduleNavigationCheck('replaceState');
      return result;
    };
  }

  private handlePopState(event: PopStateEvent): void {
    this.scheduleNavigationCheck('popstate');
  }

  private handleHashChange(event: HashChangeEvent): void {
    this.scheduleNavigationCheck('hashchange');
  }

  private observeDOMChanges(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      const hasNavigationIndicators = mutations.some(mutation => {
        const target = mutation.target as Element;
        return (
          target.hasAttribute('data-route') ||
          target.hasAttribute('data-page') ||
          target.classList.contains('router-view') ||
          target.classList.contains('route') ||
          target.classList.contains('spa-container')
        );
      });

      if (hasNavigationIndicators) {
        this.scheduleNavigationCheck('dom-mutation');
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-route', 'data-page', 'class']
    });
  }

  private observeTitleChanges(): void {
    let lastTitle = document.title;

    this.titleObserver = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        this.scheduleNavigationCheck('title-change');
      }
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
      this.titleObserver.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  private scheduleNavigationCheck(trigger: string): void {
    // Debounce rapid navigation events
    setTimeout(() => {
      this.checkForNavigationChange(trigger);
    }, 50);
  }

  private checkForNavigationChange(trigger: string): void {
    const newURL = window.location.href;

    if (newURL !== this.currentURL) {
      const oldURL = this.currentURL;
      this.currentURL = newURL;
      this.navigationHistory.push(newURL);

      const change: NavigationChange = {
        type: this.determineNavigationType(oldURL, newURL),
        oldURL,
        newURL,
        trigger,
        timestamp: Date.now()
      };

      this.notifyObservers(change);
    }
  }

  private determineNavigationType(oldURL: string, newURL: string): 'spa' | 'page' | 'hash' {
    try {
      const oldURLObj = new URL(oldURL);
      const newURLObj = new URL(newURL);

      // Different origin = page navigation
      if (oldURLObj.origin !== newURLObj.origin) {
        return 'page';
      }

      // Same origin, different path = likely SPA navigation
      if (oldURLObj.pathname !== newURLObj.pathname) {
        return 'spa';
      }

      // Only hash changed = hash navigation
      if (oldURLObj.hash !== newURLObj.hash) {
        return 'hash';
      }

      return 'spa'; // Default to SPA for query parameter changes
    } catch (error) {
      return 'page';
    }
  }

  private notifyObservers(change: NavigationChange): void {
    this.observers.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('Navigation observer error:', error);
      }
    });
  }

  onNavigationChange(callback: (change: NavigationChange) => void): void {
    this.observers.add(callback);
  }

  removeNavigationListener(callback: (change: NavigationChange) => void): void {
    this.observers.delete(callback);
  }

  getCurrentURL(): string {
    return this.currentURL;
  }

  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  isSPANavigation(): boolean {
    // Heuristics to detect if current page is an SPA
    return (
      // Check for common SPA frameworks
      !!(window.React || window.Vue || window.Angular || window.Ember) ||
      // Check for history API usage
      this.navigationHistory.length > 1 ||
      // Check for SPA indicators in DOM
      !!(document.querySelector('[data-route]') ||
           document.querySelector('[data-page]') ||
           document.querySelector('.router-view') ||
           document.querySelector('.spa-container'))
    );
  }

  cleanup(): void {
    this.mutationObserver?.disconnect();
    this.titleObserver?.disconnect();
    this.observers.clear();
  }
}
