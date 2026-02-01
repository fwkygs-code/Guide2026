/**
 * AppShell - Canonical Application Shell
 *
 * Extracted from Knowledge Systems - the single source of truth for app layout.
 * Provides the root background, gradients, and global layout structure.
 *
 * DO NOT MODIFY - This matches Knowledge Systems exactly.
 */

import React from 'react';
import { cn } from '../../../lib/utils';

/**
 * AppShell - Root application container
 */
function AppShell({ children, className = '' }) {
  return (
    <div className={cn(
      'min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      className
    )} data-app-shell>
      {/* TEMP – mobile-only loading screens background test */}
      <style jsx>{`
        @media (max-width: 768px) {
          /* Target loading screens: min-h-screen + centering + WorkspaceLoader */
          [data-app-shell] main div.min-h-screen.flex.items-center.justify-center {
            background-color: #000 !important;
            background-image: none !important;
          }
          /* Also target Surface loading screens */
          [data-app-shell] [data-loading-screen="true"] {
            background-color: #000 !important;
            background-image: none !important;
            backdrop-filter: none !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

export default AppShell;