import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ONBOARDING_STEPS } from './onboardingSteps';
import { useTargetRect } from './OnboardingStepTargetResolver';
import OnboardingOverlay from './OnboardingOverlay';
import { fetchOnboardingStatus, completeOnboarding, dismissOnboarding } from './OnboardingPersistence';
import { clearOnboardingSession, getOnboardingSession, updateOnboardingSession } from './onboardingSession';

const TOTAL_STEPS = ONBOARDING_STEPS.length;

const OnboardingController = () => {
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(() => getOnboardingSession());
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(session?.stepIndex || 0);
  const [domCheckTrigger, setDomCheckTrigger] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex];
  const targetSelector = useMemo(() => {
    if (!step?.target) return null;
    return typeof step.target === 'function' ? step.target(session) : step.target;
  }, [step?.id, step?.target, session?.workspaceId, session?.categoryId, session?.walkthroughId, session?.step8, location.pathname]);

  const { rect, isReady } = useTargetRect(targetSelector, active);

  // Use ref to store latest setStep function to avoid circular dependencies
  const setStepRef = useRef(null);

  const setStep = useCallback((nextIndex, updates = {}) => {
    if (nextIndex < 0 || nextIndex >= ONBOARDING_STEPS.length) {
      if (nextIndex >= ONBOARDING_STEPS.length) {
        markCompleted();
      } else {
        clearOnboardingSession();
        setActive(false);
      }
      return;
    }
    const nextSession = updateOnboardingSession({
      active: true,
      stepIndex: nextIndex,
      userId: user?.id || null,
      ...updates
    });
    setSession(nextSession);
    setStepIndex(nextIndex);
    setActive(true);
  }, [user?.id]);

  // Update ref whenever setStep changes
  useEffect(() => {
    setStepRef.current = setStep;
  }, [setStep]);

  const markDismissed = useCallback(async () => {
    try {
      await dismissOnboarding();
      setStatus({ has_completed_onboarding: false, has_dismissed_onboarding: true });
    } finally {
      clearOnboardingSession();
      setActive(false);
    }
  }, []);

  const markCompleted = useCallback(async () => {
    try {
      await completeOnboarding();
      setStatus({ has_completed_onboarding: true, has_dismissed_onboarding: false });
    } finally {
      clearOnboardingSession();
      setActive(false);
    }
  }, []);

  // Event handlers moved outside useEffect to avoid circular dependencies
  const handleCreateWorkspace = useCallback(() => {
    if (stepIndex === 1 && setStepRef.current) setStepRef.current(2);
  }, [stepIndex]);

  const handleWorkspaceCreated = useCallback((event) => {
    if (stepIndex <= 2 && setStepRef.current) {
      setStepRef.current(3, {
        workspaceId: event.detail?.workspaceId || null,
        workspaceSlug: event.detail?.workspaceSlug || null
      });
    }
  }, [stepIndex]);

  const handleWorkspaceEntered = useCallback(() => {
    if (stepIndex <= 3 && setStepRef.current) setStepRef.current(4);
  }, [stepIndex]);

  const handleNavCategories = useCallback(() => {
    if (stepIndex <= 4 && setStepRef.current) setStepRef.current(5);
  }, [stepIndex]);

  const handleCategoryCreated = useCallback((event) => {
    if (stepIndex <= 5 && setStepRef.current) {
      setStepRef.current(6, {
        categoryId: event.detail?.categoryId || null
      });
    }
  }, [stepIndex]);

  const handleNavGuides = useCallback(() => {
    if (stepIndex <= 6 && setStepRef.current) setStepRef.current(7);
  }, [stepIndex]);

  const handleWalkthroughCreated = useCallback((event) => {
    if (stepIndex <= 7 && setStepRef.current) {
      setStepRef.current(8, {
        walkthroughId: event.detail?.walkthroughId || null,
        step8: { hasStep: false, hasTitle: false, hasBlock: false }
      });
    }
  }, [stepIndex]);

  const handleStepAdded = useCallback(() => {
    if (stepIndex === 8) {
      const nextSession = updateOnboardingSession({ step8: { hasStep: true } });
      setSession(nextSession);
    }
  }, [stepIndex]);

  const handleStepTitleUpdated = useCallback((event) => {
    if (stepIndex === 8 && event.detail?.title?.trim()) {
      const nextSession = updateOnboardingSession({ step8: { hasTitle: true } });
      setSession(nextSession);
    }
  }, [stepIndex]);

  const handleBlockAdded = useCallback(() => {
    if (stepIndex === 8) {
      const nextSession = updateOnboardingSession({ step8: { hasBlock: true } });
      setSession(nextSession);
    }
  }, [stepIndex]);

  const handleDialogClosed = useCallback(() => {
    if (stepIndex === 2 && setStepRef.current) {
      setStepRef.current(1);
    } else if (stepIndex === 5 && setStepRef.current) {
      setStepRef.current(4);
    } else if (stepIndex === 7 && setStepRef.current) {
      setStepRef.current(6);
    } else if (stepIndex === 8 && setStepRef.current) {
      // If user exits walkthrough creation in step 8, go back to step 7
      setStepRef.current(7);
    }
    
    // Trigger DOM check after a short delay to ensure DOM is updated
    setTimeout(() => {
      setDomCheckTrigger(prev => prev + 1);
    }, 100);
  }, [stepIndex]);

  useEffect(() => {
    if (!user?.id || loading) {
      setActive(false);
      setStatus(null);
      return;
    }
    let ignore = false;
    const loadStatus = async () => {
      try {
        const nextStatus = await fetchOnboardingStatus();
        if (!ignore) {
          setStatus(nextStatus);
        }
      } catch {
        if (!ignore) {
          setStatus(null);
        }
      }
    };
    loadStatus();
    return () => {
      ignore = true;
    };
  }, [user?.id, loading]);

  useEffect(() => {
    if (!user?.id || loading) {
      setActive(false);
      return;
    }
    if (!status) return;
    if (status.has_completed_onboarding || status.has_dismissed_onboarding) {
      clearOnboardingSession();
      setActive(false);
      return;
    }

    let stored = getOnboardingSession();
    if (stored?.userId && stored.userId !== user.id) {
      clearOnboardingSession();
      stored = null;
    }
    if (stored?.active && stored.userId === user.id) {
      setActive(true);
      setStepIndex(stored.stepIndex || 0);
      setSession(stored);
      return;
    }

    if (location.pathname === '/dashboard') {
      const nextSession = updateOnboardingSession({ active: true, stepIndex: 0, userId: user.id });
      setSession(nextSession);
      setStepIndex(0);
      setActive(true);
    }
  }, [status, user?.id, loading, location.pathname]);

  useEffect(() => {
    if (!active) return;

    window.addEventListener('onboarding:createWorkspace', handleCreateWorkspace);
    window.addEventListener('onboarding:workspaceCreated', handleWorkspaceCreated);
    window.addEventListener('onboarding:workspaceEntered', handleWorkspaceEntered);
    window.addEventListener('onboarding:navCategories', handleNavCategories);
    window.addEventListener('onboarding:categoryCreated', handleCategoryCreated);
    window.addEventListener('onboarding:navGuides', handleNavGuides);
    window.addEventListener('onboarding:walkthroughCreated', handleWalkthroughCreated);
    window.addEventListener('onboarding:stepAdded', handleStepAdded);
    window.addEventListener('onboarding:stepTitleUpdated', handleStepTitleUpdated);
    window.addEventListener('onboarding:blockAdded', handleBlockAdded);
    window.addEventListener('onboarding:dialogClosed', handleDialogClosed);

    return () => {
      window.removeEventListener('onboarding:createWorkspace', handleCreateWorkspace);
      window.removeEventListener('onboarding:workspaceCreated', handleWorkspaceCreated);
      window.removeEventListener('onboarding:workspaceEntered', handleWorkspaceEntered);
      window.removeEventListener('onboarding:navCategories', handleNavCategories);
      window.removeEventListener('onboarding:categoryCreated', handleCategoryCreated);
      window.removeEventListener('onboarding:navGuides', handleNavGuides);
      window.removeEventListener('onboarding:walkthroughCreated', handleWalkthroughCreated);
      window.removeEventListener('onboarding:stepAdded', handleStepAdded);
      window.removeEventListener('onboarding:stepTitleUpdated', handleStepTitleUpdated);
      window.removeEventListener('onboarding:blockAdded', handleBlockAdded);
      window.removeEventListener('onboarding:dialogClosed', handleDialogClosed);
    };
  }, [active, handleCreateWorkspace, handleWorkspaceCreated, handleWorkspaceEntered, handleNavCategories, handleCategoryCreated, handleNavGuides, handleWalkthroughCreated, handleStepAdded, handleStepTitleUpdated, handleBlockAdded, handleDialogClosed]);

  useEffect(() => {
    if (!active) return;
    if (!step) return;
    
    // Don't run DOM checking logic for step 9 - it has special handling
    // But keep step 8 to handle walkthrough creation state
    if (stepIndex >= 9) return;

    if (stepIndex === 1) {
      if (document.querySelector('[data-onboarding="workspace-create-form"]')) {
        setStepRef.current?.(2);
      }
      // Don't automatically move to step 3 - wait for workspace creation event
      return;
    }

    // Handle case where user closes workspace creation dialog - go back to step 1
    if (stepIndex === 2 && !document.querySelector('[data-onboarding="workspace-create-form"]')) {
      setStepRef.current?.(1);
      return;
    }

    if (stepIndex === 3) {
      // Check if we're in a workspace
      if (location.pathname.includes('/workspace/')) {
        setStepRef.current?.(4);
        return;
      }
      // If no workspace cards exist and we're not in creation dialog, go back to step 1
      if (!document.querySelector('[data-onboarding="workspace-card"]') && !document.querySelector('[data-onboarding="workspace-create-form"]')) {
        setStepRef.current?.(1);
        return;
      }
    }

    if (stepIndex === 4 && location.pathname.includes('/categories')) {
      setStepRef.current?.(5);
      return;
    }

    if (stepIndex === 5) {
      const categoryEl = document.querySelector('[data-onboarding="category-card"]');
      if (categoryEl) {
        setStepRef.current?.(6, { categoryId: categoryEl.getAttribute('data-onboarding-category-id') });
      }
      return;
    }

    if (stepIndex === 6 && location.pathname.includes('/walkthroughs')) {
      setStepRef.current?.(7);
      return;
    }

    if (stepIndex === 7) {
      const walkthroughEl = document.querySelector('[data-onboarding="walkthrough-card"]');
      if (walkthroughEl) {
        setStepRef.current?.(8, { walkthroughId: walkthroughEl.getAttribute('data-onboarding-walkthrough-id') });
      } else if (location.pathname === '/dashboard') {
        // If user is on dashboard, they should create a walkthrough, so stay in step 7
        // Don't change step, let them navigate to walkthroughs
        return;
      } else if (!document.querySelector('[data-onboarding="walkthrough-setup-form"]') && !document.querySelector('[data-onboarding="create-walkthrough-button"]')) {
        // If walkthrough creation form is not visible and no walkthrough cards exist, go back to step 6
        setStepRef.current?.(6);
      }
      return;
    }

    if (stepIndex === 8) {
      // Check if walkthrough creation form is still visible
      if (!document.querySelector('[data-onboarding="walkthrough-setup-form"]') && !document.querySelector('[data-onboarding="create-walkthrough-button"]')) {
        // If walkthrough creation form is not visible and no create button, go back to step 7
        setStepRef.current?.(7);
        return;
      }
      // Stay in step 8 if walkthrough creation elements are present
      return;
    }
  }, [active, step, stepIndex, location.pathname, domCheckTrigger]);

  useEffect(() => {
    if (!active) return;
    if (!step || stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) {
      clearOnboardingSession();
      setActive(false);
    }
  }, [active, step, stepIndex]);

  useEffect(() => {
    if (!active || stepIndex !== 8) return;
    const stepState = session?.step8 || {};
    if (stepState.hasStep && stepState.hasTitle && stepState.hasBlock) {
      setStepRef.current?.(9); // Move to completion step
    }
  }, [active, stepIndex, session]);

  if (!active || !step) return null;

  return (
    <OnboardingOverlay
      rect={rect}
      step={step}
      stepIndex={stepIndex}
      totalSteps={TOTAL_STEPS}
      isRTL={i18n.language === 'he'}
      isWaiting={!!step.target && !isReady}
      onDismiss={markDismissed}
      onPrimaryAction={() => setStepRef.current?.(stepIndex + 1)}
    />
  );
};

export default OnboardingController;
