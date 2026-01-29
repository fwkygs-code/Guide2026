import React from 'react';

const WorkspaceLoader = () => {
  return (
    <div className="w-full h-full flex items-center justify-center py-16">
      <video
        width="80"
        height="80"
        className="w-20 h-20 object-contain"
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
