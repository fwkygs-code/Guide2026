/**
 * Futuristic Design System - Content Type Specific Visual Languages
 *
 * Each content type has a distinctive, intentional visual identity that represents
 * its purpose and creates immediate recognition. Modern glass morphism with
 * micro-animations and purposeful iconography.
 */

// =============================================================================
// FUTURISTIC COLOR PALETTE - Purpose-Driven & Distinctive
// =============================================================================

export const COLORS = {
  // Core neutrals - enhanced for glass morphism
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617'
  },

  // Content Type Specific Palettes - Each represents purpose
  contentTypes: {
    // POLICIES: Authoritative, Legal, Compliance - Warm Authority
    policy: {
      primary: '#f59e0b',      // Amber - Legal authority
      secondary: '#ea580c',    // Orange - Compliance
      accent: '#dc2626',       // Red - Critical importance
      glass: '#f59e0b',        // Matching glass effects
      glow: '#f59e0b',
      surface: 'from-amber-500/15 via-orange-500/8 to-slate-900/95'
    },

    // PROCEDURES: Structured, Sequential, Workflow - Cool Precision
    procedure: {
      primary: '#06b6d4',      // Cyan - Clear process flow
      secondary: '#0891b2',    // Cyan-600 - Step precision
      accent: '#0369a1',       // Blue-700 - System reliability
      glass: '#06b6d4',
      glow: '#06b6d4',
      surface: 'from-cyan-500/15 via-blue-500/8 to-slate-900/95'
    },

    // DOCUMENTATION: Knowledge, Reference, Structure - Regal Wisdom
    documentation: {
      primary: '#8b5cf6',      // Purple - Deep knowledge
      secondary: '#7c3aed',    // Violet - Technical depth
      accent: '#581c87',       // Purple-900 - Authority
      glass: '#8b5cf6',
      glow: '#8b5cf6',
      surface: 'from-purple-500/15 via-violet-500/8 to-slate-900/95'
    },

    // FAQS: Conversational, Helpful, Accessible - Warm Approachable
    faq: {
      primary: '#10b981',      // Emerald - Helpful guidance
      secondary: '#059669',    // Emerald-600 - Trust
      accent: '#047857',       // Emerald-700 - Reliability
      glass: '#10b981',
      glow: '#10b981',
      surface: 'from-emerald-500/15 via-green-500/8 to-slate-900/95'
    },

    // DECISION TREES: Interactive, Branching, Logic - Electric Intelligence
    decisionTree: {
      primary: '#6366f1',      // Indigo - Logical thinking
      secondary: '#4f46e5',    // Indigo-600 - Decision making
      accent: '#312e81',       // Indigo-900 - Deep analysis
      glass: '#6366f1',
      glow: '#6366f1',
      surface: 'from-indigo-500/15 via-violet-500/8 to-slate-900/95'
    }
  }
};

// =============================================================================
// FUTURISTIC SURFACE STYLES - Glass Morphism with Purpose
// =============================================================================

export const SURFACES = {
  // Dark workspace background - enhanced depth
  dark: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800',

  // Advanced glass morphism - ultra-modern with subtle depth
  glass: {
    primary: 'bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/70 backdrop-blur-2xl border border-white/5',
    secondary: 'bg-gradient-to-br from-slate-800/85 via-slate-700/75 to-slate-800/65 backdrop-blur-xl border border-white/3',
    accent: 'bg-gradient-to-br from-white/10 via-slate-200/5 to-transparent backdrop-blur-xl border border-white/10'
  },

  // Content Type Card Surfaces - Purposeful gradients with glass effects
  card: {
    // POLICIES: Authoritative glass with warm amber undertones
    policy: 'bg-gradient-to-br from-amber-500/15 via-orange-500/8 to-slate-900/95 backdrop-blur-xl border border-amber-500/20',

    // PROCEDURES: Precision glass with cool cyan flows
    procedure: 'bg-gradient-to-br from-cyan-500/15 via-blue-500/8 to-slate-900/95 backdrop-blur-xl border border-cyan-500/20',

    // DOCUMENTATION: Regal glass with deep purple knowledge
    documentation: 'bg-gradient-to-br from-purple-500/15 via-violet-500/8 to-slate-900/95 backdrop-blur-xl border border-purple-500/20',

    // FAQS: Approachable glass with warm green trust
    faq: 'bg-gradient-to-br from-emerald-500/15 via-green-500/8 to-slate-900/95 backdrop-blur-xl border border-emerald-500/20',

    // DECISION TREES: Intelligent glass with electric indigo logic
    decisionTree: 'bg-gradient-to-br from-indigo-500/15 via-violet-500/8 to-slate-900/95 backdrop-blur-xl border border-indigo-500/20'
  },

  // Portal Headers - Content type specific atmospheric effects
  header: {
    policy: 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-900/80 backdrop-blur-xl',
    procedure: 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-slate-900/80 backdrop-blur-xl',
    documentation: 'bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-slate-900/80 backdrop-blur-xl',
    faq: 'bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-slate-900/80 backdrop-blur-xl',
    decisionTree: 'bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-slate-900/80 backdrop-blur-xl'
  },

  // Floating surfaces - context-aware glass
  floating: {
    light: 'bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl',
    dark: 'bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl'
  }
};

// =============================================================================
// FUTURISTIC BORDER STYLES - Subtle Glass Edges
// =============================================================================

export const BORDERS = {
  // Content Type Card Borders - Purposeful illumination
  card: {
    policy: 'border-amber-400/30 hover:border-amber-400/50 transition-colors duration-300',
    procedure: 'border-cyan-400/30 hover:border-cyan-400/50 transition-colors duration-300',
    documentation: 'border-purple-400/30 hover:border-purple-400/50 transition-colors duration-300',
    faq: 'border-emerald-400/30 hover:border-emerald-400/50 transition-colors duration-300',
    decisionTree: 'border-indigo-400/30 hover:border-indigo-400/50 transition-colors duration-300'
  },

  // Glass morphism borders - ultra-subtle with context
  glass: {
    primary: 'border-white/10',
    secondary: 'border-white/5',
    accent: 'border-white/20'
  },

  // Interactive borders - dynamic illumination
  interactive: {
    focus: 'focus:border-white/30 focus:ring-2 focus:ring-white/10',
    hover: 'hover:border-white/20 transition-all duration-200'
  }
};

// =============================================================================
// FUTURISTIC SHADOW STYLES - Dynamic Illumination
// =============================================================================

export const SHADOWS = {
  // Content Type Card Shadows - Purposeful glow effects
  card: {
    policy: 'shadow-amber-500/10 hover:shadow-amber-500/25 transition-shadow duration-500',
    procedure: 'shadow-cyan-500/10 hover:shadow-cyan-500/25 transition-shadow duration-500',
    documentation: 'shadow-purple-500/10 hover:shadow-purple-500/25 transition-shadow duration-500',
    faq: 'shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-shadow duration-500',
    decisionTree: 'shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-shadow duration-500'
  },

  // Glass morphism shadows - layered depth
  glass: {
    subtle: 'shadow-lg shadow-black/20',
    medium: 'shadow-xl shadow-black/30',
    strong: 'shadow-2xl shadow-black/40'
  },

  // Interactive shadows - dynamic illumination
  interactive: {
    lift: 'hover:shadow-2xl hover:-translate-y-1 transition-all duration-300',
    glow: 'hover:shadow-2xl hover:shadow-current/20 transition-all duration-300'
  },

  // Atmospheric shadows - environmental effects
  atmospheric: {
    floating: 'shadow-2xl shadow-black/50',
    elevated: 'shadow-xl shadow-black/30'
  }
};

// =============================================================================
// FUTURISTIC MOTION TOKENS - Purposeful Micro-Animations
// =============================================================================

export const MOTION = {
  // Content Type Card Animations - Staggered reveals with personality
  card: {
    policy: {
      initial: { opacity: 0, y: 30, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.6, delay: (index) => index * 0.15, ease: 'easeOut' }
    },
    procedure: {
      initial: { opacity: 0, x: -30 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.5, delay: (index) => index * 0.1, ease: 'easeOut' }
    },
    documentation: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: 0.7, delay: (index) => index * 0.12, ease: 'easeOut' }
    },
    faq: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, delay: (index) => index * 0.08, ease: 'easeOut' }
    },
    decisionTree: {
      initial: { opacity: 0, rotateY: -15 },
      animate: { opacity: 1, rotateY: 0 },
      transition: { duration: 0.6, delay: (index) => index * 0.1, ease: 'easeOut' }
    }
  },

  // Page Transitions - Smooth atmospheric changes
  page: {
    enter: {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    exit: {
      initial: { opacity: 1, scale: 1 },
      animate: { opacity: 0, scale: 1.02 },
      transition: { duration: 0.3, ease: 'easeIn' }
    }
  },

  // Interactive Elements - Micro-feedback
  interactive: {
    hover: {
      scale: 1.02,
      transition: { duration: 0.2, ease: 'easeOut' }
    },
    tap: {
      scale: 0.98,
      transition: { duration: 0.1, ease: 'easeInOut' }
    },
    focus: {
      ring: 'ring-2 ring-white/20',
      transition: { duration: 0.2 }
    }
  },

  // Background Effects - Atmospheric animations
  background: {
    shimmer: 'group-hover:translate-x-full transition-transform duration-1000 ease-out',
    pulse: 'animate-pulse',
    glow: 'animate-pulse shadow-current/20'
  },

  // Content Reveals - Progressive disclosure
  reveal: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.3 }
    },
    slideUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: 'easeOut' }
    },
    slideDown: {
      initial: { opacity: 0, y: -20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: 'easeOut' }
    }
  }
};

// =============================================================================
// FUTURISTIC TYPOGRAPHY - Purpose-Driven Hierarchy
// =============================================================================

export const TYPOGRAPHY = {
  // Text colors - semantic tokens for dark theme
  colors: {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    accent: 'text-primary',
    muted: 'text-muted-foreground',
    inactive: 'text-muted-foreground/60',
    status: 'text-green-400',
    glass: 'text-foreground/90',
    glassMuted: 'text-muted-foreground'
  },

  // Font weights - enhanced hierarchy
  weights: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold'
  },

  // Text sizes - enhanced scale
  sizes: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl'
  },

  // Content Type Typography - Purpose-specific styling
  contentType: {
    policy: {
      heading: 'font-bold text-amber-100',
      subheading: 'font-medium text-amber-200/80',
      body: 'text-slate-200 leading-relaxed'
    },
    procedure: {
      heading: 'font-bold text-cyan-100',
      subheading: 'font-medium text-cyan-200/80',
      body: 'text-slate-200 leading-relaxed'
    },
    documentation: {
      heading: 'font-bold text-purple-100',
      subheading: 'font-medium text-purple-200/80',
      body: 'text-slate-200 leading-relaxed'
    },
    faq: {
      heading: 'font-bold text-emerald-100',
      subheading: 'font-medium text-emerald-200/80',
      body: 'text-slate-200 leading-relaxed'
    },
    decisionTree: {
      heading: 'font-bold text-indigo-100',
      subheading: 'font-medium text-indigo-200/80',
      body: 'text-slate-200 leading-relaxed'
    }
  }
};

// =============================================================================
// ICONOGRAPHY - Purposeful Symbols for Each Content Type
// =============================================================================

export const ICONOGRAPHY = {
  contentTypes: {
    // POLICIES: Authority, legality, compliance
    policy: {
      primary: 'Shield',        // Authority & protection
      secondary: 'Scale',       // Justice & balance
      accent: 'FileCheck',      // Compliance & verification
      decorative: 'Award'       // Achievement & standards
    },

    // PROCEDURES: Structure, sequence, workflow
    procedure: {
      primary: 'Workflow',      // Process flow
      secondary: 'ArrowRight',  // Progression
      accent: 'CheckCircle2',   // Completion
      decorative: 'Zap'         // Efficiency
    },

    // DOCUMENTATION: Knowledge, reference, structure
    documentation: {
      primary: 'BookOpen',      // Knowledge access
      secondary: 'FolderTree',  // Hierarchical structure
      accent: 'Search',         // Discovery
      decorative: 'Lightbulb'   // Insight
    },

    // FAQS: Help, conversation, accessibility
    faq: {
      primary: 'MessageCircle', // Conversation
      secondary: 'HelpCircle',  // Assistance
      accent: 'Users',          // Community
      decorative: 'Heart'       // Care
    },

    // DECISION TREES: Logic, branching, intelligence
    decisionTree: {
      primary: 'GitBranch',     // Branching logic
      secondary: 'Brain',       // Intelligence
      accent: 'Target',         // Precision
      decorative: 'Sparkles'    // Innovation
    }
  },

  // Interactive states
  states: {
    active: 'CheckCircle2',
    inactive: 'Circle',
    loading: 'Loader2',
    error: 'AlertCircle',
    success: 'CheckCircle',
    warning: 'AlertTriangle'
  }
};

// =============================================================================
// SPACING - Exact from Knowledge Systems
// =============================================================================

export const SPACING = {
  // Container padding - exact matches
  container: {
    page: 'max-w-6xl mx-auto px-6',
    content: 'max-w-4xl mx-auto px-6',
    card: 'p-6',
    header: 'px-6 py-12',
    nav: 'px-6 py-4'
  },

  // Gaps - exact matches
  gaps: {
    small: 'gap-3',
    medium: 'gap-4',
    large: 'gap-6'
  },

  // Margins - exact matches
  margins: {
    section: 'mb-4',
    card: 'mb-6',
    page: 'pb-12'
  }
};

// =============================================================================
// UTILITY CLASSES - Exact combinations from Knowledge Systems
// =============================================================================

export const UTILITIES = {
  // Card styling - exact from KnowledgeSystemCard
  card: 'relative overflow-hidden backdrop-blur-sm transition-all duration-300 group',

  // Button styling - using semantic tokens
  button: {
    enabled: 'bg-secondary/50 hover:bg-secondary text-foreground border-border transition-all duration-200',
    disabled: 'bg-muted text-muted-foreground cursor-not-allowed'
  },

  // Animation effects - exact from KnowledgeSystemCard
  animation: 'bg-gradient-to-r from-transparent via-foreground/5 to-transparent -translate-x-full',

  // Status colors - exact from KnowledgeSystemCard
  status: {
    active: 'text-green-400',
    inactive: 'text-muted-foreground'
  }
};