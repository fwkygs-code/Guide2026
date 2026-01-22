/**
 * Card - Shared Design System Primitive
 *
 * Card component matching Knowledge Systems exactly.
 * DO NOT MODIFY - This matches Knowledge Systems reference implementation.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { SURFACES, BORDERS, SHADOWS, MOTION, UTILITIES } from '../../../utils/designTokens';

/**
 * Card - Content container matching Knowledge Systems
 */
function Card({
  system = null,
  animated = false,
  animationIndex = 0,
  interactive = false,
  className = '',
  children,
  ...props
}) {
  const cardClasses = cn(
    'relative overflow-hidden',
    system ? `${SURFACES.card[system] || SURFACES.card.base} backdrop-blur-sm` : SURFACES.glass,
    system ? `border ${BORDERS.card[system] || BORDERS.card.base}` : `border ${BORDERS.glass}`,
    interactive ? `${SHADOWS.card} ${SHADOWS.hover} transition-all duration-300 group` : SHADOWS.small,
    UTILITIES.card,
    className
  );

  const content = (
    <div className={cardClasses} {...props}>
      {/* Animated background effect - exact from Knowledge Systems */}
      {interactive && (
        <div className={cn(UTILITIES.animation, MOTION.background.hover)} />
      )}
      {children}
    </div>
  );

  // Apply animation if requested - exact from Knowledge Systems
  if (animated) {
    return (
      <motion.div
        initial={MOTION.card.initial}
        animate={MOTION.card.animate}
        transition={{
          ...MOTION.card.transition,
          delay: animationIndex * 0.1
        }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

/**
 * Card Header - Exact from Knowledge Systems
 */
function CardHeader({ className = '', children, ...props }) {
  return (
    <div
      className={cn('pb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Title - Exact from Knowledge Systems
 */
function CardTitle({ className = '', children, ...props }) {
  return (
    <h3
      className={cn('text-xl font-bold text-white mb-1', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * Card Description - Exact from Knowledge Systems
 */
function CardDescription({ className = '', children, ...props }) {
  return (
    <p
      className={cn('text-slate-300 text-sm leading-relaxed', className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Card Content - Exact from Knowledge Systems
 */
function CardContent({ className = '', children, ...props }) {
  return (
    <div
      className={cn('', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Footer - Matching Knowledge Systems patterns
 */
function CardFooter({ className = '', children, ...props }) {
  return (
    <div
      className={cn('mt-6 pt-4 border-t border-white/20 flex justify-end gap-3', className)}
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

export default Card;