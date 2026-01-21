import React, { useState, useEffect, useCallback, useRef } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { X } from 'lucide-react';

/**
 * Onboarding Tour Component
 * 
 * A comprehensive, RTL/LTR-aware onboarding tour that guides users through
 * their first workspace, category, and walkthrough creation.
 * 
 * Features:
 * - Route-aware: pauses and resumes based on user's location
 * - RTL/LTR safe: adjusts tooltip placement based on language direction
 * - Element waiting: retries until target elements are mounted
 * - Backend persistence: marks onboarding as complete on server
 * - Language switching: updates instantly when language changes
 * - Skip anytime: users can skip or turn off onboarding
 */
const OnboardingTour = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourStarted, setTourStarted] = useState(false);
  const waitingForElementRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  
  // Determine text direction
  const isRTL = i18n.language === 'he';
  const placement = isRTL ? 'left' : 'right';
  const placementTop = isRTL ? 'right' : 'left';

  // Check if user should see onboarding
  useEffect(() => {
    if (user && user.email_verified && !user.onboarding_completed) {
      // Only show on dashboard after email verification
      if (location.pathname === '/dashboard') {
        setTourStarted(true);
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          setRun(true);
        }, 1000);
      }
    }
  }, [user, location.pathname]);

  // Wait for element to exist in DOM
  const waitForElement = useCallback((selector, maxRetries = 30, retryDelay = 500) => {
    return new Promise((resolve, reject) => {
      let retries = 0;
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          waitingForElementRef.current = false;
          resolve(element);
        } else if (retries < maxRetries) {
          retries++;
          waitingForElementRef.current = true;
          retryTimeoutRef.current = setTimeout(checkElement, retryDelay);
        } else {
          waitingForElementRef.current = false;
          reject(new Error(`Element ${selector} not found after ${maxRetries} retries`));
        }
      };
      
      checkElement();
    });
  }, []);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    try {
      await api.completeOnboarding();
      if (refreshUser) {
        await refreshUser();
      }
      toast.success(t('onboarding.steps.complete.title'));
    } catch (error) {
      console.error('Failed to mark onboarding as complete:', error);
      // Don't show error to user - onboarding UX should be seamless
    }
  }, [refreshUser, t]);

  // Handle skip/close
  const handleSkip = useCallback(async () => {
    setRun(false);
    setTourStarted(false);
    await completeOnboarding();
  }, [completeOnboarding]);

  // Define tour steps
  const steps = [
    {
      target: '[data-testid="create-workspace-button"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.createWorkspace.title')}</h3>
          <p>{t('onboarding.steps.createWorkspace.description')}</p>
        </div>
      ),
      placement: placementTop,
      disableBeacon: true,
      spotlightClicks: true,
      route: '/dashboard',
    },
    {
      target: '[data-testid="workspace-name-input"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.workspaceForm.title')}</h3>
          <p>{t('onboarding.steps.workspaceForm.description')}</p>
        </div>
      ),
      placement: placement,
      disableBeacon: true,
      spotlightClicks: true,
      route: '/dashboard',
      waitForDialog: true,
    },
    {
      target: '[data-testid^="workspace-card-"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.enterWorkspace.title')}</h3>
          <p>{t('onboarding.steps.enterWorkspace.description')}</p>
        </div>
      ),
      placement: placement,
      disableBeacon: true,
      spotlightClicks: true,
      route: '/dashboard',
    },
    {
      target: '[data-testid="nav-workspace-walkthroughs"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.guidesTab.title')}</h3>
          <p>{t('onboarding.steps.guidesTab.description')}</p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
    },
    {
      target: '[data-testid="nav-workspace-categories"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.navigateToCategories.title')}</h3>
          <p>{t('onboarding.steps.navigateToCategories.description')}</p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
    },
    {
      target: '[data-testid="create-category-button"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.createCategory.title')}</h3>
          <p>{t('onboarding.steps.createCategory.description')}</p>
        </div>
      ),
      placement: placementTop,
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/categories$/,
    },
    {
      target: '[data-testid="category-name-input"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.categoryForm.title')}</h3>
          <p>{t('onboarding.steps.categoryForm.description')}</p>
        </div>
      ),
      placement: placement,
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/categories$/,
      waitForDialog: true,
    },
    {
      target: '[data-testid="nav-workspace-walkthroughs"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.navigateToGuides.title')}</h3>
          <p>{t('onboarding.steps.navigateToGuides.description')}</p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/categories$/,
    },
    {
      target: '[data-testid="create-walkthrough-button"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.createWalkthrough.title')}</h3>
          <p>{t('onboarding.steps.createWalkthrough.description')}</p>
        </div>
      ),
      placement: placementTop,
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
    },
    {
      target: '[data-testid="walkthrough-name-input"]',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.walkthroughForm.title')}</h3>
          <p>{t('onboarding.steps.walkthroughForm.description')}</p>
        </div>
      ),
      placement: placement,
      disableBeacon: true,
      spotlightClicks: true,
      route: /^\/workspace\/[^/]+\/walkthroughs$/,
      waitForDialog: true,
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">{t('onboarding.steps.complete.title')}</h3>
          <p>{t('onboarding.steps.complete.description')}</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ];

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

  // Wait for step's target element (with route checking)
  useEffect(() => {
    if (!run || !tourStarted) return;
    
    const currentStep = steps[stepIndex];
    if (!currentStep) return;

    // Check if we're on the correct route
    if (!isOnCorrectRoute(currentStep)) {
      // Pause tour until user navigates to correct route
      setRun(false);
      return;
    }

    // Wait for element if step has waitForDialog or if element doesn't exist yet
    if (currentStep.waitForDialog || currentStep.target !== 'body') {
      waitForElement(currentStep.target)
        .then(() => {
          setRun(true);
        })
        .catch((error) => {
          console.warn('Element not found:', error);
          // Keep waiting or show message
        });
    }
  }, [stepIndex, location.pathname, isOnCorrectRoute, waitForElement, run, tourStarted]);

  // Resume tour when user navigates to correct route
  useEffect(() => {
    if (!tourStarted) return;
    
    const currentStep = steps[stepIndex];
    if (!currentStep) return;

    if (isOnCorrectRoute(currentStep) && !run) {
      // Small delay to ensure DOM is ready after navigation
      setTimeout(() => {
        setRun(true);
      }, 500);
    }
  }, [location.pathname, stepIndex, isOnCorrectRoute, run, tourStarted]);

  // Handle tour events
  const handleJoyrideCallback = useCallback(async (data) => {
    const { action, index, status, type } = data;

    if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      if (action === ACTIONS.NEXT && nextStepIndex < steps.length) {
        setStepIndex(nextStepIndex);
      } else if (action === ACTIONS.PREV && nextStepIndex >= 0) {
        setStepIndex(nextStepIndex);
      }
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      setTourStarted(false);
      await completeOnboarding();
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      // Element not found, pause and wait
      setRun(false);
    }
  }, [completeOnboarding, steps.length]);

  // Custom tooltip component
  const TooltipComponent = ({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    skipProps,
  }) => (
    <div
      {...tooltipProps}
      className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 max-w-md border border-slate-200 dark:border-slate-700"
      style={{
        ...tooltipProps.style,
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* Close button */}
      <button
        {...closeProps}
        className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} text-slate-400 hover:text-slate-600 transition-colors`}
        onClick={handleSkip}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="mb-4">
        {step.content}
      </div>

      {/* Language switch tip */}
      <div className="mb-4 text-sm text-slate-500 italic border-t pt-3 border-slate-200 dark:border-slate-700">
        {t('onboarding.languageSwitchTip')}
      </div>

      {/* Progress */}
      <div className="mb-4 text-xs text-slate-500">
        {t('onboarding.step', { current: index + 1, total: steps.length })}
      </div>

      {/* Navigation */}
      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'} justify-between`}>
        <div className="flex gap-2">
          {index > 0 && (
            <Button
              {...backProps}
              variant="outline"
              size="sm"
            >
              {t('onboarding.back')}
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSkip}
            variant="ghost"
            size="sm"
            className="text-slate-500"
          >
            {t('onboarding.skipTour')}
          </Button>

          {continuous && (
            <Button
              {...primaryProps}
              size="sm"
            >
              {index === steps.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (!tourStarted || !user || user.onboarding_completed) {
    return null;
  }

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton={false}
        disableOverlayClose
        disableCloseOnEsc={false}
        spotlightPadding={8}
        callback={handleJoyrideCallback}
        tooltipComponent={TooltipComponent}
        locale={{
          back: t('onboarding.back'),
          close: t('common.close'),
          last: t('onboarding.finish'),
          next: t('onboarding.next'),
          skip: t('onboarding.skip'),
        }}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: 'white',
            overlayColor: 'rgba(0, 0, 0, 0.6)',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          },
          spotlight: {
            borderRadius: '8px',
          },
        }}
      />

      {/* Skip button always visible at bottom */}
      {run && (
        <div className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'} z-[10001]`}>
          <Button
            onClick={handleSkip}
            variant="outline"
            size="sm"
            className="shadow-lg bg-white dark:bg-slate-900"
          >
            {t('onboarding.skipTour')}
          </Button>
        </div>
      )}
    </>
  );
};

export default OnboardingTour;
