export interface MessageEnvelope {
  version: string;
  type: string;
  payload: unknown;
  timestamp: number;
  messageId: string;
  source: 'background' | 'content' | 'overlay' | 'step-engine' | 'state';
  destination?: string;
}

export interface WalkthroughInitMessage {
  walkthroughId: string;
  definition: any;
  startStep?: number;
  configuration: any;
}

export interface WalkthroughStartMessage {
  sessionId: string;
  startStep: number;
  timestamp: number;
}

export interface StepActivateMessage {
  stepIndex: number;
  stepDefinition: any;
  sessionId: string;
}

export interface ElementResolvedMessage {
  element: Element;
  bounds: DOMRect;
  stepIndex: number;
  spotlightConfig: any;
}

export interface OverlayRenderMessage {
  overlayId: string;
  spotlightBounds: DOMRect;
  animationConfig: any;
}

export interface StepCompleteMessage {
  stepIndex: number;
  completionData: any;
  timestamp: number;
  userActions: any[];
}

export interface ProgressUpdateMessage {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  status: 'active' | 'completed' | 'aborted';
}

export interface ErrorOccurredMessage {
  component: string;
  error: Error;
  context: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface RecoveryAttemptMessage {
  strategy: 'retry' | 'skip' | 'abort';
  stepIndex: number;
  maxRetries: number;
  currentAttempt: number;
}

export interface RouteChangeDetectedMessage {
  oldUrl: string;
  newUrl: string;
  navigationType: 'spa' | 'page' | 'reload';
  timestamp: number;
}

export interface StepLocationValidateMessage {
  requiredUrl?: string;
  urlPattern?: string;
  currentUrl: string;
  stepIndex: number;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}

export type MessageType = 
  | 'WALKTHROUGH_INIT'
  | 'WALKTHROUGH_START'
  | 'STEP_ACTIVATE'
  | 'ELEMENT_RESOLVED'
  | 'OVERLAY_RENDER'
  | 'STEP_COMPLETE'
  | 'PROGRESS_UPDATE'
  | 'ERROR_OCCURRED'
  | 'RECOVERY_ATTEMPT'
  | 'ROUTE_CHANGE_DETECTED'
  | 'STEP_LOCATION_VALIDATE';

export interface MessageHandler {
  (message: MessageEnvelope): Promise<MessageResponse>;
}

export interface MessageValidator {
  validate(message: MessageEnvelope): boolean;
  getValidationError(message: MessageEnvelope): string | null;
}

export interface MessageVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface MessageCompatibility {
  version: string;
  compatibleVersions: string[];
  breakingChanges: string[];
}
