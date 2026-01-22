/**
 * PageHeader - Canonical Page Header
 *
 * Extracted from Knowledge Systems - provides consistent title, description, and actions.
 * Used by every page without exception.
 *
 * DO NOT MODIFY - This matches Knowledge Systems exactly.
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * PageHeader - Standardized page header
 */
function PageHeader({
  title,
  description,
  actions,
  icon,
  className = ''
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Overlay - exact from Knowledge Systems */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
      <div className="relative max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4 mb-2">
            {icon && (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                {title}
              </h1>
              {description && (
                <p className="text-slate-400 mt-2 text-lg">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex gap-3"
            >
              {actions}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default PageHeader;