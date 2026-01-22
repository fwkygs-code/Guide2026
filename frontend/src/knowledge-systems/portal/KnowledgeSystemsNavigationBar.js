/**
 * Knowledge Systems Navigation Bar - Futuristic Design
 *
 * Bottom navigation bar with type-specific visual cues.
 * Each system has distinct styling and micro-interactions.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEnabledKnowledgeSystems } from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge Systems Navigation Bar - Futuristic Design
 */
function KnowledgeSystemsNavigationBar({ workspaceId }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [enabledSystems, setEnabledSystems] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load enabled knowledge systems
  useEffect(() => {
    if (workspaceId) {
      const systems = getEnabledKnowledgeSystems(workspaceId);
      setEnabledSystems(systems);
    }
  }, [workspaceId]);

  // Don't render if no systems are enabled or if dismissed
  if (enabledSystems.length === 0 || isDismissed) {
    return null;
  }

  const handleSystemClick = (system) => {
    const config = getKnowledgeSystemConfig(system.type);
    if (config && config.portalPath) {
      navigate(`/portal/${slug}/knowledge/${config.portalPath}`);
    }
  };

  // Type-specific button styling
  const getButtonStyling = (type) => {
    switch (type) {
      case 'policy':
        return {
          base: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:from-amber-100 hover:to-orange-100',
          icon: 'text-amber-600',
          text: 'text-amber-900',
          shadow: 'shadow-amber-100'
        };
      case 'procedure':
        return {
          base: 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:from-blue-100 hover:to-cyan-100',
          icon: 'text-blue-600',
          text: 'text-blue-900',
          shadow: 'shadow-blue-100'
        };
      case 'documentation':
        return {
          base: 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100',
          icon: 'text-purple-600',
          text: 'text-purple-900',
          shadow: 'shadow-purple-100'
        };
      case 'faq':
        return {
          base: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100',
          icon: 'text-green-600',
          text: 'text-green-900',
          shadow: 'shadow-green-100'
        };
      case 'decision_tree':
        return {
          base: 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200 hover:from-indigo-100 hover:to-violet-100',
          icon: 'text-indigo-600',
          text: 'text-indigo-900',
          shadow: 'shadow-indigo-100'
        };
      default:
        return {
          base: 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 hover:from-slate-100 hover:to-slate-200',
          icon: 'text-slate-600',
          text: 'text-slate-900',
          shadow: 'shadow-slate-100'
        };
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{
          y: isMinimized ? 60 : 0,
          opacity: 1
        }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200/50 shadow-lg"
      >
        {/* Minimize/Maximize Toggle */}
        <div className="absolute -top-10 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="bg-white/90 backdrop-blur-sm shadow-md h-8 w-8 p-0"
          >
            <ChevronUp
              className={`h-4 w-4 transition-transform duration-200 ${
                isMinimized ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </div>

        {/* Dismiss Button */}
        <div className="absolute -top-10 right-14">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="bg-white/90 backdrop-blur-sm shadow-md h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Knowledge Base
                  </h3>
                  <span className="text-xs text-slate-500">
                    {enabledSystems.length} system{enabledSystems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {enabledSystems.map((system, index) => {
                    const config = getKnowledgeSystemConfig(system.type);
                    const styling = getButtonStyling(system.type);

                    if (!config) return null;

                    return (
                      <motion.div
                        key={system.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Button
                          onClick={() => handleSystemClick(system)}
                          className={`flex items-center gap-3 whitespace-nowrap ${styling.base} ${styling.shadow} border transition-all duration-200 hover:shadow-md hover:scale-105`}
                        >
                          <span className={`text-lg ${styling.icon}`}>{config.icon}</span>
                          <span className={`text-sm font-medium ${styling.text}`}>{system.title}</span>
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default KnowledgeSystemsNavigationBar;