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
      {/* TEMP – mobile-only app shell background test */}
      <style jsx>{`
        @media (max-width: 768px) {
          [data-app-shell] {
            background-color: #000 !important;
            background-image: none !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

export default AppShell;