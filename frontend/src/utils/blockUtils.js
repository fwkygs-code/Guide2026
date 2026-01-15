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
  HTML: 'html'
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
      text: 'Button',
      action: 'next', // next, link, check
      url: '',
      style: 'primary'
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
    }
  };

  return {
    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    data: { ...defaults[type], ...data },
    settings: {
      alignment: 'left',
      padding: 16,
      margin: 0
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
    html: '💻'
  };
  return icons[type] || '📦';
};

export const getBlockLabel = (type) => {
  const labels = {
    heading: 'Heading',
    text: 'Text',
    image: 'Image/GIF',
    video: 'Video',
    file: 'File',
    button: 'Button',
    divider: 'Divider',
    spacer: 'Spacer',
    problem: 'Problem',
    columns: 'Columns',
    html: 'HTML'
  };
  return labels[type] || type;
};