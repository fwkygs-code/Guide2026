import DOMPurify from 'dompurify';
import { RICH_TEXT_COLOR_PALETTE, RICH_TEXT_HIGHLIGHT_PALETTE } from '../utils/richTextColors';

const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'title', 'style'];

const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'svg', 'math'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

const ALLOWED_COLOR_VALUES = new Set(
  RICH_TEXT_COLOR_PALETTE.map((value) => value.toLowerCase())
);

const ALLOWED_HIGHLIGHT_VALUES = new Set(
  RICH_TEXT_HIGHLIGHT_PALETTE.map((value) => value.toLowerCase())
);

const COLOR_STYLE_TAGS = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'A', 'P', 'LI', 'MARK']);

let hooksInitialized = false;

const ensureHooksInitialized = () => {
  if (hooksInitialized) return;
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName !== 'style') {
      return;
    }
    if (!COLOR_STYLE_TAGS.has(node.nodeName)) {
      data.keepAttr = false;
      return;
    }
    const styleValue = data.attrValue || '';
    const colorMatch = /color\s*:\s*([^;]+)\s*;?/i.exec(styleValue);
    const backgroundMatch = /background-color\s*:\s*([^;]+)\s*;?/i.exec(styleValue);
    const allowedStyles = [];

    if (colorMatch) {
      const colorValue = colorMatch[1].trim().toLowerCase();
      if (ALLOWED_COLOR_VALUES.has(colorValue)) {
        allowedStyles.push(`color: ${colorValue}`);
      }
    }

    if (backgroundMatch) {
      const backgroundValue = backgroundMatch[1].trim().toLowerCase();
      if (ALLOWED_HIGHLIGHT_VALUES.has(backgroundValue)) {
        allowedStyles.push(`background-color: ${backgroundValue}`);
      }
    }

    if (!allowedStyles.length) {
      data.keepAttr = false;
      return;
    }

    data.attrValue = allowedStyles.join('; ');
  });
  hooksInitialized = true;
};

const sanitizeHtml = (dirtyHtml) => {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') {
    return '';
  }

  ensureHooksInitialized();
  const clean = DOMPurify.sanitize(dirtyHtml, SANITIZE_CONFIG);

  // Ensure safe link behavior without relying on raw HTML
  return clean.replace(
    /<a\b([^>]*)>/gi,
    (match, attrs) => {
      const hasRel = /\brel\s*=/i.test(attrs);
      const rel = hasRel ? attrs : `${attrs} rel="noopener noreferrer"`;
      return `<a${rel}>`;
    }
  );
};

export default sanitizeHtml;
