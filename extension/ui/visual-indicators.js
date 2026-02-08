/**
 * VISUAL ROLE INDICATORS
 * Admin badge, mode indicators, and visual separation between roles
 */

class VisualRoleIndicators {
  constructor() {
    this.adminBadge = null;
    this.modeIndicator = null;
    this.stepCounter = null;
    this.userIndicator = null;
  }

  /**
   * Initialize indicators based on current mode
   */
  async init() {
    const isAdmin = await this.checkAdminMode();
    
    if (isAdmin) {
      this.showAdminIndicators();
    } else {
      this.showUserIndicators();
    }
  }

  /**
   * Show admin-specific visual indicators
   */
  showAdminIndicators() {
    // Admin badge in corner
    this.showAdminBadge();
    
    // Mode indicator
    this.showModeIndicator('authoring');
    
    console.log('[IG Visual] Admin indicators shown');
  }

  /**
   * Show user-specific visual indicators
   */
  showUserIndicators() {
    // User mode indicator (subtle)
    this.showModeIndicator('user');
    
    console.log('[IG Visual] User indicators shown');
  }

  /**
   * Admin badge - prominent indicator of admin status
   */
  showAdminBadge() {
    if (this.adminBadge) return;

    this.adminBadge = document.createElement('div');
    this.adminBadge.id = 'ig-admin-badge';
    this.adminBadge.style.cssText = `
      position: fixed;
      top: 16px;
      left: 16px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
      display: flex;
      align-items: center;
      gap: 6px;
      animation: ig-pulse-badge 2s infinite;
    `;

    // Add pulse animation
    if (!document.getElementById('ig-badge-styles')) {
      const style = document.createElement('style');
      style.id = 'ig-badge-styles';
      style.textContent = `
        @keyframes ig-pulse-badge {
          0%, 100% { box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 4px 20px rgba(245, 158, 11, 0.6); }
        }
      `;
      document.head.appendChild(style);
    }

    this.adminBadge.innerHTML = `
      <span>⚡</span>
      <span>ADMIN MODE</span>
    `;

    document.body.appendChild(this.adminBadge);
  }

  /**
   * Mode indicator - shows current system mode
   */
  showModeIndicator(mode) {
    if (this.modeIndicator) {
      this.modeIndicator.remove();
    }

    this.modeIndicator = document.createElement('div');
    this.modeIndicator.id = 'ig-mode-indicator';
    
    if (mode === 'authoring') {
      this.modeIndicator.style.cssText = `
        position: fixed;
        bottom: 16px;
        left: 16px;
        background: rgba(245, 158, 11, 0.9);
        color: white;
        padding: 8px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 2147483640;
        backdrop-filter: blur(4px);
      `;
      this.modeIndicator.innerHTML = '📝 Authoring Mode - Changes not saved until published';
    } else if (mode === 'user') {
      this.modeIndicator.style.cssText = `
        position: fixed;
        bottom: 16px;
        left: 16px;
        background: rgba(79, 70, 229, 0.9);
        color: white;
        padding: 8px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 2147483640;
        backdrop-filter: blur(4px);
        display: none; // Hidden by default for users
      `;
      this.modeIndicator.innerHTML = '🎯 Onboarding Active';
    }

    document.body.appendChild(this.modeIndicator);
  }

  /**
   * Step counter overlay - visible during authoring and testing
   */
  showStepCounter(current, total, mode = 'authoring') {
    if (this.stepCounter) {
      this.stepCounter.remove();
    }

    this.stepCounter = document.createElement('div');
    this.stepCounter.id = 'ig-step-counter-overlay';
    
    const bgColor = mode === 'authoring' ? '#f59e0b' : '#4f46e5';
    
    this.stepCounter.style.cssText = `
      position: fixed;
      top: 70px;
      left: 16px;
      background: ${bgColor};
      color: white;
      padding: 10px 18px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 2147483646;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    this.stepCounter.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${mode === 'authoring' ? '📝' : '🧪'}</span>
        <span>Step ${current} of ${total}</span>
      </div>
    `;

    document.body.appendChild(this.stepCounter);
  }

  /**
   * User indicator - shows when user is in a walkthrough
   */
  showUserActiveIndicator(walkthroughName) {
    if (this.userIndicator) {
      this.userIndicator.remove();
    }

    this.userIndicator = document.createElement('div');
    this.userIndicator.id = 'ig-user-active-indicator';
    this.userIndicator.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      padding: 12px 18px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 2147483640;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.3);
      max-width: 280px;
    `;

    this.userIndicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="
          width: 32px;
          height: 32px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">🎯</div>
        <div>
          <div style="font-weight: 600;">${walkthroughName}</div>
          <div style="font-size: 11px; opacity: 0.9;">Guided tour in progress</div>
        </div>
      </div>
    `;

    document.body.appendChild(this.userIndicator);
  }

  /**
   * Hide user indicator
   */
  hideUserActiveIndicator() {
    if (this.userIndicator) {
      this.userIndicator.remove();
      this.userIndicator = null;
    }
  }

  /**
   * Show completion badge
   */
  showCompletionBadge(walkthroughName) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 14px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
      animation: ig-slide-in-right 0.3s ease;
    `;

    // Add animation
    if (!document.getElementById('ig-completion-styles')) {
      const style = document.createElement('style');
      style.id = 'ig-completion-styles';
      style.textContent = `
        @keyframes ig-slide-in-right {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    badge.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">✅</span>
        <div>
          <div>Completed!</div>
          <div style="font-size: 11px; opacity: 0.9; font-weight: 400;">${walkthroughName}</div>
        </div>
      </div>
    `;

    document.body.appendChild(badge);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      badge.style.animation = 'ig-slide-in-right 0.3s ease reverse';
      setTimeout(() => badge.remove(), 300);
    }, 5000);
  }

  /**
   * Check if user is in admin mode
   */
  async checkAdminMode() {
    const stored = await chrome.storage.local.get(['ig_walkthrough_admin_mode']);
    return stored.ig_walkthrough_admin_mode === true;
  }

  /**
   * Clear all indicators
   */
  clearAll() {
    if (this.adminBadge) {
      this.adminBadge.remove();
      this.adminBadge = null;
    }
    if (this.modeIndicator) {
      this.modeIndicator.remove();
      this.modeIndicator = null;
    }
    if (this.stepCounter) {
      this.stepCounter.remove();
      this.stepCounter = null;
    }
    if (this.userIndicator) {
      this.userIndicator.remove();
      this.userIndicator = null;
    }
  }
}

// Global instance
window.visualRoleIndicators = new VisualRoleIndicators();
