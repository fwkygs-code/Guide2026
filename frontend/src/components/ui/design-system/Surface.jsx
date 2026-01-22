/**
 * Surface - Shared Design System Primitive
 *
 * Glass morphism surface matching Knowledge Systems exactly.
 * DO NOT MODIFY - This matches Knowledge Systems reference implementation.
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import { SURFACES } from '../../../utils/designTokens';

/**
 * Surface - Base surface with glass morphism
 */
function Surface({
  variant = 'glass',
  system = null,
  className = '',
  children,
  ...props
}) {
  const getSurfaceClasses = () => {
    switch (variant) {
      case 'dark':
        return SURFACES.dark;
      case 'glass':
        return SURFACES.glass;
      case 'floating':
        return SURFACES.floating;
      case 'header':
        return SURFACES.header;
      case 'card':
        return system ? SURFACES.card[system] || SURFACES.card.base : SURFACES.card.base;
      default:
        return SURFACES.glass;
    }
  };

  return (
    <div
      className={cn(getSurfaceClasses(), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Surface;