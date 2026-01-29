import React from 'react';
import { INTERGUIDE_ANIMATIONX_URL } from '../utils/logo';

const WorkspaceLoader = ({ size = 160, className = '' }) => {
  return (
    <video
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-contain ${className}`}
      autoPlay
      muted
      playsInline
      preload="auto"
    >
      <source src={INTERGUIDE_ANIMATIONX_URL} />
    </video>
  );
};

export default WorkspaceLoader;
