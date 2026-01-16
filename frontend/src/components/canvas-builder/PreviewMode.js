import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const PreviewMode = ({ walkthrough, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const step = walkthrough.steps[currentStep];
  const progress = ((currentStep + 1) / walkthrough.steps.length) * 100;
  
  // Helper to check if URL is a GIF
  const isGif = (url) => url && (url.toLowerCase().endsWith('.gif') || url.toLowerCase().includes('.gif?'));
  
  // Helper to check if URL is from Cloudinary
  const isCloudinary = (url) => url && url.includes('res.cloudinary.com');
  
  // Add optimization transformations to Cloudinary URLs
  const optimizeCloudinaryUrl = (url, isVideo = false) => {
    if (!isCloudinary(url)) return url;
    
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      const hasVersion = /\/v\d+\//.test(path);
      const hasTransformations = path.match(/\/[a-z_]+:/);
      
      if (hasTransformations) {
        return url;
      }
      
      if (isVideo) {
        const transformations = 'q_auto:good,f_auto,vc_auto,br_1m';
        if (path.includes('/video/upload/')) {
          if (hasVersion) {
            const newPath = path.replace(/(\/video\/upload\/)(v\d+\/)/, `$1${transformations}/$2`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          } else {
            const newPath = path.replace('/video/upload/', `/video/upload/${transformations}/`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          }
        }
      } else {
        const transformations = 'q_auto:good,f_auto';
        if (path.includes('/image/upload/')) {
          if (hasVersion) {
            const newPath = path.replace(/(\/image\/upload\/)(v\d+\/)/, `$1${transformations}/$2`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          } else {
            const newPath = path.replace('/image/upload/', `/image/upload/${transformations}/`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          }
        }
      }
      
      return url;
    } catch (e) {
      console.error('Error optimizing URL:', e);
      return url;
    }
  };
  
  // Convert Cloudinary GIF URL to video format for better mobile playback
  const getGifVideoUrl = (gifUrl) => {
    if (!isCloudinary(gifUrl) || !isGif(gifUrl)) return null;
    
    try {
      const urlObj = new URL(gifUrl);
      let path = urlObj.pathname;
      
      if (path.includes('/video/upload/')) {
        return optimizeCloudinaryUrl(gifUrl, true);
      }
      
      if (path.includes('/image/upload/')) {
        const match = path.match(/\/image\/upload\/(.+)$/);
        if (match) {
          const afterUpload = match[1];
          const cleanPath = afterUpload.split('?')[0].replace(/\.gif$/, '');
          const transformations = 'q_auto:good,f_mp4,vc_auto,br_1m';
          const videoPath = `/video/upload/${transformations}/${cleanPath}.mp4`;
          return `${urlObj.protocol}//${urlObj.host}${videoPath}`;
        }
      }
      
      return null;
    } catch (e) {
      console.error('Error converting GIF URL:', e);
      return null;
    }
  };
  
  // Force GIF reload when step changes (for mobile playback)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const gifImages = document.querySelectorAll('img[data-gif-src]');
      gifImages.forEach((img) => {
        const originalSrc = img.dataset.gifSrc;
        if (originalSrc && isGif(originalSrc)) {
          const separator = originalSrc.includes('?') ? '&' : '?';
          const reloadSrc = `${originalSrc}${separator}_reload=${Date.now()}`;
          img.src = reloadSrc;
          setTimeout(() => {
            if (img && img.dataset.gifSrc === originalSrc && img.src === reloadSrc) {
              img.src = originalSrc;
            }
          }, 100);
        }
      });
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < walkthrough.steps.length - 1) {
      setCompletedSteps(new Set([...completedSteps, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Preview Header */}
      <div className="h-16 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">🎭 Test Mode</span>
          <div className="text-sm text-slate-400">
            Step {currentStep + 1} of {walkthrough.steps.length}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-white hover:bg-slate-700"
          data-testid="exit-preview"
        >
          <X className="w-4 h-4 mr-2" />
          Exit Test Mode
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-800">
        <Progress value={progress} className="h-full" />
      </div>

      {/* Preview Canvas */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-2xl p-12"
            >
              <h1 className="text-4xl font-heading font-bold text-slate-900 mb-8">
                {step?.title}
              </h1>

              {step?.media_url && (
                <div className="mb-8 rounded-lg overflow-hidden">
                  {step.media_type === 'image' && (() => {
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    const gifVideoUrl = isGif(step.media_url) && isMobile ? getGifVideoUrl(step.media_url) : null;
                    
                    // On mobile, render Cloudinary GIFs as video for better playback
                    if (gifVideoUrl) {
                      return (
                        <video
                          key={`preview-video-${currentStep}-${step.media_url}`}
                          src={gifVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full rounded-lg"
                          onError={(e) => {
                            console.log('Video failed, falling back to image');
                            e.target.style.display = 'none';
                          }}
                        />
                      );
                    }
                    
                    // Regular image for non-GIFs or non-Cloudinary GIFs
                    const optimizedImageUrl = isCloudinary(step.media_url) 
                      ? optimizeCloudinaryUrl(step.media_url, false)
                      : step.media_url;
                    
                    return (
                      <img 
                        data-gif-src={isGif(step.media_url) ? step.media_url : undefined}
                        key={`preview-img-${currentStep}-${step.media_url}`}
                        src={optimizedImageUrl} 
                        alt={step.title} 
                        className="w-full rounded-lg"
                        loading="eager"
                        decoding="async"
                        style={isGif(step.media_url) ? {
                          imageRendering: 'auto',
                          WebkitBackfaceVisibility: 'visible',
                          backfaceVisibility: 'visible',
                          transform: 'translateZ(0)',
                          willChange: 'auto'
                        } : {}}
                      />
                    );
                  })()}
                  {step.media_type === 'video' && (
                    <video 
                      src={isCloudinary(step.media_url) ? optimizeCloudinaryUrl(step.media_url, true) : step.media_url} 
                      controls 
                      className="w-full rounded-lg" 
                    />
                  )}
                  {step.media_type === 'youtube' && (
                    <div className="aspect-video">
                      <iframe
                        src={step.media_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              <div
                className="prose prose-lg max-w-none text-slate-700 mb-8"
                dangerouslySetInnerHTML={{ __html: step?.content }}
              />

              {step?.common_problems && step.common_problems.length > 0 && (
                <div className="mt-8 space-y-3">
                  <h3 className="text-sm font-medium text-slate-500">Common Problems</h3>
                  {step.common_problems.map((problem, index) => (
                    <div
                      key={index}
                      className="p-4 bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl"
                    >
                      <h4 className="font-medium text-gray-900 mb-1">{problem.title}</h4>
                      <p className="text-sm text-gray-700">{problem.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-8 border-t border-slate-200 mt-8">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  data-testid="preview-previous"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={currentStep === walkthrough.steps.length - 1}
                  data-testid="preview-next"
                >
                  {currentStep === walkthrough.steps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PreviewMode;
