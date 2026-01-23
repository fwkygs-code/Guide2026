/**
 * ConfigPanel - Futuristic Right-Side Configuration Panel
 *
 * Sliding configuration panel with progressive disclosure.
 * Glass morphism surface with content-type specific theming.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SURFACES, BORDERS, SHADOWS, MOTION } from '../../../utils/designTokens';

const ConfigPanel = ({
  isOpen,
  onClose,
  title = 'Configuration',
  system = null,
  children,
  className = ''
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              duration: 0.3
            }}
            className={cn(
              'fixed right-0 top-0 h-full w-96 z-50',
              getPanelSurface(system),
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  getIconBg(system)
                )}>
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
              </div>

              <motion.button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {children}
              </div>
            </div>

            {/* Subtle bottom gradient */}
            <div className={cn(
              'absolute bottom-0 left-0 right-0 h-32 pointer-events-none',
              getBottomGradient(system)
            )} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Get panel surface styling based on content type
const getPanelSurface = (system) => {
  if (system) {
    return cn(
      SURFACES.glass.primary,
      BORDERS.glass.primary,
      SHADOWS.glass.strong
    );
  }
  return cn(
    SURFACES.glass.primary,
    BORDERS.glass.primary,
    SHADOWS.glass.strong
  );
};

// Get icon background based on content type
const getIconBg = (system) => {
  const bgMap = {
    policy: 'bg-gradient-to-br from-amber-500 to-orange-600',
    procedure: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    documentation: 'bg-gradient-to-br from-purple-500 to-violet-600',
    faq: 'bg-gradient-to-br from-emerald-500 to-green-600',
    decisionTree: 'bg-gradient-to-br from-indigo-500 to-purple-600'
  };
  return bgMap[system] || 'bg-slate-600';
};

// Get bottom gradient based on content type
const getBottomGradient = (system) => {
  const gradientMap = {
    policy: 'bg-gradient-to-t from-amber-500/10 to-transparent',
    procedure: 'bg-gradient-to-t from-cyan-500/10 to-transparent',
    documentation: 'bg-gradient-to-t from-purple-500/10 to-transparent',
    faq: 'bg-gradient-to-t from-emerald-500/10 to-transparent',
    decisionTree: 'bg-gradient-to-t from-indigo-500/10 to-transparent'
  };
  return gradientMap[system] || 'bg-gradient-to-t from-slate-500/10 to-transparent';
};

export default ConfigPanel;