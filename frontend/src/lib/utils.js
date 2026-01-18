import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Normalize image URLs - ensure they're always absolute
const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

export function normalizeImageUrl(url) {
  if (!url) return null;
  
  // CRITICAL: Fix double URLs (API_BASE + Cloudinary URL)
  // If URL contains API_BASE followed by http:// or https://, extract the second URL
  if (typeof url === 'string') {
    const apiBasePattern = new RegExp(`^${API_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(https?://)`, 'i');
    if (apiBasePattern.test(url)) {
      // Extract the URL after API_BASE
      const match = url.match(/https?:\/\/[^\s]+/i);
      if (match) {
        url = match[0];
      }
    }
  }
  
  // If already absolute URL, return as is
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // If relative URL starting with /api or /media, make it absolute
  if (url.startsWith('/api/') || url.startsWith('/media/')) {
    return `${API_BASE.replace(/\/$/, '')}${url}`;
  }
  
  // If relative path, prepend API base
  if (url.startsWith('/')) {
    return `${API_BASE.replace(/\/$/, '')}${url}`;
  }
  
  // Return as is if it's already a valid URL or data URL
  return url;
}

// Recursively normalize all image URLs in an object
export function normalizeImageUrlsInObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeImageUrlsInObject(item));
  }
  
  const normalized = { ...obj };
  
  // Normalize common image URL fields at root level
  const imageFields = ['icon_url', 'media_url', 'url', 'logo'];
  imageFields.forEach(field => {
    if (normalized[field]) {
      normalized[field] = normalizeImageUrl(normalized[field]);
    }
  });
  
  // CRITICAL: Special handling for blocks array - normalize URLs in block.data.url and carousel slides
  if (normalized.steps && Array.isArray(normalized.steps)) {
    normalized.steps = normalized.steps.map(step => {
      if (step.blocks && Array.isArray(step.blocks)) {
        step.blocks = step.blocks.map(block => {
          if (block && block.data) {
            // Normalize URL in block.data.url (for image/video blocks)
            if (block.data.url) {
              block.data.url = normalizeImageUrl(block.data.url);
            }
            // Normalize carousel slides URLs
            if (block.type === 'carousel' && block.data.slides && Array.isArray(block.data.slides)) {
              block.data.slides = block.data.slides.map(slide => {
                if (slide && slide.url) {
                  slide.url = normalizeImageUrl(slide.url);
                }
                return slide;
              });
            }
            // Recursively normalize other fields in block.data
            block.data = normalizeImageUrlsInObject(block.data);
          }
          return block;
        });
      }
      return step;
    });
  }
  
  // Recursively process nested objects (but skip steps as we handled it above)
  Object.keys(normalized).forEach(key => {
    if (key !== 'steps' && typeof normalized[key] === 'object' && normalized[key] !== null) {
      normalized[key] = normalizeImageUrlsInObject(normalized[key]);
    }
  });
  
  return normalized;
}
