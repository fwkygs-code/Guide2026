/**
 * Block Registry - Centralized Block Configuration
 * 
 * Architectural enforcement: All block metadata stored as translation keys only.
 * Display strings are NEVER stored here - only translation key references.
 * Labels are resolved at render time via t(key).
 * 
 * This makes it structurally impossible to add a block without translation.
 */

/**
 * Block type definitions
 * Each block stores ONLY translation keys, never display strings
 */
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
  CHECKLIST: 'checklist',
  CALLOUT: 'callout',
  ANNOTATED_IMAGE: 'annotated_image',
  EMBED: 'embed',
  SECTION: 'section',
  CONFIRMATION: 'confirmation',
  EXTERNAL_LINK: 'external_link',
  CODE: 'code'
};

/**
 * Block metadata registry
 * 
 * CRITICAL: Only translation keys are stored here.
 * All labelKey values must exist in translation files.
 * 
 * Structure:
 * {
 *   [blockType]: {
 *     labelKey: 'builder.blocks.blockType',  // Translation key for display name
 *     descriptionKey: 'builder.blocks.blockTypeDescription',  // Translation key for description
 *     category: 'content' | 'media' | 'interactive' | 'layout'
 *   }
 * }
 */
export const BLOCK_REGISTRY = {
  [BLOCK_TYPES.HEADING]: {
    labelKey: 'builder.blocks.heading',
    descriptionKey: 'builder.blocks.headingDescription',
    category: 'content'
  },
  [BLOCK_TYPES.TEXT]: {
    labelKey: 'builder.blocks.text',
    descriptionKey: 'builder.blocks.textDescription',
    category: 'content'
  },
  [BLOCK_TYPES.IMAGE]: {
    labelKey: 'builder.blocks.image',
    descriptionKey: 'builder.blocks.imageDescription',
    category: 'media'
  },
  [BLOCK_TYPES.VIDEO]: {
    labelKey: 'builder.blocks.video',
    descriptionKey: 'builder.blocks.videoDescription',
    category: 'media'
  },
  [BLOCK_TYPES.CAROUSEL]: {
    labelKey: 'builder.blocks.carousel',
    descriptionKey: 'builder.blocks.carouselDescription',
    category: 'media'
  },
  [BLOCK_TYPES.BUTTON]: {
    labelKey: 'builder.blocks.button',
    descriptionKey: 'builder.blocks.buttonDescription',
    category: 'interactive'
  },
  [BLOCK_TYPES.CHECKLIST]: {
    labelKey: 'builder.blocks.checklist',
    descriptionKey: 'builder.blocks.checklistDescription',
    category: 'interactive'
  },
  [BLOCK_TYPES.CONFIRMATION]: {
    labelKey: 'builder.blocks.confirmation',
    descriptionKey: 'builder.blocks.confirmationDescription',
    category: 'interactive'
  },
  [BLOCK_TYPES.DIVIDER]: {
    labelKey: 'builder.blocks.divider',
    descriptionKey: 'builder.blocks.dividerDescription',
    category: 'layout'
  },
  [BLOCK_TYPES.SPACER]: {
    labelKey: 'builder.blocks.spacer',
    descriptionKey: 'builder.blocks.spacerDescription',
    category: 'layout'
  },
  [BLOCK_TYPES.COLUMNS]: {
    labelKey: 'builder.blocks.columns',
    descriptionKey: 'builder.blocks.columnsDescription',
    category: 'layout'
  },
  [BLOCK_TYPES.SECTION]: {
    labelKey: 'builder.blocks.section',
    descriptionKey: 'builder.blocks.sectionDescription',
    category: 'layout'
  },
  [BLOCK_TYPES.PROBLEM]: {
    labelKey: 'builder.blocks.problem',
    descriptionKey: 'builder.blocks.problemDescription',
    category: 'content'
  },
  [BLOCK_TYPES.CALLOUT]: {
    labelKey: 'builder.blocks.callout',
    descriptionKey: 'builder.blocks.calloutDescription',
    category: 'content'
  },
  [BLOCK_TYPES.ANNOTATED_IMAGE]: {
    labelKey: 'builder.blocks.annotatedImage',
    descriptionKey: 'builder.blocks.annotatedImageDescription',
    category: 'media'
  },
  [BLOCK_TYPES.EMBED]: {
    labelKey: 'builder.blocks.embed',
    descriptionKey: 'builder.blocks.embedDescription',
    category: 'media'
  },
  [BLOCK_TYPES.HTML]: {
    labelKey: 'builder.blocks.html',
    descriptionKey: 'builder.blocks.htmlDescription',
    category: 'content'
  },
  [BLOCK_TYPES.CODE]: {
    labelKey: 'builder.blocks.code',
    descriptionKey: 'builder.blocks.codeDescription',
    category: 'content'
  },
  [BLOCK_TYPES.FILE]: {
    labelKey: 'builder.blocks.file',
    descriptionKey: 'builder.blocks.fileDescription',
    category: 'media'
  },
  [BLOCK_TYPES.EXTERNAL_LINK]: {
    labelKey: 'builder.blocks.externalLink',
    descriptionKey: 'builder.blocks.externalLinkDescription',
    category: 'interactive'
  }
};

/**
 * Get block label translation key
 * 
 * @param {string} blockType - Block type identifier
 * @returns {string} Translation key for block label
 */
export function getBlockLabelKey(blockType) {
  const block = BLOCK_REGISTRY[blockType];
  
  if (!block) {
    console.error(`[Block Registry] Unknown block type: ${blockType}`);
    return 'builder.blocks.unknown';
  }
  
  return block.labelKey;
}

/**
 * Get block description translation key
 * 
 * @param {string} blockType - Block type identifier
 * @returns {string} Translation key for block description
 */
export function getBlockDescriptionKey(blockType) {
  const block = BLOCK_REGISTRY[blockType];
  
  if (!block) {
    console.error(`[Block Registry] Unknown block type: ${blockType}`);
    return 'builder.blocks.unknownDescription';
  }
  
  return block.descriptionKey;
}

/**
 * Get all block types
 * 
 * @returns {array} Array of block type identifiers
 */
export function getAllBlockTypes() {
  return Object.keys(BLOCK_REGISTRY);
}

/**
 * Get blocks by category
 * 
 * @param {string} category - Category filter
 * @returns {array} Array of block types in category
 */
export function getBlocksByCategory(category) {
  return Object.entries(BLOCK_REGISTRY)
    .filter(([_, config]) => config.category === category)
    .map(([type, _]) => type);
}

/**
 * Validate block registry against translation files
 * 
 * Development-only validation to ensure all blocks have translations
 * 
 * @param {function} t - i18next translation function
 */
export function validateBlockRegistry(t) {
  if (process.env.NODE_ENV === 'development') {
    const missing = [];
    
    Object.entries(BLOCK_REGISTRY).forEach(([type, config]) => {
      // Check label key
      const label = t(config.labelKey, { defaultValue: null });
      if (label === null) {
        missing.push(config.labelKey);
      }
      
      // Check description key
      const description = t(config.descriptionKey, { defaultValue: null });
      if (description === null) {
        missing.push(config.descriptionKey);
      }
    });
    
    if (missing.length > 0) {
      console.error('[Block Registry Validation] Missing translations:', missing);
      throw new Error(`Block registry has ${missing.length} missing translations. All blocks must have translations before use.`);
    }
    
    console.log('[Block Registry] ✅ All blocks have valid translations');
  }
}

export default {
  BLOCK_TYPES,
  BLOCK_REGISTRY,
  getBlockLabelKey,
  getBlockDescriptionKey,
  getAllBlockTypes,
  getBlocksByCategory,
  validateBlockRegistry
};
