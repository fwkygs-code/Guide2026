const STORAGE_KEY = 'interguide:onboarding';

const defaultSession = {
  active: false,
  userId: null,
  stepIndex: 0,
  workspaceId: null,
  workspaceSlug: null,
  categoryId: null,
  walkthroughId: null,
  step8: {
    hasStep: false,
    hasTitle: false,
    hasBlock: false
  }
};

export const getOnboardingSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSession };
    const parsed = JSON.parse(raw);
    return {
      ...defaultSession,
      ...parsed,
      step8: {
        ...defaultSession.step8,
        ...(parsed.step8 || {})
      }
    };
  } catch (error) {
    return { ...defaultSession };
  }
};

export const saveOnboardingSession = (session) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const updateOnboardingSession = (updates) => {
  const current = getOnboardingSession() || { ...defaultSession };
  const next = {
    ...current,
    ...updates,
    step8: {
      ...current.step8,
      ...(updates.step8 || {})
    }
  };
  saveOnboardingSession(next);
  return next;
};

export const clearOnboardingSession = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};
