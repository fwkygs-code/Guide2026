import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  const step = ONBOARDING_STEPS[stepIndex];
  const targetSelector = useMemo(() => {
    if (!step?.target) return null;
    return typeof step.target === 'function' ? step.target(session) : step.target;
  }, [step?.id, step?.target, session?.workspaceId, session?.categoryId, session?.walkthroughId, session?.step8, location.pathname]);

  const { rect, isReady } = useTargetRect(targetSelector, active);

  const setStep = useCallback((nextIndex, updates = {}) => {
    if (nextIndex < 0 || nextIndex >= ONBOARDING_STEPS.length) {
      clearOnboardingSession();
      setActive(false);
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
  }, []);

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
    if (!user?.id || loading || !user?.email_verified) {
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
  }, [status, user?.id, user?.email_verified, loading, location.pathname]);

  useEffect(() => {
    if (!active) return;

    const handleCreateWorkspace = () => {
      if (stepIndex === 1) setStep(2);
    };
    const handleWorkspaceCreated = (event) => {
      if (stepIndex <= 2) {
        setStep(3, {
          workspaceId: event.detail?.workspaceId || null,
          workspaceSlug: event.detail?.workspaceSlug || null
        });
      }
    };
    const handleWorkspaceEntered = () => {
      if (stepIndex <= 3) setStep(4);
    };
    const handleNavCategories = () => {
      if (stepIndex <= 4) setStep(5);
    };
    const handleCategoryCreated = (event) => {
      if (stepIndex <= 5) {
        setStep(6, {
          categoryId: event.detail?.categoryId || null
        });
      }
    };
    const handleNavGuides = () => {
      if (stepIndex <= 6) setStep(7);
    };
    const handleWalkthroughCreated = (event) => {
      if (stepIndex <= 7) {
        setStep(8, {
          walkthroughId: event.detail?.walkthroughId || null,
          step8: { hasStep: false, hasTitle: false, hasBlock: false }
        });
      }
    };
    const handleStepAdded = () => {
      if (stepIndex === 8) {
        const nextSession = updateOnboardingSession({ step8: { hasStep: true } });
        setSession(nextSession);
      }
    };
    const handleStepTitleUpdated = (event) => {
      if (stepIndex === 8 && event.detail?.title?.trim()) {
        const nextSession = updateOnboardingSession({ step8: { hasTitle: true } });
        setSession(nextSession);
      }
    };
    const handleBlockAdded = () => {
      if (stepIndex === 8) {
        const nextSession = updateOnboardingSession({ step8: { hasBlock: true } });
        setSession(nextSession);
      }
    };

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
    };
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    if (!step) return;

    if (stepIndex === 1) {
      if (document.querySelector('[data-onboarding="workspace-create-form"]')) {
        setStep(2);
      } else if (document.querySelector('[data-onboarding="workspace-card"]')) {
        setStep(3);
      }
      return;
    }

    if (stepIndex === 2 && document.querySelector('[data-onboarding="workspace-card"]')) {
      setStep(3);
      return;
    }

    if (stepIndex === 3 && location.pathname.includes('/workspace/')) {
      setStep(4);
      return;
    }

    if (stepIndex === 4 && location.pathname.includes('/categories')) {
      setStep(5);
      return;
    }

    if (stepIndex === 5) {
      const categoryEl = document.querySelector('[data-onboarding="category-card"]');
      if (categoryEl) {
        setStep(6, { categoryId: categoryEl.getAttribute('data-onboarding-category-id') });
      }
      return;
    }

    if (stepIndex === 6 && location.pathname.includes('/walkthroughs')) {
      setStep(7);
      return;
    }

    if (stepIndex === 7) {
      const walkthroughEl = document.querySelector('[data-onboarding="walkthrough-card"]');
      if (walkthroughEl) {
        setStep(8, { walkthroughId: walkthroughEl.getAttribute('data-onboarding-walkthrough-id') });
      }
    }
  }, [active, step, stepIndex, location.pathname]);

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
      markCompleted();
    }
  }, [active, stepIndex, session, markCompleted]);

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
      onPrimaryAction={() => setStep(stepIndex + 1)}
    />
  );
};

export default OnboardingController;
