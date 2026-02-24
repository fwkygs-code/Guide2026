export interface WalkthroughDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: StepDefinition[];
  configuration: WalkthroughConfiguration;
}

export interface StepDefinition {
  id: string;
  index: number;
  title: string;
  description: string;
  targeting: TargetingStrategy;
  validation: ValidationRules;
  behavior: StepBehavior;
  ui: UIConfiguration;
  errorHandling: ErrorHandling;
}

export interface TargetingStrategy {
  selector: string;
  fallbackSelectors?: string[];
  constraints: {
    mustBeVisible: boolean;
    mustBeInteractable: boolean;
    mustBeInViewport: boolean;
    allowHiddenParents: boolean;
  };
  search: {
    timeout: number;
    retryInterval: number;
    maxRetries: number;
    searchScope: 'document' | 'shadow-dom' | 'iframe';
  };
  dynamic: {
    waitForElement: boolean;
    observeMutations: boolean;
    stabilityThreshold: number;
  };
}

export interface ValidationRules {
  completion: {
    type: 'click' | 'hover' | 'input' | 'custom' | 'automatic';
    targetSelector?: string;
    customValidator?: string;
    requireInteraction: boolean;
    interactionTimeout: number;
  };
  preconditions: {
    urlPattern?: string;
    elementExists?: string;
    customCondition?: string;
  };
  postconditions: {
    elementChanged?: string;
    urlChanged?: boolean;
    customCondition?: string;
  };
  state: {
    validateBeforeStep: boolean;
    validateAfterStep: boolean;
    strictValidation: boolean;
  };
}

export interface StepBehavior {
  blocking: {
    blockNavigation: boolean;
    blockScrolling: boolean;
    blockClicks: boolean;
    allowEscKey: boolean;
  };
  autoAdvance: {
    enabled: boolean;
    delay: number;
    requireValidation: boolean;
  };
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential';
    retryDelay: number;
  };
  skip: {
    allowSkip: boolean;
    skipKey: string;
    requireConfirmation: boolean;
  };
}

export interface UIConfiguration {
  positioning: {
    placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
    offset: { x: number; y: number };
    autoPosition: boolean;
  };
  spotlight: {
    padding: number;
    borderRadius: number;
    animation: 'fade' | 'scale' | 'slide';
    glowEffect: boolean;
  };
  content: {
    showTitle: boolean;
    showDescription: boolean;
    showProgress: boolean;
    showNavigation: boolean;
  };
  navigation: {
    showPrevious: boolean;
    showNext: boolean;
    showSkip: boolean;
    showFinish: boolean;
  };
}

export interface ErrorHandling {
  recovery: {
    strategy: 'retry' | 'skip' | 'abort' | 'fallback';
    fallbackStep?: string;
    maxRecoveryAttempts: number;
  };
  display: {
    showErrorToUser: boolean;
    errorMessage?: string;
    showRetryButton: boolean;
    showSkipButton: boolean;
  };
  logging: {
    logErrors: boolean;
    logLevel: 'error' | 'warn' | 'info';
    includeContext: boolean;
  };
}

export interface WalkthroughConfiguration {
  autoStart: boolean;
  showProgress: boolean;
  allowSkip: boolean;
  allowRestart: boolean;
  debugMode: boolean;
  errorHandling: {
    showErrors: boolean;
    allowRetry: boolean;
    maxRetries: number;
  };
  performance: {
    enablePerformanceMonitoring: boolean;
    maxMemoryUsage: number;
    animationFrameRate: number;
  };
}

export interface WalkthroughState {
  id: string;
  sessionId: string;
  walkthroughId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  stepHistory: StepHistoryEntry[];
  status: 'idle' | 'active' | 'paused' | 'completed' | 'aborted' | 'error';
  startTime: number;
  lastActivity: number;
  configuration: WalkthroughConfiguration;
}

export interface StepHistoryEntry {
  stepIndex: number;
  startTime: number;
  endTime?: number;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  userActions: UserAction[];
  errors: WalkthroughError[];
}

export interface UserAction {
  type: 'click' | 'hover' | 'input' | 'keypress' | 'scroll' | 'custom';
  target: Element;
  data: unknown;
  timestamp: number;
}

export interface WalkthroughError {
  id: string;
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  context?: ErrorContext;
  stack?: string;
  recoverable: boolean;
  timestamp: number;
  sessionId?: string;
  stepIndex?: number;
}

export interface ErrorContext {
  url: string;
  userAgent: string;
  walkthroughId?: string;
  stepId?: string;
  selector?: string;
  element?: Element;
  additionalData?: Record<string, unknown>;
}

export interface ElementValidationResult {
  found: boolean;
  visible: boolean;
  interactable: boolean;
  inViewport: boolean;
  stable: boolean;
  errors: ValidationError[];
  element?: Element;
  bounds?: DOMRect;
}

export interface ValidationError {
  type: 'not_found' | 'not_visible' | 'not_interactable' | 'not_in_viewport' | 'unstable';
  message: string;
  selector: string;
  element?: Element;
}

export interface CompletionValidationResult {
  completed: boolean;
  valid: boolean;
  userAction: UserAction;
  timestamp: number;
  errors: ValidationError[];
}

export interface NavigationChange {
  type: 'spa' | 'page' | 'hash';
  oldURL: string;
  newURL: string;
  trigger: string;
  timestamp: number;
}

export interface LocationValidationResult {
  valid: boolean;
  reason?: string;
  expected?: any;
  actual?: any;
  timeout?: number;
  missingElements?: string[];
  success?: boolean;
}

export interface RecoveryState {
  walkthroughId: string;
  sessionId: string;
  currentStep: number;
  stepHistory: number[];
  timestamp: number;
  url: string;
  userAgent: string;
}

export interface RecoveryResult {
  canRecover: boolean;
  reason?: string;
  recoveryState?: RecoveryState;
}

export interface URLMatchingRule {
  exact?: string;
  pattern?: string;
  regex?: string;
  path?: {
    exact?: string;
    startsWith?: string;
    endsWith?: string;
    includes?: string;
  };
  query?: {
    [key: string]: string | string[] | undefined;
  };
  hash?: {
    exact?: string;
    startsWith?: string;
    includes?: string;
  };
  domain?: {
    exact?: string;
    includes?: string;
  };
}

export interface StepLocationRule {
  url?: URLMatchingRule;
  navigation?: {
    required?: boolean;
    allowedTypes?: ('spa' | 'page' | 'hash')[];
    waitForNavigation?: boolean;
    navigationTimeout?: number;
  };
  pageState?: {
    requirePageLoad?: boolean;
    waitForElements?: string[];
    waitForCondition?: string;
  };
}

export interface TimeoutConfiguration {
  elementResolution: {
    initial: number;
    retry: number;
    maximum: number;
  };
  userInteraction: {
    click: number;
    input: number;
    custom: number;
  };
  animation: {
    fadeIn: number;
    spotlight: number;
    transition: number;
  };
}

export interface RetryStrategy {
  calculateDelay(attempt: number, baseDelay: number, strategy: string): number;
  shouldRetry(error: ValidationError, attempt: number, maxAttempts: number): boolean;
  getFallbackStrategy(attempt: number): 'skip' | 'abort' | 'fallback';
}

export type StepState = 'pending' | 'resolving' | 'validating' | 'active' | 'completing' | 'completed' | 'failed' | 'skipped';

export interface StepTransition {
  from: StepState;
  to: StepState;
  condition: (context: StepContext) => boolean;
  action: (context: StepContext) => Promise<void>;
}

export interface StepContext {
  step: StepDefinition;
  state: WalkthroughState;
  element?: Element;
  validation?: ElementValidationResult;
  completion?: CompletionValidationResult;
  errors: WalkthroughError[];
}
