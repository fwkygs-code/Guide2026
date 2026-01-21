import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { X, Sparkles } from 'lucide-react';

/**
 * Interactive Onboarding Tour Component
 * 
 * A hands-on, step-by-step onboarding that waits for user actions.
 * User must perform each action to proceed - no passive Next buttons.
 */
const OnboardingTour = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [tourActive, setTourActive] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const observerRef = useRef(null);
  const previousHighlightRef = useRef(null);
  
  // Determine text direction
  const isRTL = i18n.language === 'he';

  // Define tour steps with actions to wait for - using function to get fresh translations
  const getSteps = useCallback(() => [
    {
      id: 'welcome',
      route: '/dashboard',
      target: '[data-testid="create-workspace-button"]',
      title: t('onboarding.steps.createWorkspace.title'),
      description: t('onboarding.steps.createWorkspace.description'),
      action: 'wait_for_dialog', // Wait for create workspace dialog
      actionTarget: '[data-testid="create-workspace-button"]',
    },
    {
      id: 'workspace_form',
      route: '/dashboard',
      target: '[data-testid="workspace-name-input"]',
      title: t('onboarding.steps.workspaceForm.title'),
      description: t('onboarding.steps.workspaceForm.description'),
      action: 'wait_for_submit', // Wait for form submission
      actionTarget: '[data-testid="create-workspace-submit"]',
    },
    {
      id: 'enter_workspace',
      route: '/dashboard',
      target: '[data-testid^="workspace-card-"]',
      title: t('onboarding.steps.enterWorkspace.title'),
      description: t('onboarding.steps.enterWorkspace.description'),
      action: 'wait_for_navigation', // Wait for navigation away from dashboard
      nextRoute: /^\/workspace\/[^/]+\/walkthroughs$/,
    },
    {
      id: 'guides_tab',
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
      target: '[data-testid="nav-workspace-walkthroughs"]',
      title: t('onboarding.steps.guidesTab.title'),
      description: t('onboarding.steps.guidesTab.description'),
      action: 'auto_advance', // Just informational, auto-advance after delay
      delay: 3000,
    },
    {
      id: 'navigate_categories',
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
      target: '[data-testid="nav-workspace-categories"]',
      title: t('onboarding.steps.navigateToCategories.title'),
      description: t('onboarding.steps.navigateToCategories.description'),
      action: 'wait_for_navigation',
      nextRoute: /^\/workspace\/[^/]+\/categories$/,
    },
    {
      id: 'create_category',
      route: /^\/workspace\/[^/]+\/categories$/,
      target: '[data-testid="create-category-button"]',
      title: t('onboarding.steps.createCategory.title'),
      description: t('onboarding.steps.createCategory.description'),
      action: 'wait_for_dialog',
      actionTarget: '[data-testid="create-category-button"]',
    },
    {
      id: 'category_form',
      route: /^\/workspace\/[^/]+\/categories$/,
      target: '[data-testid="category-name-input"]',
      title: t('onboarding.steps.categoryForm.title'),
      description: t('onboarding.steps.categoryForm.description'),
      action: 'wait_for_submit',
      actionTarget: '[data-testid="create-category-submit"]',
    },
    {
      id: 'navigate_guides',
      route: /^\/workspace\/[^/]+\/categories$/,
      target: '[data-testid="nav-workspace-walkthroughs"]',
      title: t('onboarding.steps.navigateToGuides.title'),
      description: t('onboarding.steps.navigateToGuides.description'),
      action: 'wait_for_navigation',
      nextRoute: /^\/workspace\/[^/]+\/walkthroughs$/,
    },
    {
      id: 'create_walkthrough',
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
      target: '[data-testid="create-walkthrough-button"]',
      title: t('onboarding.steps.createWalkthrough.title'),
      description: t('onboarding.steps.createWalkthrough.description'),
      action: 'wait_for_navigation',
      nextRoute: /^\/workspace\/[^/]+\/walkthroughs\/new$/,
    },
    {
      id: 'walkthrough_form',
      route: /^\/workspace\/[^/]+\/walkthroughs\/new$/,
      target: '[data-testid="walkthrough-name-input"]',
      title: t('onboarding.steps.walkthroughForm.title'),
      description: t('onboarding.steps.walkthroughForm.description'),
      action: 'wait_for_navigation',
      nextRoute: /^\/workspace\/[^/]+\/walkthroughs\/[^/]+\/edit$/,
    },
    {
      id: 'complete',
      route: null,
      target: null,
      title: t('onboarding.steps.complete.title'),
      description: t('onboarding.steps.complete.description'),
      action: 'complete',
    },
  ], [t]);

  const steps = getSteps();
  const currentStepData = steps[currentStep];

  // Check if user should see onboarding
  useEffect(() => {
    if (user && user.email_verified && !user.onboarding_completed) {
      if (location.pathname === '/dashboard') {
        setTourActive(true);
      }
    }
  }, [user, location.pathname]);

  // Check if current route matches step's required route
  const isOnCorrectRoute = useCallback((step) => {
    if (!step.route) return true;
    
    if (typeof step.route === 'string') {
      return location.pathname === step.route;
    } else if (step.route instanceof RegExp) {
      return step.route.test(location.pathname);
    }
    
    return true;
  }, [location.pathname]);

  // Highlight target element and update spotlight
  useEffect(() => {
    if (!tourActive || !currentStepData) return;

    // Restore previous element's styles
    if (previousHighlightRef.current) {
      const prev = previousHighlightRef.current;
      prev.element.style.position = prev.originalPosition;
      prev.element.style.zIndex = prev.originalZIndex;
      prev.element.style.pointerEvents = prev.originalPointerEvents;
      previousHighlightRef.current = null;
    }

    setHighlightedElement(null);
    setSpotlightRect(null);

    // Wait for target element
    if (currentStepData.target) {
      const checkElement = () => {
        const element = document.querySelector(currentStepData.target);
        if (element) {
          // Store original styles
          const originalPosition = element.style.position;
          const originalZIndex = element.style.zIndex;
          const originalPointerEvents = element.style.pointerEvents;
          
          previousHighlightRef.current = {
            element,
            originalPosition,
            originalZIndex,
            originalPointerEvents
          };

          // Highlight it - place ABOVE all tour elements
          element.style.position = 'relative';
          element.style.zIndex = '10010';
          element.style.pointerEvents = 'auto';
          
          setHighlightedElement(element);
          
          // Update spotlight position
          const updateSpotlight = () => {
            if (element && document.body.contains(element)) {
              const rect = element.getBoundingClientRect();
              setSpotlightRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              });
            }
          };
          
          updateSpotlight();
          
          // Update on scroll/resize
          const handleUpdate = () => updateSpotlight();
          window.addEventListener('scroll', handleUpdate, true);
          window.addEventListener('resize', handleUpdate);
          
          return () => {
            window.removeEventListener('scroll', handleUpdate, true);
            window.removeEventListener('resize', handleUpdate);
          };
        } else {
          setTimeout(checkElement, 500);
        }
      };
      checkElement();
    }

    return () => {
      if (previousHighlightRef.current) {
        const prev = previousHighlightRef.current;
        prev.element.style.position = prev.originalPosition;
        prev.element.style.zIndex = prev.originalZIndex;
        prev.element.style.pointerEvents = prev.originalPointerEvents;
      }
    };
  }, [tourActive, currentStep, currentStepData]);

  // Handle action completion
  useEffect(() => {
    if (!tourActive || !currentStepData) return;
    if (!isOnCorrectRoute(currentStepData)) return;

    const { action, actionTarget, nextRoute, delay } = currentStepData;

    // Auto-advance after delay
    if (action === 'auto_advance' && delay) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }

    // Wait for navigation
    if (action === 'wait_for_navigation' && nextRoute) {
      if (nextRoute instanceof RegExp) {
        if (nextRoute.test(location.pathname)) {
          // Route changed, advance
          setTimeout(() => {
            setCurrentStep(prev => prev + 1);
          }, 500);
        }
      } else if (location.pathname === nextRoute) {
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 500);
      }
    }

    // Wait for dialog to open
    if (action === 'wait_for_dialog' && actionTarget) {
      const observer = new MutationObserver(() => {
        // Check if dialog opened (form input is visible)
        const formElement = document.querySelector(currentStepData.target);
        if (formElement && formElement.offsetParent !== null) {
          setCurrentStep(prev => prev + 1);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      observerRef.current = observer;
      return () => observer.disconnect();
    }

    // Wait for form submit (watch for element disappearance or route change)
    if (action === 'wait_for_submit') {
      const checkSubmit = () => {
        const element = document.querySelector(currentStepData.target);
        // If form disappeared or route changed, consider it submitted
        if (!element || element.offsetParent === null || !isOnCorrectRoute(currentStepData)) {
          setCurrentStep(prev => prev + 1);
        } else {
          setTimeout(checkSubmit, 500);
        }
      };
      const timer = setTimeout(checkSubmit, 1000);
      return () => clearTimeout(timer);
    }

    // Complete tour
    if (action === 'complete') {
      completeOnboarding();
    }
  }, [tourActive, currentStep, location.pathname, isOnCorrectRoute, currentStepData]);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    try {
      await api.completeOnboarding();
      if (refreshUser) {
        await refreshUser();
      }
      setTourActive(false);
      toast.success(t('onboarding.steps.complete.title'));
    } catch (error) {
      console.error('Failed to mark onboarding as complete:', error);
    }
  }, [refreshUser, t]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    setTourActive(false);
    await completeOnboarding();
  }, [completeOnboarding]);

  if (!tourActive || !user || user.onboarding_completed || !currentStepData) {
    return null;
  }

  // Don't show if not on correct route
  if (!isOnCorrectRoute(currentStepData)) {
    return null;
  }

  return (
    <>
      {/* Pulse animation styles */}
      <style>{`
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7);
          }
          50% {
            box-shadow: 0 0 0 15px rgba(79, 70, 229, 0);
          }
        }
        
        .tour-spotlight-ring {
          animation: tour-pulse 2s infinite;
        }
      `}</style>

      {/* Dark overlay with SVG mask for spotlight */}
      <div 
        className="fixed inset-0 z-[10000]" 
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          // Block all clicks on overlay
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {spotlightRect ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <mask id="spotlight-mask">
                {/* White rectangle covering everything */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Black hole for the spotlight (cutout) */}
                <rect
                  x={spotlightRect.left - 8}
                  y={spotlightRect.top - 8}
                  width={spotlightRect.width + 16}
                  height={spotlightRect.height + 16}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            {/* Dark overlay with mask */}
            <rect 
              x="0" 
              y="0" 
              width="100%" 
              height="100%" 
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        ) : (
          // No spotlight, just dark overlay
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Spotlight border and glow */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none z-[10001] tour-spotlight-ring"
          style={{
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            border: '3px solid rgba(79, 70, 229, 0.9)',
            borderRadius: '12px',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Floating instruction card */}
      <div
        className={`fixed ${isRTL ? 'left-4' : 'right-4'} top-20 z-[10005] max-w-md pointer-events-auto`}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border-2 border-primary p-6 relative animate-in slide-in-from-top duration-500">
          {/* Close button */}
          <button
            onClick={handleSkip}
            className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} text-slate-400 hover:text-slate-600 transition-colors z-10`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {t('onboarding.step', { current: currentStep + 1, total: steps.length })}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {currentStepData.title}
          </h3>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            {currentStepData.description}
          </p>

          {/* Action prompt */}
          {currentStepData.action !== 'auto_advance' && currentStepData.action !== 'complete' && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <span>👉</span>
                <span>
                  {currentStepData.action === 'wait_for_navigation' && t('onboarding.clickToNavigate')}
                  {currentStepData.action === 'wait_for_dialog' && t('onboarding.clickToOpen')}
                  {currentStepData.action === 'wait_for_submit' && t('onboarding.fillAndSubmit')}
                </span>
              </p>
            </div>
          )}

          {/* Language switch reminder */}
          <div className="text-xs text-slate-500 italic border-t pt-3 border-slate-200 dark:border-slate-700 mb-4">
            🌐 {t('onboarding.languageAvailable')}
          </div>

          {/* Skip button */}
          <Button
            onClick={handleSkip}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {t('onboarding.skipTour')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;
