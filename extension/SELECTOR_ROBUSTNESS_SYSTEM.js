/**
 * SELECTOR ROBUSTNESS SYSTEM
 * Layered selector resolution with fallbacks and stability scoring
 */

class SelectorEngine {
  constructor(config = {}) {
    this.config = {
      maxRetries: config.maxRetries || 10,
      retryInterval: config.retryInterval || 500, // ms
      mutationTimeout: config.mutationTimeout || 5000,
      ...config
    };
    
    this.observer = null;
    this.retryCount = 0;
    this.attempts = [];
  }

  /**
   * Main entry: Resolve a selector set to a DOM element
   */
  async resolve(selectorSet, context = document) {
    this.attempts = [];
    const startTime = performance.now();
    
    // Phase 1: Try primary selector immediately
    const primaryResult = await this._trySelector(
      selectorSet.primary, 
      context, 
      'primary'
    );
    
    if (primaryResult.success) {
      return this._buildResult(true, primaryResult.element, selectorSet.primary, startTime);
    }
    
    // Phase 2: Try fallback selectors
    for (const fallback of selectorSet.fallbacks || []) {
      const result = await this._trySelector(fallback, context, 'fallback');
      if (result.success) {
        return this._buildResult(true, result.element, fallback, startTime);
      }
    }
    
    // Phase 3: Try text-based match
    if (selectorSet.textMatch) {
      const textResult = await this._tryTextMatch(selectorSet.textMatch, context);
      if (textResult.success) {
        return this._buildResult(true, textResult.element, 
          { type: 'text_match', ...selectorSet.textMatch }, startTime);
      }
    }
    
    // Phase 4: Try structural fallback
    if (selectorSet.structural) {
      const structResult = await this._tryStructural(selectorSet.structural, context);
      if (structResult.success) {
        return this._buildResult(true, structResult.element,
          { type: 'structural', ...selectorSet.structural }, startTime);
      }
    }
    
    // Phase 5: Start mutation observer and retry
    const mutationResult = await this._waitForMutation(selectorSet, context);
    
    if (mutationResult.success) {
      return this._buildResult(true, mutationResult.element, 
        mutationResult.selectorUsed, startTime);
    }
    
    // All attempts failed
    return this._buildResult(false, null, null, startTime, 
      'All selector strategies failed');
  }

  /**
   * Try a single selector strategy
   */
  async _trySelector(selector, context, strategyType) {
    const startTime = performance.now();
    let element = null;
    
    try {
      switch (selector.type) {
        case 'css_id':
        case 'css_class':
        case 'css_attr':
        case 'css_path':
          element = context.querySelector(selector.value);
          break;
          
        case 'xpath':
          element = this._evaluateXPath(selector.value, context);
          break;
          
        case 'test_id':
          element = context.querySelector(`[data-testid="${selector.value}"]`);
          break;
          
        case 'aria_label':
          element = context.querySelector(`[aria-label="${selector.value}"]`);
          break;
          
        case 'custom_attr':
          element = context.querySelector(`[${selector.attribute}="${selector.value}"]`);
          break;
      }
      
      // Validate element is visible and interactive
      if (element && this._isValidTarget(element)) {
        this.attempts.push({
          strategy: strategyType,
          selector: selector,
          success: true,
          timeMs: performance.now() - startTime
        });
        return { success: true, element };
      }
      
    } catch (error) {
      // Selector syntax error or other issue
    }
    
    this.attempts.push({
      strategy: strategyType,
      selector: selector,
      success: false,
      timeMs: performance.now() - startTime,
      error: error?.message
    });
    
    return { success: false, element: null };
  }

  /**
   * Try text-based matching
   */
  async _tryTextMatch(textMatch, context) {
    const startTime = performance.now();
    
    try {
      // Build scope if provided
      const searchContext = textMatch.selectorContext 
        ? context.querySelector(textMatch.selectorContext) || context
        : context;
      
      // Try exact match first
      if (textMatch.exactText) {
        const elements = Array.from(searchContext.querySelectorAll('*'));
        const match = elements.find(el => 
          el.textContent?.trim() === textMatch.exactText &&
          this._isValidTarget(el)
        );
        if (match) {
          return { 
            success: true, 
            element: match,
            timeMs: performance.now() - startTime
          };
        }
      }
      
      // Try partial match
      if (textMatch.partialText) {
        const elements = Array.from(searchContext.querySelectorAll('*'));
        const match = elements.find(el =>
          el.textContent?.includes(textMatch.partialText) &&
          this._isValidTarget(el)
        );
        if (match) {
          return {
            success: true,
            element: match,
            timeMs: performance.now() - startTime
          };
        }
      }
      
    } catch (error) {
      // Text matching error
    }
    
    return { success: false, element: null };
  }

  /**
   * Try structural fallback (parent + child index)
   */
  async _tryStructural(structural, context) {
    const startTime = performance.now();
    
    try {
      const parent = context.querySelector(structural.parentSelector);
      if (!parent) return { success: false };
      
      const children = Array.from(parent.children);
      const filtered = structural.tagName 
        ? children.filter(c => c.tagName.toLowerCase() === structural.tagName.toLowerCase())
        : children;
      
      const element = filtered[structural.childIndex];
      if (element && this._isValidTarget(element)) {
        return {
          success: true,
          element,
          timeMs: performance.now() - startTime
        };
      }
      
    } catch (error) {
      // Structural resolution error
    }
    
    return { success: false, element: null };
  }

  /**
   * Wait for DOM mutations that might bring target into existence
   */
  async _waitForMutation(selectorSet, context) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = this.config.maxRetries;
      
      const tryResolve = async () => {
        attempts++;
        
        // Try all selectors again
        const primary = await this._trySelector(selectorSet.primary, context, 'primary');
        if (primary.success) {
          cleanup();
          return resolve({ 
            success: true, 
            element: primary.element,
            selectorUsed: selectorSet.primary
          });
        }
        
        for (const fallback of selectorSet.fallbacks || []) {
          const result = await this._trySelector(fallback, context, 'fallback');
          if (result.success) {
            cleanup();
            return resolve({
              success: true,
              element: result.element,
              selectorUsed: fallback
            });
          }
        }
        
        if (attempts >= maxAttempts) {
          cleanup();
          return resolve({ success: false, element: null });
        }
      };
      
      const cleanup = () => {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        clearInterval(intervalId);
      };
      
      // Set up mutation observer
      this.observer = new MutationObserver((mutations) => {
        // Check if any mutation might have added our target
        const hasRelevantChange = mutations.some(m => 
          m.type === 'childList' && m.addedNodes.length > 0
        );
        
        if (hasRelevantChange) {
          tryResolve();
        }
      });
      
      this.observer.observe(context.body || context, {
        childList: true,
        subtree: true,
        attributes: false // Don't care about attribute changes
      });
      
      // Also poll as fallback (for cases observer misses)
      const intervalId = setInterval(tryResolve, this.config.retryInterval);
      
      // Timeout
      setTimeout(() => {
        cleanup();
        resolve({ success: false, element: null, timedOut: true });
      }, this.config.mutationTimeout);
      
      // First attempt immediately
      tryResolve();
    });
  }

  /**
   * Check if element is a valid interaction target
   */
  _isValidTarget(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    // Must be visible
    if (rect.width === 0 || rect.height === 0) return false;
    if (style.visibility === 'hidden') return false;
    if (style.display === 'none') return false;
    if (style.opacity === '0') return false;
    
    // Must be in viewport or nearby (not scrolled way off)
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const isNearViewport = (
      rect.top < viewportHeight * 2 && // Within 2x viewport below
      rect.bottom > -viewportHeight &&  // Within 1x viewport above
      rect.left < viewportWidth * 2 &&
      rect.right > -viewportWidth
    );
    
    return isNearViewport;
  }

  /**
   * Evaluate XPath expression
   */
  _evaluateXPath(xpath, context) {
    try {
      const result = document.evaluate(
        xpath, 
        context, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      );
      return result.singleNodeValue;
    } catch (e) {
      return null;
    }
  }

  /**
   * Build final resolution result
   */
  _buildResult(success, element, selectorUsed, startTime, error = null) {
    const totalTime = performance.now() - startTime;
    
    return {
      success,
      element,
      selectorUsed,
      attempts: this.attempts,
      totalTimeMs: Math.round(totalTime),
      retryCount: this.attempts.filter(a => !a.success).length,
      error,
      suggestions: error ? this._generateSuggestions() : []
    };
  }

  /**
   * Generate helpful suggestions when resolution fails
   */
  _generateSuggestions() {
    return [
      'Wait for the page to fully load',
      'Check if the target is inside an iframe',
      'Verify the page URL matches the expected scope',
      'Try refreshing the page',
      'Contact support if this persists'
    ];
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

/**
 * SELECTOR STABILITY SCORER
 * Analyze selector robustness
 */
class SelectorStabilityScorer {
  /**
   * Score a CSS selector's stability (0-1)
   */
  static scoreSelector(selector, type) {
    switch (type) {
      case 'css_id':
        // IDs are generally stable
        return selector.includes('#') ? 1.0 : 0.9;
        
      case 'test_id':
        // Test IDs are very stable (designed for testing)
        return 1.0;
        
      case 'aria_label':
        // ARIA labels are stable (accessibility requirement)
        return 0.95;
        
      case 'css_class':
        // Classes vary - check for hashed classes
        if (/[a-zA-Z0-9]{5,}/.test(selector) && !selector.includes(' ')) {
          // Likely auto-generated hash
          return 0.3;
        }
        if (selector.includes('btn') || selector.includes('button')) {
          // Semantic class names
          return 0.8;
        }
        return 0.6;
        
      case 'css_path':
        // Full paths are fragile
        const depth = selector.split('>').length;
        if (depth > 3) return 0.3;
        if (depth > 5) return 0.1;
        return 0.5;
        
      case 'xpath':
        // XPath with indices is fragile
        if (/\[\d+\]/.test(selector)) return 0.3;
        if (selector.includes('contains')) return 0.5;
        return 0.4;
        
      case 'text_match':
        // Text can change with localization
        return 0.4;
        
      default:
        return 0.5;
    }
  }

  /**
   * Calculate overall stability for a selector set
   */
  static scoreSelectorSet(selectorSet) {
    const primaryScore = this.scoreSelector(
      selectorSet.primary.value, 
      selectorSet.primary.type
    );
    
    let totalScore = primaryScore * 0.5; // Primary is 50% weight
    
    // Fallbacks contribute 30% evenly
    if (selectorSet.fallbacks?.length) {
      const fallbackAvg = selectorSet.fallbacks.reduce((sum, fb) => 
        sum + this.scoreSelector(fb.value, fb.type), 0
      ) / selectorSet.fallbacks.length;
      totalScore += fallbackAvg * 0.3;
    }
    
    // Text match contributes 15%
    if (selectorSet.textMatch) {
      totalScore += 0.4 * 0.15; // Text match is moderate stability
    }
    
    // Structural contributes 5%
    if (selectorSet.structural) {
      totalScore += 0.2 * 0.05; // Structural is fragile
    }
    
    return Math.round(totalScore * 100) / 100;
  }

  /**
   * Get human-readable stability label
   */
  static getStabilityLabel(score) {
    if (score >= 0.9) return { level: 'excellent', emoji: '✅', color: '#22c55e' };
    if (score >= 0.7) return { level: 'good', emoji: '👍', color: '#84cc16' };
    if (score >= 0.5) return { level: 'fair', emoji: '⚠️', color: '#eab308' };
    if (score >= 0.3) return { level: 'poor', emoji: '❗', color: '#f97316' };
    return { level: 'fragile', emoji: '🚫', color: '#ef4444' };
  }
}

/**
 * STEP AUTHORING VALIDATOR
 * Validate walkthrough steps before publishing
 */
class StepAuthoringValidator {
  static validateStep(step) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!step.id) errors.push('Step ID is required');
    if (!step.title) errors.push('Step title is required');
    if (!step.instructionText) warnings.push('Instruction text helps users understand what to do');
    
    // Selector validation
    if (!step.targetSelectors?.primary?.value) {
      errors.push('Primary selector is required');
    } else {
      const stability = SelectorStabilityScorer.scoreSelector(
        step.targetSelectors.primary.value,
        step.targetSelectors.primary.type
      );
      
      if (stability < 0.5) {
        warnings.push(`Primary selector stability is low (${stability}) - consider using ID or test-id`);
      }
      
      // Check for fallbacks
      if (!step.targetSelectors.fallbacks?.length) {
        warnings.push('No fallback selectors defined - step may break if primary selector changes');
      }
    }
    
    // URL scope validation
    if (!step.urlScope?.value) {
      errors.push('URL scope is required');
    } else {
      if (step.urlScope.type === 'any') {
        warnings.push('URL scope "any" matches all pages - may cause unexpected behavior');
      }
      
      if (step.urlScope.type === 'regex') {
        try {
          new RegExp(step.urlScope.value);
        } catch {
          errors.push('URL scope regex is invalid');
        }
      }
    }
    
    // Validation spec
    if (!step.validation?.rule) {
      warnings.push('No validation rule specified - step will auto-advance');
    }
    
    // Iframe check
    if (step.requiresIframeAccess && !step.iframeSelector) {
      warnings.push('Iframe access required but no iframe selector specified');
    }
    
    // Action clarity
    if (step.requiredAction === 'custom' && !step.actionConfig?.customFunction) {
      errors.push('Custom action requires customFunction definition');
    }
    
    // Calculate overall stability
    const stabilityScore = step.targetSelectors 
      ? SelectorStabilityScorer.scoreSelectorSet(step.targetSelectors)
      : 0;
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stabilityScore,
      stabilityLabel: SelectorStabilityScorer.getStabilityLabel(stabilityScore)
    };
  }

  static validateWalkthrough(walkthrough) {
    const errors = [];
    const warnings = [];
    
    if (!walkthrough.id) errors.push('Walkthrough ID is required');
    if (!walkthrough.title) errors.push('Title is required');
    if (!walkthrough.steps?.length) errors.push('At least one step is required');
    
    // Check for duplicate step IDs
    const stepIds = walkthrough.steps?.map(s => s.id) || [];
    const duplicates = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicates.length) {
      errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
    }
    
    // Validate each step
    const stepValidations = (walkthrough.steps || []).map(step => 
      this.validateStep(step)
    );
    
    const avgStability = stepValidations.reduce((sum, v) => sum + v.stabilityScore, 0) 
      / (stepValidations.length || 1);
    
    stepValidations.forEach((result, i) => {
      result.errors.forEach(e => errors.push(`Step ${i + 1}: ${e}`));
      result.warnings.forEach(w => warnings.push(`Step ${i + 1}: ${w}`));
    });
    
    if (avgStability < 0.6) {
      warnings.push(`Average selector stability is low (${avgStability.toFixed(2)}) - walkthrough may be brittle`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      avgStability,
      stepCount: walkthrough.steps?.length || 0,
      canPublish: errors.length === 0 && avgStability >= 0.5
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SelectorEngine,
    SelectorStabilityScorer,
    StepAuthoringValidator
  };
}
