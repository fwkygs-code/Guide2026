export interface ErrorDisplayConfig {
  position: 'center' | 'top-right' | 'bottom-right';
  maxWidth: number;
  showIcon: boolean;
  showStackTrace: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  allowDismiss: boolean;
  blockWalkthrough: boolean;
  theme: 'light' | 'dark' | 'auto';
  borderRadius: number;
  shadow: boolean;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  code: string;
  message: string;
  context?: any;
  stack?: string;
  userAgent: string;
  url: string;
  sessionId?: string;
  stepIndex?: number;
  recoveryAttempts: number;
  resolved: boolean;
}

export interface ErrorLogFilter {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  resolved?: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface DebugConfig {
  enabled: boolean;
  showOverlayInfo: boolean;
  showStepInfo: boolean;
  showEventLog: boolean;
  showPerformanceMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableInspector: boolean;
}

export interface DebugEvent {
  timestamp: number;
  type: string;
  data: any;
}

export interface StepDebugInfo {
  currentStep: number;
  totalSteps: number;
  status: string;
  sessionId: string;
}

export interface PerformanceMetrics {
  fps: number;
  memoryUsed: number;
  domNodes: number;
  eventListeners: number;
  renderTime: number;
}

export type FailureState = 'none' | 'emergency-shutdown' | 'target-unavailable' | 
                         'visual-system-failure' | 'state-corruption' | 'recoverable-error';

export interface SafeFailureResult {
  success: boolean;
  userMessage: string;
  technicalDetails: string;
  recoveryPossible: boolean;
  nextAction: string;
}

export interface RecoveryStrategy {
  canExecute(error: any): boolean;
  execute(error: any): SafeFailureResult;
}

export interface ErrorRecoveryContext {
  error: any;
  attempt: number;
  maxAttempts: number;
  strategy: string;
  timestamp: number;
}

export interface ErrorRecoveryResult {
  success: boolean;
  strategy: string;
  attempt: number;
  nextAction: 'retry' | 'skip' | 'abort' | 'continue';
  message?: string;
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  walkthroughId: string;
  sessionId: string;
  stepIndex?: number;
  error: {
    code: string;
    message: string;
    severity: string;
    component: string;
    stack?: string;
  };
  context: {
    url: string;
    userAgent: string;
    element?: string;
    selector?: string;
  };
  recovery: {
    strategy: string;
    attempts: number;
    successful: boolean;
  };
  impact: {
    userVisible: boolean;
    walkthroughInterrupted: boolean;
    dataLost: boolean;
  };
}
