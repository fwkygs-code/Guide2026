export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    titleKey: 'onboardingTour.welcome.title',
    bodyKey: 'onboardingTour.welcome.body',
    actionKey: 'onboardingTour.welcome.start',
    target: null
  },
  {
    id: 'createWorkspace',
    titleKey: 'onboardingTour.steps.createWorkspace.title',
    bodyKey: 'onboardingTour.steps.createWorkspace.body',
    target: '[data-onboarding="create-workspace-button"]'
  },
  {
    id: 'workspaceForm',
    titleKey: 'onboardingTour.steps.workspaceForm.title',
    bodyKey: 'onboardingTour.steps.workspaceForm.body',
    target: '[data-onboarding="workspace-create-form"]'
  },
  {
    id: 'enterWorkspace',
    titleKey: 'onboardingTour.steps.enterWorkspace.title',
    bodyKey: 'onboardingTour.steps.enterWorkspace.body',
    target: (session) =>
      session?.workspaceId
        ? `[data-onboarding="workspace-card"][data-onboarding-workspace-id="${session.workspaceId}"]`
        : '[data-onboarding="workspace-card"]'
  },
  {
    id: 'goCategories',
    titleKey: 'onboardingTour.steps.goCategories.title',
    bodyKey: 'onboardingTour.steps.goCategories.body',
    target: '[data-onboarding="tab-categories"]'
  },
  {
    id: 'createCategory',
    titleKey: 'onboardingTour.steps.createCategory.title',
    bodyKey: 'onboardingTour.steps.createCategory.body',
    target: [
      '[data-onboarding="category-create-form"]',
      '[data-onboarding="create-category-button"]'
    ]
  },
  {
    id: 'goGuides',
    titleKey: 'onboardingTour.steps.goGuides.title',
    bodyKey: 'onboardingTour.steps.goGuides.body',
    target: '[data-onboarding="tab-guides"]'
  },
  {
    id: 'createWalkthrough',
    titleKey: 'onboardingTour.steps.createWalkthrough.title',
    bodyKey: 'onboardingTour.steps.createWalkthrough.body',
    target: [
      '[data-onboarding="walkthrough-setup-form"]',
      '[data-onboarding="create-walkthrough-button"]'
    ]
  },
  {
    id: 'addFirstStep',
    titleKey: 'onboardingTour.steps.addFirstStep.title',
    bodyKey: 'onboardingTour.steps.addFirstStep.body',
    target: (session) => {
      if (session?.step8?.hasStep && !session?.step8?.hasTitle) {
        return '[data-onboarding="step-title-editor"]';
      }
      if (session?.step8?.hasStep && session?.step8?.hasTitle && !session?.step8?.hasBlock) {
        return '[data-onboarding="add-block-button"]';
      }
      return '[data-onboarding="add-step-button"]';
    }
  }
];
