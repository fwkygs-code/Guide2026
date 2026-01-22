/**
 * Panel - Shared Design System Primitive
 *
 * Large content panel matching Knowledge Systems patterns.
 * DO NOT MODIFY - This matches Knowledge Systems reference implementation.
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import { SPACING } from '../../../utils/designTokens';

/**
 * Panel - Large content container
 */
function Panel({
  variant = 'content',
  className = '',
  children,
  ...props
}) {
  const getPanelClasses = () => {
    switch (variant) {
      case 'page':
        return SPACING.container.page;
      case 'content':
        return SPACING.container.content;
      case 'card':
        return SPACING.container.card;
      case 'header':
        return SPACING.container.header;
      case 'nav':
        return SPACING.container.nav;
      default:
        return SPACING.container.content;
    }
  };

  return (
    <div
      className={cn(getPanelClasses(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Panel;