// Block types and utilities
export const BLOCK_TYPES = {
  HEADING: 'heading',
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  BUTTON: 'button',
  DIVIDER: 'divider',
  SPACER: 'spacer',
  PROBLEM: 'problem',
  COLUMNS: 'columns',
  HTML: 'html',
  CAROUSEL: 'carousel',
  // New block types (2026-01-21)
  CHECKLIST: 'checklist',
  CALLOUT: 'callout',
  ANNOTATED_IMAGE: 'annotated_image',
  EMBED: 'embed',
  SECTION: 'section',
  CONFIRMATION: 'confirmation',
  EXTERNAL_LINK: 'external_link',
  CODE: 'code'
};

export const createBlock = (type, data = {}) => {
  const defaults = {
    [BLOCK_TYPES.HEADING]: {
      content: '',
      level: 2
    },
    [BLOCK_TYPES.TEXT]: {
      content: ''
    },
    [BLOCK_TYPES.IMAGE]: {
      url: '',
      alt: '',
      caption: ''
    },
    [BLOCK_TYPES.VIDEO]: {
      url: '',
      type: 'url' // url or youtube
    },
    [BLOCK_TYPES.FILE]: {
      url: '',
      name: '',
      size: 0,
      type: ''
    },
    [BLOCK_TYPES.BUTTON]: {
      text: 'Next Step',
      action: 'next', // next, link, check, go_to_step, end, restart, support
      url: '',
      targetStepId: '', // For go_to_step action
      style: 'primary',
      // Support action fields
      supportWhatsapp: '',
      supportPhone: '',
      supportHours: '',
      usePortalContactInfo: true // Use workspace portal contact info or custom
    },
    [BLOCK_TYPES.DIVIDER]: {
      style: 'solid'
    },
    [BLOCK_TYPES.SPACER]: {
      height: 32
    },
    [BLOCK_TYPES.PROBLEM]: {
      title: '',
      explanation: '',
      link: ''
    },
    [BLOCK_TYPES.COLUMNS]: {
      count: 2,
      blocks: [[], []]
    },
    [BLOCK_TYPES.HTML]: {
      content: ''
    },
    [BLOCK_TYPES.CAROUSEL]: {
      slides: [] // Array of { slide_id, file_id, url, media_type, caption }
    },
    // New block types (2026-01-21)
    [BLOCK_TYPES.CHECKLIST]: {
      items: [] // Array of { id, text, checked }
    },
    [BLOCK_TYPES.CALLOUT]: {
      variant: 'tip', // tip, warning, important, info
      content: ''
    },
    [BLOCK_TYPES.ANNOTATED_IMAGE]: {
      url: '',
      alt: '',
      markers: [] // Array of { id, x, y, text }
    },
    [BLOCK_TYPES.EMBED]: {
      provider: 'youtube', // youtube, vimeo, loom, figma, google_docs, notebooklm, gemini
      url: '',
      aspectRatio: '16:9', // 16:9, 4:3, 1:1
      title: ''
    },
    [BLOCK_TYPES.SECTION]: {
      title: '',
      collapsible: false,
      defaultCollapsed: false,
      blocks: []
    },
    [BLOCK_TYPES.CONFIRMATION]: {
      message: '',
      buttonText: 'I understand',
      style: 'checkbox' // checkbox, button
    },
    [BLOCK_TYPES.EXTERNAL_LINK]: {
      text: 'Learn more',
      url: '',
      openInNewTab: true,
      style: 'default' // default, primary, secondary
    },
    [BLOCK_TYPES.CODE]: {
      code: '',
      language: 'bash',
      showLineNumbers: false
    }
  };

  return {
    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    data: { ...defaults[type], ...data },
    settings: {
      alignment: 'left',
      padding: 16,
      margin: 0,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      borderWidth: 0,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      backgroundColor: ''
    }
  };
};

export const detectRTL = (text) => {
  if (!text) return false;
  const hebrewRegex = /[\u0590-\u05FF]/;
  const arabicRegex = /[\u0600-\u06FF]/;
  return hebrewRegex.test(text) || arabicRegex.test(text);
};

export const getBlockIcon = (type) => {
  const icons = {
    heading: '📝',
    text: '📄',
    image: '🖼️',
    video: '🎥',
    file: '📎',
    button: '🔘',
    divider: '➖',
    spacer: '⬜',
    problem: '❗',
    columns: '📊',
    html: '💻',
    carousel: '🎠',
    checklist: '☑️',
    callout: '💬',
    annotated_image: '📌',
    embed: '📺',
    section: '📂',
    confirmation: '✅',
    external_link: '🔗',
    code: '💻'
  };
  return icons[type] || '📦';
};

// Import centralized block registry
import { getBlockLabelKey as getBlockLabelKeyFromRegistry, getAllBlockTypes as getAllBlockTypesFromRegistry } from '../config/blockRegistry';

// Re-export from centralized registry
// Architectural enforcement: All block labels come from registry, not hardcoded here
export const getBlockLabelKey = getBlockLabelKeyFromRegistry;

// Re-export getAllBlockTypes to ensure block picker uses single source of truth
export const getAllBlockTypes = getAllBlockTypesFromRegistry;

// Legacy function - kept for backward compatibility but now returns translation keys
export const getBlockLabel = (type) => {
  return getBlockLabelKey(type);
};