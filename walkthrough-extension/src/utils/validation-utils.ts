export class ValidationUtils {
  static isValidSelector(selector: string): boolean {
    try {
      document.querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static sanitizeSelector(selector: string): string {
    // Remove potentially dangerous characters
    return selector.replace(/[<>'"]/g, '').trim();
  }
  
  static validateStepDefinition(step: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!step.id || typeof step.id !== 'string') {
      errors.push('Step must have a valid id');
    }
    
    if (typeof step.index !== 'number' || step.index < 0) {
      errors.push('Step must have a valid index (number >= 0)');
    }
    
    if (!step.title || typeof step.title !== 'string') {
      errors.push('Step must have a valid title');
    }
    
    if (!step.description || typeof step.description !== 'string') {
      errors.push('Step must have a valid description');
    }
    
    if (!step.targeting) {
      errors.push('Step must have targeting configuration');
    } else {
      const targetingErrors = this.validateTargetingStrategy(step.targeting);
      errors.push(...targetingErrors);
    }
    
    if (!step.validation) {
      errors.push('Step must have validation configuration');
    } else {
      const validationErrors = this.validateValidationRules(step.validation);
      errors.push(...validationErrors);
    }
    
    if (!step.behavior) {
      errors.push('Step must have behavior configuration');
    } else {
      const behaviorErrors = this.validateStepBehavior(step.behavior);
      errors.push(...behaviorErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static validateTargetingStrategy(targeting: any): string[] {
    const errors: string[] = [];
    
    if (!targeting.selector || typeof targeting.selector !== 'string') {
      errors.push('Targeting must have a valid selector');
    } else if (!this.isValidSelector(targeting.selector)) {
      errors.push('Targeting selector is invalid');
    }
    
    if (targeting.fallbackSelectors) {
      if (!Array.isArray(targeting.fallbackSelectors)) {
        errors.push('Fallback selectors must be an array');
      } else {
        targeting.fallbackSelectors.forEach((selector: string, index: number) => {
          if (!this.isValidSelector(selector)) {
            errors.push(`Fallback selector at index ${index} is invalid`);
          }
        });
      }
    }
    
    if (!targeting.constraints) {
      errors.push('Targeting must have constraints configuration');
    } else {
      if (typeof targeting.constraints.mustBeVisible !== 'boolean') {
        errors.push('Targeting constraints mustBeVisible must be a boolean');
      }
      
      if (typeof targeting.constraints.mustBeInteractable !== 'boolean') {
        errors.push('Targeting constraints mustBeInteractable must be a boolean');
      }
      
      if (typeof targeting.constraints.mustBeInViewport !== 'boolean') {
        errors.push('Targeting constraints mustBeInViewport must be a boolean');
      }
    }
    
    if (!targeting.search) {
      errors.push('Targeting must have search configuration');
    } else {
      if (typeof targeting.search.timeout !== 'number' || targeting.search.timeout <= 0) {
        errors.push('Targeting search timeout must be a positive number');
      }
      
      if (typeof targeting.search.maxRetries !== 'number' || targeting.search.maxRetries < 0) {
        errors.push('Targeting search maxRetries must be a non-negative number');
      }
      
      if (!['document', 'shadow-dom', 'iframe'].includes(targeting.search.searchScope)) {
        errors.push('Targeting search searchScope must be one of: document, shadow-dom, iframe');
      }
    }
    
    return errors;
  }
  
  static validateValidationRules(validation: any): string[] {
    const errors: string[] = [];
    
    if (!validation.completion) {
      errors.push('Validation must have completion configuration');
    } else {
      if (!['click', 'hover', 'input', 'custom', 'automatic'].includes(validation.completion.type)) {
        errors.push('Validation completion type must be one of: click, hover, input, custom, automatic');
      }
      
      if (typeof validation.completion.requireInteraction !== 'boolean') {
        errors.push('Validation completion requireInteraction must be a boolean');
      }
      
      if (typeof validation.completion.interactionTimeout !== 'number' || validation.completion.interactionTimeout <= 0) {
        errors.push('Validation completion interactionTimeout must be a positive number');
      }
    }
    
    if (validation.preconditions) {
      if (validation.preconditions.urlPattern && typeof validation.preconditions.urlPattern !== 'string') {
        errors.push('Validation preconditions urlPattern must be a string');
      }
      
      if (validation.preconditions.elementExists && typeof validation.preconditions.elementExists !== 'string') {
        errors.push('Validation preconditions elementExists must be a string');
      }
    }
    
    if (validation.postconditions) {
      if (validation.postconditions.elementChanged && typeof validation.postconditions.elementChanged !== 'string') {
        errors.push('Validation postconditions elementChanged must be a string');
      }
      
      if (typeof validation.postconditions.urlChanged !== 'boolean') {
        errors.push('Validation postconditions urlChanged must be a boolean');
      }
    }
    
    if (!validation.state) {
      errors.push('Validation must have state configuration');
    } else {
      if (typeof validation.state.validateBeforeStep !== 'boolean') {
        errors.push('Validation state validateBeforeStep must be a boolean');
      }
      
      if (typeof validation.state.validateAfterStep !== 'boolean') {
        errors.push('Validation state validateAfterStep must be a boolean');
      }
      
      if (typeof validation.state.strictValidation !== 'boolean') {
        errors.push('Validation state strictValidation must be a boolean');
      }
    }
    
    return errors;
  }
  
  static validateStepBehavior(behavior: any): string[] {
    const errors: string[] = [];
    
    if (!behavior.blocking) {
      errors.push('Behavior must have blocking configuration');
    } else {
      if (typeof behavior.blocking.blockNavigation !== 'boolean') {
        errors.push('Behavior blocking blockNavigation must be a boolean');
      }
      
      if (typeof behavior.blocking.blockScrolling !== 'boolean') {
        errors.push('Behavior blocking blockScrolling must be a boolean');
      }
      
      if (typeof behavior.blocking.blockClicks !== 'boolean') {
        errors.push('Behavior blocking blockClicks must be a boolean');
      }
      
      if (typeof behavior.blocking.allowEscKey !== 'boolean') {
        errors.push('Behavior blocking allowEscKey must be a boolean');
      }
    }
    
    if (!behavior.autoAdvance) {
      errors.push('Behavior must have autoAdvance configuration');
    } else {
      if (typeof behavior.autoAdvance.enabled !== 'boolean') {
        errors.push('Behavior autoAdvance enabled must be a boolean');
      }
      
      if (typeof behavior.autoAdvance.delay !== 'number' || behavior.autoAdvance.delay < 0) {
        errors.push('Behavior autoAdvance delay must be a non-negative number');
      }
      
      if (typeof behavior.autoAdvance.requireValidation !== 'boolean') {
        errors.push('Behavior autoAdvance requireValidation must be a boolean');
      }
    }
    
    if (!behavior.retry) {
      errors.push('Behavior must have retry configuration');
    } else {
      if (typeof behavior.retry.enabled !== 'boolean') {
        errors.push('Behavior retry enabled must be a boolean');
      }
      
      if (typeof behavior.retry.maxAttempts !== 'number' || behavior.retry.maxAttempts < 0) {
        errors.push('Behavior retry maxAttempts must be a non-negative number');
      }
      
      if (!['linear', 'exponential'].includes(behavior.retry.backoffStrategy)) {
        errors.push('Behavior retry backoffStrategy must be one of: linear, exponential');
      }
      
      if (typeof behavior.retry.retryDelay !== 'number' || behavior.retry.retryDelay < 0) {
        errors.push('Behavior retry retryDelay must be a non-negative number');
      }
    }
    
    if (!behavior.skip) {
      errors.push('Behavior must have skip configuration');
    } else {
      if (typeof behavior.skip.allowSkip !== 'boolean') {
        errors.push('Behavior skip allowSkip must be a boolean');
      }
      
      if (behavior.skip.skipKey && typeof behavior.skip.skipKey !== 'string') {
        errors.push('Behavior skip skipKey must be a string');
      }
      
      if (typeof behavior.skip.requireConfirmation !== 'boolean') {
        errors.push('Behavior skip requireConfirmation must be a boolean');
      }
    }
    
    return errors;
  }
  
  static validateWalkthroughDefinition(definition: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!definition.id || typeof definition.id !== 'string') {
      errors.push('Walkthrough must have a valid id');
    }
    
    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Walkthrough must have a valid name');
    }
    
    if (!definition.description || typeof definition.description !== 'string') {
      errors.push('Walkthrough must have a valid description');
    }
    
    if (!definition.version || typeof definition.version !== 'string') {
      errors.push('Walkthrough must have a valid version');
    }
    
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
      errors.push('Walkthrough must have at least one step');
    } else {
      definition.steps.forEach((step: any, index: number) => {
        const stepValidation = this.validateStepDefinition(step);
        if (!stepValidation.valid) {
          errors.push(`Step at index ${index}: ${stepValidation.errors.join(', ')}`);
        }
      });
    }
    
    if (!definition.configuration) {
      errors.push('Walkthrough must have configuration');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone);
  }
  
  static validateRequired(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    return true;
  }
  
  static validateLength(value: string, min?: number, max?: number): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    
    const length = value.length;
    
    if (min !== undefined && length < min) {
      return false;
    }
    
    if (max !== undefined && length > max) {
      return false;
    }
    
    return true;
  }
  
  static validateRange(value: number, min?: number, max?: number): boolean {
    if (typeof value !== 'number') {
      return false;
    }
    
    if (min !== undefined && value < min) {
      return false;
    }
    
    if (max !== undefined && value > max) {
      return false;
    }
    
    return true;
  }
  
  static validateRegex(value: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(value);
    } catch (error) {
      return false;
    }
  }
  
  static validateEnum(value: any, allowedValues: any[]): boolean {
    return allowedValues.includes(value);
  }
  
  static validateObject(value: any, requiredKeys: string[]): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    
    return requiredKeys.every(key => key in value);
  }
  
  static sanitizeInput(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    trim?: boolean;
  } = {}): string {
    let sanitized = input;
    
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }
    
    if (options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }
    
    if (options.allowHTML !== true) {
      // Remove HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }
    
    return sanitized;
  }
}
