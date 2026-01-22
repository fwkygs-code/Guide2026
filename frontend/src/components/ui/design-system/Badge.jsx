/**
 * Badge - Shared Design System Primitive
 *
 * Status and label component matching Knowledge Systems exactly.
 * DO NOT MODIFY - This matches Knowledge Systems reference implementation.
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import { COLORS } from '../../../utils/designTokens';

/**
 * Badge - Status indicator matching Knowledge Systems
 */
function Badge({
  variant = 'secondary',
  system = null,
  className = '',
  children,
  ...props
}) {
  const getBadgeClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-amber-100 text-amber-800'; // Exact from PolicyPortalPage
      case 'success':
        return 'text-green-400'; // Exact from KnowledgeSystemCard status
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200'; // Exact from KnowledgeSystemsPage alert
      case 'error':
        return 'text-red-400';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center text-sm font-medium',
        getBadgeClasses(),
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;