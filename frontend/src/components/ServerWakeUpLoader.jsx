import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, Lock, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const LOADING_MESSAGES = [
  "Preparing secure session…",
  "Initializing application services…",
  "Loading account environment…",
  "Verifying secure connection…",
  "Finalizing login setup…"
];

const ServerWakeUpLoader = ({ onServerReady, isVisible }) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  // Rotate through messages every 3 seconds
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Check server health continuously
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    let currentController = null;
    let checkInterval = null;

    const checkServerHealth = async () => {
      if (!isMounted) return;

      // Cancel any existing request
      if (currentController) {
        currentController.abort();
      }

      try {
        const rawBase = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
        const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
        
        // Create abort controller for request cancellation
        currentController = new AbortController();
        const timeoutId = setTimeout(() => {
          currentController.abort();
        }, 5000);
        
        // Try /health first, then /api/health as fallback
        let response;
        let healthUrl = `${API_BASE}/health`;
        
        try {
          response = await axios.get(healthUrl, {
            timeout: 5000,
            signal: currentController.signal,
            validateStatus: (status) => status < 500
          });
        } catch (err) {
          clearTimeout(timeoutId);
          
          if (currentController.signal.aborted || err.name === 'AbortError' || err.code === 'ECONNABORTED') {
            throw new Error('Request timeout');
          }
          
          // If /health fails with 404, try /api/health
          if (err.response?.status === 404) {
            healthUrl = `${API_BASE}/api/health`;
            currentController = new AbortController();
            const timeoutId2 = setTimeout(() => {
              currentController.abort();
            }, 5000);
            
            try {
              response = await axios.get(healthUrl, {
                timeout: 5000,
                signal: currentController.signal,
                validateStatus: (status) => status < 500
              });
            } catch (err2) {
              clearTimeout(timeoutId2);
              if (currentController.signal.aborted || err2.name === 'AbortError' || err2.code === 'ECONNABORTED') {
                throw new Error('Request timeout');
              }
              throw err2;
            } finally {
              clearTimeout(timeoutId2);
            }
          } else {
            throw err;
          }
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!isMounted) return;
        
        // Check if we got a valid response
        if (response && response.data && response.data.status === 'healthy') {
          setIsChecking(false);
          // Small delay to show success state
          setTimeout(() => {
            if (onServerReady) {
              onServerReady();
            }
          }, 800);
        }
      } catch (error) {
        // Server is still sleeping/unavailable, keep checking
        // This is expected behavior, so we don't log errors
      } finally {
        currentController = null;
      }
    };

    // Check immediately, then every 3 seconds
    checkServerHealth();
    checkInterval = setInterval(checkServerHealth, 3000);

    return () => {
      isMounted = false;
      if (currentController) {
        currentController.abort();
      }
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isVisible, onServerReady]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      >
        <div className="text-center px-6">
          {/* Animated Icon */}
          <motion.div
            className="mb-8 flex justify-center"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {isChecking ? (
              <div className="relative">
                <Shield className="w-16 h-16 text-blue-400" />
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-8 h-8 text-blue-300" />
                </motion.div>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle2 className="w-16 h-16 text-green-400" />
              </motion.div>
            )}
          </motion.div>

          {/* Rotating Messages */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="mb-4"
            >
              <h2 className="text-2xl font-semibold text-white mb-2">
                {isChecking ? LOADING_MESSAGES[currentMessageIndex] : "Connection established"}
              </h2>
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Lock className="w-4 h-4" />
                <span className="text-sm">Secure connection enabled</span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress Indicator */}
          {isChecking && (
            <div className="mt-8 max-w-xs mx-auto">
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ServerWakeUpLoader;
