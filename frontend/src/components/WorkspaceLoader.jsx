import React from 'react';

const WorkspaceLoader = ({ size = 140, className = '' }) => {
  return (
    <div className={`w-full flex items-center justify-center ${className}`}>
      <video
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
        autoPlay
        muted
        playsInline
        preload="auto"
      >
        <source src="/AnimationX.mp4" type="video/mp4" />
      </video>
    </div>
  );
};

export default WorkspaceLoader;
