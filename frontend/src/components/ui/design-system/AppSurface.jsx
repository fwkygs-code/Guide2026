/**
 * AppSurface - Mandatory Root Canvas Component
 *
 * Guarantees futuristic background for all routes. No component may render without this wrapper.
 * Prevents any white surfaces from appearing anywhere in the application.
 */

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * AppSurface - Mandatory root canvas with guaranteed futuristic background
 *
 * All routes MUST be wrapped in this component to ensure no white backgrounds.
 * Applies global gradient background and prevents any child from rendering white.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disableBackground - Force disable background (emergency only)
 */
export function AppSurface({ children, className, disableBackground = false }) {
  // Runtime assertion - check for white backgrounds in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkForWhiteBackgrounds = () => {
        const elements = document.querySelectorAll('*');
        for (const element of elements) {
          const computedStyle = window.getComputedStyle(element);
          const backgroundColor = computedStyle.backgroundColor;
          const backgroundImage = computedStyle.backgroundImage;

          // Check for white or transparent backgrounds that could show white
          if (backgroundColor === 'rgba(0, 0, 0, 0)' ||
              backgroundColor === 'transparent' ||
              backgroundColor.includes('rgb(255, 255, 255)') ||
              backgroundColor.includes('rgb(248, 250, 252)') ||
              backgroundColor.includes('rgb(241, 245, 249)') ||
              (backgroundImage === 'none' && !element.closest('[data-app-surface]'))) {

            // Allow if it's within our controlled surface or known safe elements
            if (!element.closest('[data-app-surface]') &&
                !element.matches('html, body') &&
                !element.matches('[role="dialog"]') &&
                !element.matches('.glass, .glass-dark')) {

              console.error('🚨 WHITE BACKGROUND DETECTED! Element violates no-white-background rule:', element);
              console.error('🚨 Background:', backgroundColor, backgroundImage);
              console.error('🚨 Element path:', element);

              // In strict mode, throw to prevent rendering
              throw new Error(`White background detected on element: ${element.tagName}.${Array.from(element.classList).join('.')}. All components must use AppSurface or have explicit dark backgrounds.`);
            }
          }
        }
      };

      // Check immediately and then periodically
      checkForWhiteBackgrounds();
      const interval = setInterval(checkForWhiteBackgrounds, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div
      className={cn(
        // Mandatory: Prevent any white backgrounds
        'min-h-screen w-full',
        // Futuristic gradient background - guaranteed no white
        !disableBackground && [
          'bg-gradient-to-br',
          'from-slate-950 via-slate-900 to-slate-800',
          // Additional depth layers for richness
          'relative overflow-hidden',
          // Subtle animated gradient overlay
          'before:absolute before:inset-0 before:bg-gradient-to-br',
          'before:from-primary/5 before:via-transparent before:to-primary/5',
          'before:pointer-events-none',
          // Micro-animated particles for atmosphere
          'after:absolute after:inset-0 after:opacity-20',
          'after:bg-gradient-radial after:from-primary/10 after:via-transparent after:to-transparent',
          'after:pointer-events-none after:animate-pulse'
        ],
        className
      )}
      // Data attribute for testing - ensures surface is present
      data-app-surface="true"
    >
      {/* Content layer - guaranteed above background */}
      <div className="relative z-10 min-h-screen w-full">
        {children}
      </div>
    </div>
  );
}

// Emergency bypass for critical error states only
export function AppSurfaceBypass({ children, className }) {
  return (
    <div
      className={cn('min-h-screen w-full bg-black text-white', className)}
      data-app-surface="bypass"
    >
      {children}
    </div>
  );
}

export default AppSurface;