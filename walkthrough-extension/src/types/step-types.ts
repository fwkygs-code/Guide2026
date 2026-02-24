export interface StepExecutionContext {
  step: any;
  state: any;
  element?: Element;
  validation?: any;
  completion?: any;
  errors: any[];
  startTime: number;
  timeout?: number;
}

export interface StepResolutionResult {
  success: boolean;
  element?: Element;
  bounds?: DOMRect;
  selector: string;
  attempt: number;
  duration: number;
  errors: string[];
}

export interface StepCompletionResult {
  completed: boolean;
  valid: boolean;
  userAction?: any;
  timestamp: number;
  duration: number;
  validationErrors: string[];
}

export interface StepRetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: any) => boolean;
}

export interface StepTimeoutConfig {
  resolution: number;
  interaction: number;
  validation: number;
  animation: number;
  navigation: number;
}

export interface StepValidationConfig {
  preConditions: boolean;
  postConditions: boolean;
  elementVisibility: boolean;
  elementInteractability: boolean;
  urlMatching: boolean;
  customValidators: string[];
}

export interface StepAnimationConfig {
  entry: {
    type: 'fade' | 'scale' | 'slide' | 'none';
    duration: number;
    easing: string;
    delay: number;
  };
  exit: {
    type: 'fade' | 'scale' | 'slide' | 'none';
    duration: number;
    easing: string;
    delay: number;
  };
  spotlight: {
    type: 'fade' | 'scale' | 'pulse' | 'none';
    duration: number;
    easing: string;
    infinite: boolean;
  };
}

export interface StepNavigationConfig {
  allowPrevious: boolean;
  allowNext: boolean;
  allowSkip: boolean;
  allowRestart: boolean;
  allowExit: boolean;
  keyboardShortcuts: {
    next: string[];
    previous: string[];
    skip: string[];
    exit: string[];
  };
}

export interface StepContentConfig {
  title: {
    visible: boolean;
    maxLength: number;
    allowHtml: boolean;
  };
  description: {
    visible: boolean;
    maxLength: number;
    allowHtml: boolean;
  };
  progress: {
    visible: boolean;
    format: 'steps' | 'percentage' | 'both';
    showTime: boolean;
  };
  media: {
    images: boolean;
    videos: boolean;
    maxWidth: number;
    maxHeight: number;
  };
}

export interface StepTargetConfig {
  primary: {
    selector: string;
    required: boolean;
    timeout: number;
  };
  fallbacks: {
    selector: string;
    priority: number;
    timeout: number;
  }[];
  constraints: {
    visible: boolean;
    interactable: boolean;
    inViewport: boolean;
    stable: boolean;
    stabilityThreshold: number;
  };
  search: {
    scope: 'document' | 'shadow-dom' | 'iframe';
    includeHidden: boolean;
    caseSensitive: boolean;
  };
}

export interface StepInteractionConfig {
  type: 'click' | 'hover' | 'input' | 'custom' | 'none' | 'automatic';
  target: string;
  requirements: {
    mustClick: boolean;
    mustHover: boolean;
    mustInput: boolean;
    customValidation?: string;
  };
  timeout: number;
  preventDefault: boolean;
  stopPropagation: boolean;
  allowMultiple: boolean;
}

export interface StepConditionConfig {
  pre: {
    url?: string;
    elementExists?: string;
    elementVisible?: string;
    customFunction?: string;
  };
  post: {
    urlChanged?: boolean;
    elementChanged?: string;
    customFunction?: string;
  };
  validation: {
    strict: boolean;
    timeout: number;
    retryOnFailure: boolean;
  };
}

export interface StepMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  userInteractions: number;
  errors: number;
  retries: number;
  skipped: boolean;
  completed: boolean;
}

export interface StepAnalytics {
  stepId: string;
  walkthroughId: string;
  sessionId: string;
  userId?: string;
  metrics: StepMetrics;
  context: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
    element?: string;
  };
  errors: {
    code: string;
    message: string;
    timestamp: number;
    recovery: string;
  }[];
}
