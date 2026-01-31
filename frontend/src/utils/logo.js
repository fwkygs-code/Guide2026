/**
 * InterGuide Logo Configuration
 * 
 * This file centralizes the logo path so it can be easily updated
 * and used consistently across the application.
 */

const CLOUDINARY_BASE = 'https://res.cloudinary.com/ds1dgifj8';

export const INTERGUIDE_LOGO_ALT = 'InterGuide';
export const INTERGUIDE_LOGO_MAIN_280_URL = `${CLOUDINARY_BASE}/image/upload/w_280,q_auto,f_auto/interguide-static/logo-main`;
export const INTERGUIDE_LOGO_MAIN_640_URL = `${CLOUDINARY_BASE}/image/upload/w_640,q_auto,f_auto/interguide-static/logo-main`;
export const INTERGUIDE_NEW_LOGO_280_URL = `${CLOUDINARY_BASE}/image/upload/w_280,q_auto,f_auto/interguide-static/new-logo`;
export const INTERGUIDE_NEW_LOGO_640_URL = `${CLOUDINARY_BASE}/image/upload/w_640,q_auto,f_auto/interguide-static/new-logo`;
export const INTERGUIDE_OG_IMAGE_URL = `${CLOUDINARY_BASE}/image/upload/w_1200,h_630,c_fill,g_center,q_auto,f_auto/interguide-static/og-image`;
export const INTERGUIDE_ANIMATION_URL = `${CLOUDINARY_BASE}/video/upload/q_auto,f_auto/interguide-static/animation`;
export const INTERGUIDE_ANIMATIONX_URL = `${CLOUDINARY_BASE}/video/upload/q_auto,f_auto/interguide-static/animationx`;
export const INTERGUIDE_MAIN_ANIMATION_URL = `${CLOUDINARY_BASE}/video/upload/q_auto,f_auto/main-animation`;
export const INTERGUIDE_LOGIN_VIDEO_URL = `${CLOUDINARY_BASE}/video/upload/v1769775181/Login.mp4`;
export const INTERGUIDE_NEW_WEBM_URL = `${CLOUDINARY_BASE}/video/upload/v1769839744/InterGuide_Logo.webm`;

/**
 * Logo component props for consistent sizing
 */
export const LOGO_SIZES = {
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-12 h-12',
  xl: 'w-16 h-16'
};
