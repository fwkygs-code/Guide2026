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
        return 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'; // Exact from KnowledgeSystemsPage
      case 'outline':
        return 'border-slate-600 text-slate-300 hover:bg-slate-800'; // Exact from KnowledgeSystemsPage
      case 'ghost':
        return 'text-slate-600 hover:text-slate-900'; // Exact from PolicyPortalPage
      case 'amber':
        return 'bg-amber-600 hover:bg-amber-700'; // Exact from PolicyPortalPage
      case 'card':
        return UTILITIES.button.enabled; // Exact from KnowledgeSystemCard
      default:
        return 'bg-slate-600 hover:bg-slate-700 text-white';
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