import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { INTERGUIDE_NEW_LOGO_280_URL, INTERGUIDE_LOGO_ALT } from '../utils/logo';

/**
 * InterGuide Logo Component
 * Shows the InterGuide logo image, with fallback to BookOpen icon if image fails to load
 */
const InterGuideLogo = ({ className = "w-8 h-8", showText = false }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    // Fallback to BookOpen icon if logo image fails to load
    return <BookOpen className={`${className} text-primary`} />;
  }

  return (
    <img 
      src={INTERGUIDE_NEW_LOGO_280_URL} 
      alt={INTERGUIDE_LOGO_ALT}
      className={`${className} object-contain`}
      onError={() => setImageError(true)}
    />
  );
};

export default InterGuideLogo;
