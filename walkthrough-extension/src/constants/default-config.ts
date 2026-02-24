import { WalkthroughConfiguration, DarkeningConfig, SpotlightConfig, ErrorDisplayConfig, DebugConfig } from '../types';

export const DEFAULT_WALKTHROUGH_CONFIG: WalkthroughConfiguration = {
  autoStart: false,
  showProgress: true,
  allowSkip: true,
  allowRestart: true,
  debugMode: false,
  errorHandling: {
    showErrors: true,
    allowRetry: true,
    maxRetries: 3
  },
  performance: {
    enablePerformanceMonitoring: false,
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    animationFrameRate: 60
  }
};

export const DEFAULT_DARKENING_CONFIG: DarkeningConfig = {
  opacity: 0.7,
  color: '#000000',
  blur: 0,
  fadeInDuration: 300,
  fadeOutDuration: 200,
  easing: 'ease-in-out',
  coverFixedElements: true,
  coverScrollableContent: true,
  respectViewportBounds: true
};

export const DEFAULT_SPOTLIGHT_CONFIG: SpotlightConfig = {
  padding: 10,
  borderRadius: 8,
  borderWidth: 2,
  borderColor: '#ffffff',
  glowSize: 20,
  glowColor: '#ffffff',
  animationDuration: 400,
  pulseAnimation: true,
  pulseSpeed: 2,
  allowInteractionThroughHole: true,
  highlightOnHover: true
};

export const DEFAULT_ERROR_DISPLAY_CONFIG: ErrorDisplayConfig = {
  position: 'top-right',
  maxWidth: 400,
  showIcon: true,
  showStackTrace: false,
  autoHide: false,
  autoHideDelay: 5000,
  allowDismiss: true,
  blockWalkthrough: false,
  theme: 'auto',
  borderRadius: 8,
  shadow: true
};

export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enabled: false,
  showOverlayInfo: true,
  showStepInfo: true,
  showEventLog: true,
  showPerformanceMetrics: true,
  logLevel: 'error',
  enableInspector: false
};

export const DEFAULT_TIMEOUTS = {
  ELEMENT_RESOLUTION: {
    INITIAL: 5000,
    RETRY: 3000,
    MAXIMUM: 15000
  },
  USER_INTERACTION: {
    CLICK: 30000,
    INPUT: 60000,
    CUSTOM: 120000
  },
  ANIMATION: {
    FADE_IN: 1000,
    SPOTLIGHT: 500,
    TRANSITION: 300
  },
  NAVIGATION: {
    ROUTE_CHANGE: 5000,
    PAGE_LOAD: 10000,
    SPA_TRANSITION: 3000
  },
  VALIDATION: {
    PRE_CONDITION: 2000,
    POST_CONDITION: 2000,
    CUSTOM_VALIDATOR: 5000
  }
};

export const DEFAULT_Z_INDEX = {
  BASE: 999999,
  DARKENING: 999999,
  SPOTLIGHT: 1000000,
  CONTENT: 1000001,
  NOTIFICATIONS: 1000002,
  DEBUG: 1000003
};

export const DEFAULT_RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_STRATEGY: 'exponential' as const
};

export const DEFAULT_VALIDATION_CONFIG = {
  VISIBILITY_CHECK_INTERVAL: 100,
  STABILITY_THRESHOLD: 500,
  INTERACTABILITY_DELAY: 200,
  VIEWPORT_MARGIN: 50
};

export const DEFAULT_PERFORMANCE_CONFIG = {
  FPS_TARGET: 60,
  MEMORY_CHECK_INTERVAL: 5000,
  PERFORMANCE_LOG_INTERVAL: 10000,
  MAX_DOM_NODES: 10000,
  MAX_EVENT_LISTENERS: 1000
};

export const DEFAULT_STORAGE_KEYS = {
  WALKTHROUGH_STATE: 'walkthrough_state',
  RECOVERY_STATE: 'walkthrough_recovery_state',
  ERROR_LOGS: 'walkthrough_error_logs',
  USER_PREFERENCES: 'walkthrough_user_preferences',
  DEBUG_INFO: 'walkthrough_debug_info'
};

export const DEFAULT_SELECTORS = {
  OVERLAY_CONTAINER: '.walkthrough-overlay-container',
  DARKENING_LAYER: '.walkthrough-darkening-layer',
  SPOTLIGHT_LAYER: '.walkthrough-spotlight',
  CONTENT_LAYER: '.walkthrough-content',
  ERROR_CONTAINER: '.walkthrough-error-container',
  DEBUG_PANEL: '.walkthrough-debug-panel'
};

export const DEFAULT_CSS_CLASSES = {
  OVERLAY: 'walkthrough-overlay',
  DARKENING: 'walkthrough-darkening',
  SPOTLIGHT: 'walkthrough-spotlight',
  CONTENT: 'walkthrough-content',
  ERROR: 'walkthrough-error',
  DEBUG: 'walkthrough-debug',
  HIGHLIGHTED: 'walkthrough-highlighted',
  BLOCKED: 'walkthrough-blocked'
};

export const DEFAULT_EVENTS = {
  STEP_START: 'walkthrough-step-start',
  STEP_COMPLETE: 'walkthrough-step-complete',
  STEP_ERROR: 'walkthrough-step-error',
  WALKTHROUGH_START: 'walkthrough-start',
  WALKTHROUGH_COMPLETE: 'walkthrough-complete',
  WALKTHROUGH_ERROR: 'walkthrough-error',
  OVERLAY_SHOW: 'walkthrough-overlay-show',
  OVERLAY_HIDE: 'walkthrough-overlay-hide',
  ERROR_OCCURRED: 'walkthrough-error-occurred',
  NAVIGATION_CHANGE: 'walkthrough-navigation-change'
};
