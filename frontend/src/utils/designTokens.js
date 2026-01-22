/**
 * Design Tokens - Extracted from Knowledge Systems
 *
 * Centralized design system matching Knowledge Systems visual language exactly.
 * DO NOT MODIFY - This is the reference implementation.
 */

// =============================================================================
// COLOR PALETTE - Matching Knowledge Systems
// =============================================================================

export const COLORS = {
  // Core neutrals - exact from Knowledge Systems
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

  // System accent colors - matching Knowledge Systems
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  green: '#10b981',
  indigo: '#6366f1',
  red: '#ef4444'
};

// =============================================================================
// SURFACE STYLES - Exact glass morphism from Knowledge Systems
// =============================================================================

export const SURFACES = {
  // Dark workspace background - exact from KnowledgeSystemsPage
  dark: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',

  // Glass morphism - Knowledge Systems-inspired dark glass
  glass: 'bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/60 backdrop-blur-xl',

  // Card surfaces - exact from KnowledgeSystemCard
  card: {
    base: 'bg-gradient-to-br from-slate-500/20 to-slate-800',
    policy: 'bg-gradient-to-br from-amber-500/20 via-red-500/10 to-slate-800',
    procedure: 'bg-gradient-to-br from-blue-500/20 via-cyan-500/10 to-slate-800',
    documentation: 'bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-slate-800',
    faq: 'bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-slate-800',
    decisionTree: 'bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-slate-800'
  },

  // Header surfaces - exact from KnowledgeSystemsPage header
  header: 'bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10',

  // Floating surfaces - exact from PolicyPortalPage header
  floating: 'bg-white'
};

// =============================================================================
// BORDER STYLES - Exact from Knowledge Systems
// =============================================================================

export const BORDERS = {
  // Card borders - exact from KnowledgeSystemCard
  card: {
    base: 'border-slate-500/30',
    policy: 'border-amber-500/30',
    procedure: 'border-blue-500/30',
    documentation: 'border-purple-500/30',
    faq: 'border-green-500/30',
    decisionTree: 'border-indigo-500/30'
  },

  // Glass borders - subtle, futuristic
  glass: 'border-slate-700/50',

  // Policy borders - exact from PolicyPortalPage
  policy: 'border-amber-200/50'
};

// =============================================================================
// SHADOW STYLES - Exact from Knowledge Systems
// =============================================================================

export const SHADOWS = {
  // Card shadows - exact from KnowledgeSystemCard
  card: 'shadow-2xl',
  hover: 'hover:shadow-2xl',

  // Glass shadows - exact from KnowledgeSystemsNavigationBar
  glass: 'shadow-lg',

  // Header shadows - exact from PolicyPortalPage
  header: 'shadow-sm',

  // Small shadows - exact from PolicyPortalPage cards
  small: 'shadow-sm',
  smallHover: 'hover:shadow-md'
};

// =============================================================================
// MOTION TOKENS - Exact from Knowledge Systems
// =============================================================================

export const MOTION = {
  // Card animations - exact from KnowledgeSystemCard
  card: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: (index) => index * 0.1 }
  },

  // Navigation animations - exact from KnowledgeSystemsNavigationBar
  nav: {
    initial: { y: 100, opacity: 0 },
    animate: { y: (minimized) => minimized ? 60 : 0, opacity: 1 },
    exit: { y: 100, opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 300 }
  },

  // Header animations - exact from KnowledgeSystemsPage
  header: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  },

  // Background effects - exact from KnowledgeSystemCard
  background: {
    hover: 'group-hover:translate-x-full transition-transform duration-1000'
  }
};

// =============================================================================
// TYPOGRAPHY - Exact from Knowledge Systems
// =============================================================================

export const TYPOGRAPHY = {
  // Text colors - exact matches
  colors: {
    primary: 'text-slate-900',
    secondary: 'text-slate-600',
    accent: 'text-white',
    muted: 'text-slate-300',
    inactive: 'text-slate-400',
    status: 'text-green-400'
  },

  // Font weights - exact matches
  weights: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  },

  // Text sizes - exact matches
  sizes: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl'
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

  // Button styling - exact from KnowledgeSystemCard
  button: {
    enabled: 'bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200',
    disabled: 'bg-slate-700 text-slate-400 cursor-not-allowed'
  },

  // Animation effects - exact from KnowledgeSystemCard
  animation: 'bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full',

  // Status colors - exact from KnowledgeSystemCard
  status: {
    active: 'text-green-400',
    inactive: 'text-slate-500'
  }
};