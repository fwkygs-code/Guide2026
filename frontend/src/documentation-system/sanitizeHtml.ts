import DOMPurify from 'dompurify';

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
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'title'];

const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'svg', 'math'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

const sanitizeHtml = (dirtyHtml: string) => {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') {
    return '';
  }

  const clean = DOMPurify.sanitize(dirtyHtml, SANITIZE_CONFIG);

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
