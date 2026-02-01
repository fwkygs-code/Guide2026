/**
 * Futuristic Surface - Enhanced Glass Morphism
 *
 * Advanced glass morphism surfaces with content-type specific styling,
 * atmospheric effects, and micro-animations.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { SURFACES, MOTION, SHADOWS } from '../../../utils/designTokens';

/**
 * Surface - Futuristic glass morphism surface
 */
function Surface({
  variant = 'glass',
  system = null,
  animated = true,
  interactive = false,
  className = '',
  children,
  ...props
}) {
  const getSurfaceClasses = () => {
    switch (variant) {
      case 'dark':
        return SURFACES.dark;
      case 'glass-primary':
        return SURFACES.glass.primary;
      case 'glass-secondary':
        return SURFACES.glass.secondary;
      case 'glass-accent':
        return SURFACES.glass.accent;
      case 'floating-light':
        return SURFACES.floating.light;
      case 'floating-dark':
        return SURFACES.floating.dark;
      case 'header':
        return system ? SURFACES.header[system] : SURFACES.glass.primary;
      case 'card':
        return system ? SURFACES.card[system] : SURFACES.glass.secondary;
      default:
        return SURFACES.glass.primary;
    }
  };

  const getShadowClasses = () => {
    if (system && SHADOWS.card[system]) {
      return interactive ? SHADOWS.interactive.glow : SHADOWS.card[system];
    }
    return interactive ? SHADOWS.interactive.lift : SHADOWS.glass.medium;
  };

  const surfaceClasses = cn(
    getSurfaceClasses(),
    getShadowClasses(),
    interactive && 'cursor-pointer transform-gpu',
    className
  );

  const Component = animated ? motion.div : 'div';

  const animationProps = animated ? {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
    whileHover: interactive ? MOTION.interactive.hover : undefined,
    whileTap: interactive ? MOTION.interactive.tap : undefined
  } : {};

  return (
    <Component
      className={surfaceClasses}
      data-surface={variant}
      {...animationProps}
      {...props}
    >
      {/* TEMP – mobile-only surface background test */}
      {variant === 'glass' && (
        <style jsx>{`
          @media (max-width: 768px) {
            [data-surface="glass"] {
              background-color: #000 !important;
              background-image: none !important;
              backdrop-filter: none !important;
            }
          }
        `}</style>
      )}
      {children}
    </Component>
  );
}

export default Surface;