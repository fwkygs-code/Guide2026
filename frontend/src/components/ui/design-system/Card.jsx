/**
 * Futuristic Card - Enhanced Content Container
 *
 * Advanced card component with content-type specific glass morphism,
 * atmospheric effects, and purpose-driven animations.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { SURFACES, BORDERS, SHADOWS, MOTION, TYPOGRAPHY } from '../../../utils/designTokens';

/**
 * Card - Futuristic content container
 */
function Card({
  system = null,
  variant = 'default',
  animated = true,
  animationIndex = 0,
  interactive = false,
  className = '',
  children,
  ...props
}) {
  // Get content-type specific styling
  const getCardClasses = () => {
    const baseClasses = 'relative overflow-hidden rounded-xl backdrop-blur-xl';

    let surfaceClasses = '';
    let borderClasses = '';
    let shadowClasses = '';

    if (system) {
      // Content-type specific styling
      surfaceClasses = SURFACES.card[system];
      borderClasses = BORDERS.card[system];
      shadowClasses = interactive ? SHADOWS.interactive.glow : SHADOWS.card[system];
    } else {
      // Default glass styling
      surfaceClasses = SURFACES.glass.secondary;
      borderClasses = BORDERS.glass.secondary;
      shadowClasses = interactive ? SHADOWS.interactive.lift : SHADOWS.glass.medium;
    }

    return cn(
      baseClasses,
      surfaceClasses,
      borderClasses,
      shadowClasses,
      interactive && 'cursor-pointer transform-gpu group',
      className
    );
  };

  // Get animation configuration
  const getAnimationConfig = () => {
    if (!animated) return {};

    if (system && MOTION.card[system]) {
      return {
        initial: MOTION.card[system].initial,
        animate: MOTION.card[system].animate,
        transition: {
          ...MOTION.card[system].transition,
          delay: typeof MOTION.card[system].transition.delay === 'function'
            ? MOTION.card[system].transition.delay(animationIndex)
            : animationIndex * 0.1
        }
      };
    }

    // Default animation
    return {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, delay: animationIndex * 0.1 }
    };
  };

  const cardClasses = getCardClasses();
  const animationProps = getAnimationConfig();

  const content = (
    <motion.div
      className={cardClasses}
      {...animationProps}
      whileHover={interactive ? MOTION.interactive.hover : undefined}
      whileTap={interactive ? MOTION.interactive.tap : undefined}
      {...props}
    >
      {/* Enhanced shimmer effect */}
      {interactive && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
      )}

      {/* Subtle inner glow for content types */}
      {system && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      )}

      {children}
    </motion.div>
  );

  return content;
}

/**
 * Card Header - Futuristic header with content-type awareness
 */
function CardHeader({ system, className = '', children, ...props }) {
  return (
    <div
      className={cn('relative pb-6', className)}
      {...props}
    >
      {/* Subtle gradient accent line */}
      {system && (
        <div className={cn(
          'absolute top-0 left-0 right-0 h-px',
          system === 'policy' && 'bg-gradient-to-r from-transparent via-amber-400/50 to-transparent',
          system === 'procedure' && 'bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent',
          system === 'documentation' && 'bg-gradient-to-r from-transparent via-purple-400/50 to-transparent',
          system === 'faq' && 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent',
          system === 'decisionTree' && 'bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent'
        )} />
      )}
      {children}
    </div>
  );
}

/**
 * Card Title - Content-type specific typography
 */
function CardTitle({ system, className = '', children, ...props }) {
  const getTitleClasses = () => {
    if (system && TYPOGRAPHY.contentType[system]) {
      return TYPOGRAPHY.contentType[system].heading;
    }
    return 'text-xl font-bold text-white';
  };

  return (
    <h3
      className={cn(getTitleClasses(), 'mb-2', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * Card Description - Content-type specific styling
 */
function CardDescription({ system, className = '', children, ...props }) {
  const getDescriptionClasses = () => {
    if (system && TYPOGRAPHY.contentType[system]) {
      return TYPOGRAPHY.contentType[system].subheading;
    }
    return 'text-slate-300 text-sm leading-relaxed';
  };

  return (
    <p
      className={cn(getDescriptionClasses(), className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Card Content - Enhanced with glass effects
 */
function CardContent({ system, className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'relative',
        system && TYPOGRAPHY.contentType[system] && TYPOGRAPHY.contentType[system].body,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Footer - Futuristic footer with glass border
 */
function CardFooter({ system, className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'mt-8 pt-6 border-t border-white/10 flex justify-end gap-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Export compound component
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

// Export individual components for named imports
export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

export default Card;