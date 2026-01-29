import React from 'react';

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
      <source src="/AnimationX.mp4" type="video/mp4" />
    </video>
  );
};

export default WorkspaceLoader;
