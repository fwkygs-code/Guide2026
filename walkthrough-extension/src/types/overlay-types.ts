export interface DarkeningConfig {
  opacity: number;
  color: string;
  blur: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  easing: string;
  coverFixedElements: boolean;
  coverScrollableContent: boolean;
  respectViewportBounds: boolean;
}

export interface SpotlightConfig {
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  glowSize: number;
  glowColor: string;
  animationDuration: number;
  pulseAnimation: boolean;
  pulseSpeed: number;
  allowInteractionThroughHole: boolean;
  highlightOnHover: boolean;
}

export interface InterceptionConfig {
  allowTargetInteraction: boolean;
  targetElement: HTMLElement;
  allowEscapeKey: boolean;
  allowNavigation: boolean;
}

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

export interface OverlayDebugInfo {
  active: boolean;
  zIndex: number;
  spotlightActive: boolean;
  targetSelector?: string;
  targetBounds?: DOMRect;
}

export interface AnimationConfig {
  type: 'fade' | 'scale' | 'slide';
  duration: number;
  easing: string;
  delay: number;
}

export interface ZIndexLayer {
  name: string;
  zIndex: number;
  elements: HTMLElement[];
}

export interface EventInterceptionResult {
  intercepted: boolean;
  allowed: boolean;
  eventType: string;
  target: Element;
  timestamp: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface DOMMutationRecord {
  type: string;
  target: Element;
  addedNodes: Node[];
  removedNodes: Node[];
  attributeName?: string;
  oldValue?: string;
  timestamp: number;
}

export interface ResizeRecord {
  target: Element;
  contentRect: DOMRectReadOnly;
  borderRect: DOMRectReadOnly;
  timestamp: number;
}

export interface OverlayState {
  isActive: boolean;
  darkeningActive: boolean;
  spotlightActive: boolean;
  currentTarget?: HTMLElement;
  currentBounds?: DOMRect;
  zIndices: Map<string, number>;
  interceptedEvents: Set<string>;
  scrollLocked: boolean;
  originalScrollPosition: ScrollPosition;
}

export interface OverlayEvent {
  type: 'overlay-created' | 'overlay-destroyed' | 'spotlight-updated' | 'scroll-locked' | 'scroll-unlocked';
  timestamp: number;
  data?: any;
}
