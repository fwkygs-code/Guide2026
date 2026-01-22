/**
 * Knowledge Systems Navigation Bar
 *
 * Bottom navigation bar for portal pages showing enabled knowledge systems.
 * Completely isolated from existing portal logic.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEnabledKnowledgeSystems } from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge Systems Navigation Bar
 * Appears at bottom of portal pages for enabled systems
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

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {enabledSystems.map(system => {
                    const config = getKnowledgeSystemConfig(system.type);
                    if (!config) return null;

                    return (
                      <Button
                        key={system.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSystemClick(system)}
                        className="flex items-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
                      >
                        <span className="text-lg">{config.icon}</span>
                        <span className="text-sm">{system.title}</span>
                      </Button>
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