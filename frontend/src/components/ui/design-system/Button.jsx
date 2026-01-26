/**
 * Button - Shared Design System Primitive
 *
 * Interactive button matching Knowledge Systems exactly.
 * DO NOT MODIFY - This matches Knowledge Systems reference implementation.
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import { UTILITIES, COLORS } from '../../../utils/designTokens';

/**
 * Button - Interactive element matching Knowledge Systems
 */
function Button({
  variant = 'primary',
  system = null,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const getButtonClasses = () => {
    if (disabled) {
      return UTILITIES.button.disabled;
    }

    switch (variant) {
      case 'primary':
        return 'bg-primary hover:bg-primary/90 text-primary-foreground';
      case 'outline':
        return 'border-border text-foreground hover:bg-secondary';
      case 'ghost':
        return 'text-muted-foreground hover:text-foreground hover:bg-secondary/50';
      case 'amber':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      case 'card':
        return UTILITIES.button.enabled;
      default:
        return 'bg-secondary hover:bg-secondary/90 text-secondary-foreground';
    }
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
        getButtonClasses(),
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;