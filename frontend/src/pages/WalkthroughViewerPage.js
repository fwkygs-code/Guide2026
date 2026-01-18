import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Check, X, Smile, Meh, Frown, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const API = `${API_BASE.replace(/\/$/, '')}/api`;

const WalkthroughViewerPage = ({ isEmbedded = false }) => {
  const { slug, walkthroughId } = useParams();
  
  // Detect if we're in an iframe
  const inIframe = isEmbedded || window.self !== window.top;
  const navigate = useNavigate();
  const [walkthrough, setWalkthrough] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [checkoffSteps, setCheckoffSteps] = useState(new Set());
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  
  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  
  // Helper to check if URL is a GIF (by extension or Cloudinary video URL from GIF)
  const isGif = (url, mediaType = null) => {
    if (!url) {
      console.log('[GIF Debug] isGif: No URL provided');
      return false;
    }
    const lowerUrl = url.toLowerCase();
    // Check for .gif extension
    if (lowerUrl.endsWith('.gif') || lowerUrl.includes('.gif?')) {
      console.log('[GIF Debug] isGif: Detected GIF by extension:', url);
      return true;
    }
    // If it's a Cloudinary video URL with media_type='image', it's definitely a GIF uploaded as video
    // This is the key detection for re-uploaded GIFs
    if (isCloudinary(url) && url.includes('/video/upload/') && mediaType === 'image') {
      console.log('[GIF Debug] isGif: Detected GIF - Cloudinary video URL with media_type=image (re-uploaded GIF):', url);
      return true;
    }
    // Check if URL contains 'gif' in the path (original filename preserved in some cases)
    if (isCloudinary(url) && url.includes('/video/upload/')) {
      try {
        const urlObj = new URL(url);
        if (urlObj.pathname.toLowerCase().includes('gif')) {
          console.log('[GIF Debug] isGif: Detected GIF - URL path contains "gif":', url);
          return true;
        }
      } catch (e) {
        console.error('[GIF Debug] isGif: Error parsing URL:', e, url);
      }
    }
    console.log('[GIF Debug] isGif: Not a GIF:', url, 'mediaType:', mediaType);
    return false;
  };
  
  // Helper to check if URL is from Cloudinary
  const isCloudinary = (url) => url && url.includes('res.cloudinary.com');
  
  // Check if URL is a Cloudinary video (could be from GIF upload)
  const isCloudinaryVideo = (url) => {
    return isCloudinary(url) && url.includes('/video/upload/');
  };
  
  // Add optimization transformations to Cloudinary URLs
  const optimizeCloudinaryUrl = (url, isVideo = false) => {
    if (!isCloudinary(url)) return url;
    
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // Check if transformations already exist (look for version number or transformation params)
      // Cloudinary URLs with transformations look like: /image/upload/v1234567890/... or /image/upload/q_auto/...
      const hasVersion = /\/v\d+\//.test(path);
      const hasTransformations = path.match(/\/[a-z_]+:/);
      
      if (hasTransformations) {
        // Already has transformations, return as-is
        return url;
      }
      
      if (isVideo) {
        // Video optimizations: quality, format, bitrate
        const transformations = 'q_auto:good,f_auto,vc_auto,br_1m';
        if (path.includes('/video/upload/')) {
          // Insert transformations after /video/upload/ but before version if exists
          // Cloudinary format: /video/upload/[transformations]/v123/folder/file
          if (hasVersion) {
            // Add transformations before version
            const newPath = path.replace(/(\/video\/upload\/)(v\d+\/)/, `$1${transformations}/$2`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          } else {
            // No version, add transformations directly
            const newPath = path.replace('/video/upload/', `/video/upload/${transformations}/`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          }
        }
      } else {
        // Image optimizations: quality, format
        const transformations = 'q_auto:good,f_auto';
        if (path.includes('/image/upload/')) {
          // Cloudinary format: /image/upload/[transformations]/v123/folder/file
          if (hasVersion) {
            // Add transformations before version
            const newPath = path.replace(/(\/image\/upload\/)(v\d+\/)/, `$1${transformations}/$2`);
            return `${urlObj.protocol}//${urlObj.host}${newPath}${urlObj.search}`;
          } else {
            // No version, add transformations directly
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
  const getGifVideoUrl = (gifUrl, mediaType = null) => {
    console.log('[GIF Debug] getGifVideoUrl called:', { gifUrl, mediaType, isCloudinary: isCloudinary(gifUrl), isGif: isGif(gifUrl, mediaType) });
    
    if (!isCloudinary(gifUrl)) {
      console.log('[GIF Debug] getGifVideoUrl: Not a Cloudinary URL, returning null');
      return null;
    }
    
    if (!isGif(gifUrl, mediaType)) {
      console.log('[GIF Debug] getGifVideoUrl: Not detected as GIF, returning null');
      return null;
    }
    
    try {
      const urlObj = new URL(gifUrl);
      let path = urlObj.pathname;
      console.log('[GIF Debug] getGifVideoUrl: Parsed path:', path);
      
      // If already in video format (new uploads), optimize and return
      if (path.includes('/video/upload/')) {
        const optimized = optimizeCloudinaryUrl(gifUrl, true);
        console.log('[GIF Debug] getGifVideoUrl: Already video format, optimized:', optimized);
        return optimized;
      }
      
      // Convert image/upload to video/upload for old GIFs
      if (path.includes('/image/upload/')) {
        // Extract everything after /image/upload/
        const match = path.match(/\/image\/upload\/(.+)$/);
        if (match) {
          const afterUpload = match[1];
          let cleanPath = afterUpload.split('?')[0];
          console.log('[GIF Debug] getGifVideoUrl: Extracted path after /image/upload/:', cleanPath);
          
          // Handle version numbers: /v1234567890/folder/file.gif
          if (cleanPath.match(/^v\d+\//)) {
            // Has version, keep it and replace .gif with .mp4
            cleanPath = cleanPath.replace(/\.gif$/i, '.mp4'); // Case-insensitive
            const transformations = 'q_auto:good,f_mp4,vc_auto,br_1m';
            const videoPath = `/video/upload/${transformations}/${cleanPath}`;
            const result = `${urlObj.protocol}//${urlObj.host}${videoPath}${urlObj.search}`;
            console.log('[GIF Debug] getGifVideoUrl: Converted (with version):', result);
            return result;
          } else {
            // No version, just replace .gif with .mp4
            // Remove .gif extension (case-insensitive)
            cleanPath = cleanPath.replace(/\.gif$/i, '');
            const transformations = 'q_auto:good,f_mp4,vc_auto,br_1m';
            const videoPath = `/video/upload/${transformations}/${cleanPath}.mp4`;
            const result = `${urlObj.protocol}//${urlObj.host}${videoPath}${urlObj.search}`;
            console.log('[GIF Debug] getGifVideoUrl: Converted (no version):', result);
            return result;
          }
        } else {
          console.warn('[GIF Debug] getGifVideoUrl: Could not match /image/upload/ pattern');
        }
      }
      
      console.log('[GIF Debug] getGifVideoUrl: No conversion possible, returning null');
      return null;
    } catch (e) {
      console.error('[GIF Debug] getGifVideoUrl: Error converting GIF URL:', e, gifUrl);
      return null;
    }
  };
  
  // Force GIF reload when step changes (for mobile playback)
  useEffect(() => {
    if (!walkthrough) return;
    
    let retryTimeoutId = null;
    
    // Wait for DOM to update and animations to complete
    const timeoutId = setTimeout(() => {
      // Find all GIF images and force them to reload
      const gifImages = document.querySelectorAll('img[data-gif-src]');
      
      if (gifImages.length === 0) {
        // If no images found, try again after a longer delay (for AnimatePresence)
        retryTimeoutId = setTimeout(() => {
          const retryImages = document.querySelectorAll('img[data-gif-src]');
          retryImages.forEach((img) => {
            const originalSrc = img.dataset.gifSrc;
            if (originalSrc && isGif(originalSrc)) {
              // Force reload by changing src with cache buster
              const separator = originalSrc.includes('?') ? '&' : '?';
              const reloadSrc = `${originalSrc}${separator}_reload=${Date.now()}`;
              img.src = reloadSrc;
              
              // Reset to original after animation starts (this restarts the GIF)
              setTimeout(() => {
                if (img && img.dataset.gifSrc === originalSrc) {
                  img.src = originalSrc;
                }
              }, 100);
            }
          });
        }, 300);
      }
      
      gifImages.forEach((img) => {
        const originalSrc = img.dataset.gifSrc;
        if (originalSrc && isGif(originalSrc)) {
          // Force reload by changing src with cache buster
          const separator = originalSrc.includes('?') ? '&' : '?';
          const reloadSrc = `${originalSrc}${separator}_reload=${Date.now()}`;
          img.src = reloadSrc;
          
          // Reset to original after animation starts (this restarts the GIF)
          setTimeout(() => {
            if (img && img.dataset.gifSrc === originalSrc) {
              img.src = originalSrc;
            }
          }, 100);
        }
      });
    }, 250);
    
    return () => {
      clearTimeout(timeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [currentStep, walkthrough]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
    fetchWalkthrough();
  }, [slug, walkthroughId]);

  useEffect(() => {
    if (walkthrough) {
      trackEvent('view');
      trackEvent('start');
    }
  }, [walkthrough]);

  useEffect(() => {
    if (walkthrough && currentStep >= 0) {
      trackEvent('step_view', walkthrough.steps[currentStep]?.id);
    }
  }, [currentStep]);

  // Send height to parent if in iframe (for auto-height)
  useEffect(() => {
    if (inIframe) {
      const sendHeight = () => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage({
          type: 'interguide-height',
          slug: slug,
          height: height
        }, '*');
      };
      sendHeight();
      window.addEventListener('resize', sendHeight);
      return () => window.removeEventListener('resize', sendHeight);
    }
  }, [inIframe, slug, walkthrough, currentStep]);

  const fetchWalkthrough = async () => {
    try {
      const response = await axios.get(`${API}/portal/${slug}/walkthroughs/${walkthroughId}`);
      setWalkthrough(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        setShowPasswordDialog(true);
      } else {
        toast.error(t('toast.walkthroughNotFound'));
      }
    } finally {
      setLoading(false);
    }
  };

  const submitPortalPassword = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/portal/${slug}/walkthroughs/${walkthroughId}/access`, {
        password: portalPassword
      });
      setWalkthrough(response.data);
      setShowPasswordDialog(false);
      setPortalPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('toast.invalidPassword'));
    }
  };

  const trackEvent = async (eventType, stepId = null) => {
    try {
      await axios.post(`${API}/analytics/event`, {
        walkthrough_id: walkthroughId,
        event_type: eventType,
        step_id: stepId,
        session_id: sessionId
      });
    } catch (error) {
      console.error('Failed to track event');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setShowAuthDialog(false);
      toast.success(t('toast.welcomeBack'));
    } catch (error) {
      toast.error(t('toast.loginFailed'));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/signup`, { email, password, name });
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setShowAuthDialog(false);
      toast.success(t('toast.accountCreatedShort'));
    } catch (error) {
      toast.error(t('toast.signupFailed'));
    }
  };

  const isStepCheckoffRequired = () => {
    const st = walkthrough?.steps?.[currentStep];
    return st?.navigation_type === 'checkoff';
  };

  const canProceedNext = () => {
    if (!walkthrough) return false;
    if (!isStepCheckoffRequired()) return true;
    const stepObj = walkthrough.steps?.[currentStep];
    if (!stepObj?.id) return true;
    return checkoffSteps.has(stepObj.id);
  };

  const handleNext = () => {
    if (!canProceedNext()) return;
    if (currentStep < walkthrough.steps.length - 1) {
      const currentStepObj = walkthrough.steps[currentStep];
      if (currentStepObj) {
        trackEvent('step_complete', currentStepObj.id);
        setCompletedSteps(new Set([...completedSteps, currentStep]));
      }
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    trackEvent('complete');
    setShowFeedback(true);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating) {
      toast.error(t('toast.ratingRequired'));
      return;
    }

    try {
      await axios.post(`${API}/feedback`, {
        walkthrough_id: walkthroughId,
        rating: feedbackRating,
        comment: feedbackComment
      });
      toast.success(t('toast.feedbackSubmitted'));
      // Go back to the portal home (company panel) after completion
      navigate(`/portal/${slug}`);
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!walkthrough) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-slate-900 mb-2">Walkthrough Not Found</h1>
          <p className="text-slate-600">The walkthrough you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / walkthrough.steps.length) * 100;
  const step = walkthrough.steps[currentStep];

  return (
    <div className={`min-h-screen bg-white ${inIframe ? 'iframe-mode' : ''}`}>
      {/* Header - Hide in iframe mode */}
      {!inIframe && (
      <header className="glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/portal/${slug}`}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                data-testid="back-to-portal-link"
              >
                ← Back to portal
              </Link>
              <div className="h-4 w-px bg-slate-200" />
              <h1 className="text-xl font-heading font-bold text-slate-900 truncate">{walkthrough.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdminDialogOpen(true)}
                  data-testid="back-to-dashboard-link"
                >
                  Admin Dashboard
                </Button>
              )}

              {!isLoggedIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuthDialog(true)}
                data-testid="auth-button"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Progress value={progress} className="flex-1" data-testid="walkthrough-progress" />
            <span className="text-sm text-slate-600 whitespace-nowrap">
              Step {currentStep + 1} of {walkthrough.steps.length}
            </span>
          </div>
        </div>
      </header>
      )}

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!showFeedback ? (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass rounded-2xl p-8"
            >
              <h2 className="text-3xl font-heading font-bold text-slate-900 mb-6 text-center" data-testid="step-title">
                {step?.title}
              </h2>
              
              {/* Media Display (Legacy) */}
              {step?.media_url && (
                <div className="mb-6">
                  {step.media_type === 'image' && (() => {
                    // Enhanced mobile detection - check multiple methods
                    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
                    const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
                    const isMobileScreen = window.innerWidth <= 768 || (window.screen && window.screen.width <= 768);
                    const isMobile = isMobileUA || isMobileScreen;
                    
                    const isVideoUrl = isCloudinaryVideo(step.media_url);
                    // Check if it's a GIF (pass media_type to help detect re-uploaded GIFs)
                    const isGifFile = isGif(step.media_url, step.media_type);
                    
                    console.log('[GIF Debug] Legacy Media Render:', {
                      url: step.media_url,
                      mediaType: step.media_type,
                      isMobileUA,
                      isMobileScreen,
                      isMobile,
                      isVideoUrl,
                      isGifFile,
                      userAgent: userAgent.substring(0, 50)
                    });
                    
                    // Render as video if:
                    // 1. It's a Cloudinary video URL with media_type='image' (re-uploaded GIFs) - ALWAYS render as video on ALL devices
                    // 2. It's a GIF and we're on mobile (use converted URL for old GIFs)
                    const shouldRenderAsVideo = (isVideoUrl && step.media_type === 'image') || (isGifFile && isMobile);
                    let gifVideoUrl = null;
                    if (shouldRenderAsVideo) {
                      if (isVideoUrl && step.media_type === 'image') {
                        gifVideoUrl = step.media_url; // Re-uploaded GIF: use video URL directly
                      } else if (isGifFile) {
                        // Old GIF: try to convert URL
                        gifVideoUrl = getGifVideoUrl(step.media_url, step.media_type);
                        if (!gifVideoUrl) {
                          console.warn('[GIF Debug] Legacy: URL conversion failed, but will still try to render as video on mobile');
                          // On mobile, even if conversion fails, try the original URL as video
                          // (some browsers might handle it, or we'll get an error and fallback)
                          gifVideoUrl = step.media_url;
                        }
                      }
                    }
                    
                    console.log('[GIF Debug] Legacy Media Decision:', {
                      shouldRenderAsVideo,
                      gifVideoUrl,
                      finalUrl: gifVideoUrl ? optimizeCloudinaryUrl(gifVideoUrl, true) : null,
                      reason: isVideoUrl ? 'video-url' : (isGifFile && isMobile ? 'gif-mobile' : 'not-video')
                    });
                    
                    if (gifVideoUrl && shouldRenderAsVideo) {
                      const optimizedVideoUrl = optimizeCloudinaryUrl(gifVideoUrl, true);
                      console.log('[GIF Debug] Rendering as VIDEO:', {
                        original: step.media_url,
                        videoUrl: gifVideoUrl,
                        optimized: optimizedVideoUrl
                      });
                      return (
                        <video
                          key={`legacy-video-${currentStep}-${step.media_url}`}
                          src={optimizedVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full max-h-[420px] object-contain rounded-lg shadow-soft bg-slate-50 cursor-zoom-in"
                          onClick={() => setImagePreviewUrl(step.media_url)}
                          onLoadStart={() => console.log('[GIF Debug] Video load started:', optimizedVideoUrl)}
                          onLoadedData={() => console.log('[GIF Debug] Video loaded successfully:', optimizedVideoUrl)}
                          onError={(e) => {
                            console.error('[GIF Debug] Video failed to load:', {
                              error: e,
                              src: optimizedVideoUrl,
                              original: step.media_url,
                              videoElement: e.target
                            });
                            // Fallback: try to show as image
                            const img = document.createElement('img');
                            img.src = step.media_url;
                            img.className = e.target.className;
                            img.onclick = () => setImagePreviewUrl(step.media_url);
                            e.target.parentNode.replaceChild(img, e.target);
                          }}
                        />
                      );
                    }
                    
                    // Regular image for non-GIFs or desktop non-video GIFs
                    const optimizedImageUrl = isCloudinary(step.media_url) 
                      ? optimizeCloudinaryUrl(step.media_url, false)
                      : step.media_url;
                    
                    return (
                      <img 
                        data-gif-src={isGifFile ? step.media_url : undefined}
                        src={optimizedImageUrl} 
                        alt={step.title} 
                        className="w-full max-h-[420px] object-contain rounded-lg shadow-soft bg-slate-50 cursor-zoom-in"
                        onClick={() => setImagePreviewUrl(step.media_url)}
                        loading="eager"
                        decoding="async"
                        key={`legacy-${currentStep}-${step.media_url}`}
                        style={isGifFile ? {
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
                      className="max-w-full rounded-lg shadow-soft"
                    />
                  )}
                  {step.media_type === 'youtube' && (
                    <div className="aspect-video">
                      <iframe
                        src={step.media_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        className="w-full h-full rounded-lg shadow-soft"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Blocks Display (New) */}
              {step?.blocks && step.blocks.length > 0 && (
                <div className="space-y-6 mb-8">
                  {step.blocks.map((block, idx) => (
                    <div key={block.id || idx}>
                      {block.type === 'heading' && (
                        <h3 
                          className={`font-heading font-bold text-slate-900 ${
                            block.data?.level === 1 ? 'text-3xl' :
                            block.data?.level === 2 ? 'text-2xl' : 'text-xl'
                          }`}
                          dangerouslySetInnerHTML={{ __html: block.data?.content || '' }}
                        />
                      )}
                      {block.type === 'text' && (
                        <div 
                          className="prose max-w-none text-slate-700"
                          dangerouslySetInnerHTML={{ __html: block.data?.content }}
                        />
                      )}
                      {block.type === 'image' && (() => {
                        // Check if URL exists, if not show placeholder
                        if (!block.data?.url) {
                          console.warn('[GIF Debug] Block image missing URL:', { blockId: block.id, block });
                          return (
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
                              <p className="text-sm text-slate-500">Image URL missing</p>
                            </div>
                          );
                        }
                        
                        const imageUrl = block.data.url;
                        // Enhanced mobile detection - check multiple methods
                        const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
                        const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
                        const isMobileScreen = window.innerWidth <= 768 || (window.screen && window.screen.width <= 768);
                        const isMobile = isMobileUA || isMobileScreen;
                        
                        const isGifFile = isGif(imageUrl, 'image'); // Assume image type for blocks
                        const isVideoUrl = isCloudinaryVideo(imageUrl);
                        
                        console.log('[GIF Debug] Block Image Render:', {
                          blockId: block.id,
                          url: imageUrl,
                          isMobileUA,
                          isMobileScreen,
                          isMobile,
                          isVideoUrl,
                          isGifFile,
                          userAgent: userAgent.substring(0, 50)
                        });
                        
                        // Render as video if:
                        // 1. It's a Cloudinary video URL in an image block (re-uploaded GIFs) - ALWAYS render as video on ALL devices
                        // 2. It's a GIF and we're on mobile (use converted URL for old GIFs)
                        const shouldRenderAsVideo = isVideoUrl || (isGifFile && isMobile);
                        let gifVideoUrl = null;
                        if (shouldRenderAsVideo) {
                          if (isVideoUrl) {
                            gifVideoUrl = imageUrl; // Re-uploaded GIF: use video URL directly
                          } else if (isGifFile) {
                            // Old GIF: try to convert URL
                            gifVideoUrl = getGifVideoUrl(imageUrl, 'image');
                            if (!gifVideoUrl) {
                              console.warn('[GIF Debug] Block: URL conversion failed, but will still try to render as video on mobile');
                              // On mobile, even if conversion fails, try the original URL as video
                              // (some browsers might handle it, or we'll get an error and fallback)
                              gifVideoUrl = imageUrl;
                            }
                          }
                        }
                        
                        console.log('[GIF Debug] Block Image Decision:', {
                          blockId: block.id,
                          shouldRenderAsVideo,
                          gifVideoUrl,
                          finalUrl: gifVideoUrl ? optimizeCloudinaryUrl(gifVideoUrl, true) : null,
                          reason: isVideoUrl ? 'video-url' : (isGifFile && isMobile ? 'gif-mobile' : 'not-video')
                        });
                        
                        if (gifVideoUrl && shouldRenderAsVideo) {
                          const optimizedVideoUrl = optimizeCloudinaryUrl(gifVideoUrl, true);
                          console.log('[GIF Debug] Block rendering as VIDEO:', {
                            blockId: block.id,
                            original: imageUrl,
                            videoUrl: gifVideoUrl,
                            optimized: optimizedVideoUrl
                          });
                          return (
                            <figure>
                              <video
                                key={`block-video-${block.id || idx}-${imageUrl}-${currentStep}`}
                                src={optimizedVideoUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full max-h-[420px] object-contain rounded-xl shadow-sm bg-gray-50/50 cursor-zoom-in"
                                onClick={() => setImagePreviewUrl(imageUrl)}
                                onLoadStart={() => console.log('[GIF Debug] Block video load started:', optimizedVideoUrl)}
                                onLoadedData={() => console.log('[GIF Debug] Block video loaded successfully:', optimizedVideoUrl)}
                                onError={(e) => {
                                  console.error('[GIF Debug] Block video failed to load:', {
                                    blockId: block.id,
                                    error: e,
                                    src: optimizedVideoUrl,
                                    original: imageUrl,
                                    videoElement: e.target
                                  });
                                  const img = document.createElement('img');
                                  img.src = imageUrl;
                                  img.className = e.target.className;
                                  img.onclick = () => setImagePreviewUrl(imageUrl);
                                  e.target.parentNode.replaceChild(img, e.target);
                                }}
                              />
                              {block.data?.caption && (
                                <figcaption className="text-sm text-slate-500 mt-2 text-center">
                                  {block.data.caption}
                                </figcaption>
                              )}
                            </figure>
                          );
                        }
                        
                        // Regular image for non-GIFs or desktop non-video GIFs
                        const optimizedImageUrl = isCloudinary(imageUrl) 
                          ? optimizeCloudinaryUrl(imageUrl, false)
                          : imageUrl;
                        
                        return (
                          <figure>
                            <img
                              data-gif-src={isGifFile ? imageUrl : undefined}
                              src={optimizedImageUrl} 
                              alt={block.data?.alt || ''} 
                              className="w-full max-h-[420px] object-contain rounded-xl shadow-sm bg-gray-50/50 cursor-zoom-in"
                              onClick={() => setImagePreviewUrl(imageUrl)}
                              loading="eager"
                              decoding="async"
                              key={`block-${block.id || idx}-${imageUrl}-${currentStep}`}
                              style={isGifFile ? {
                                imageRendering: 'auto',
                                WebkitBackfaceVisibility: 'visible',
                                backfaceVisibility: 'visible',
                                transform: 'translateZ(0)',
                                willChange: 'auto'
                              } : {}}
                            />
                            {block.data?.caption && (
                              <figcaption className="text-sm text-slate-500 mt-2 text-center">
                                {block.data.caption}
                              </figcaption>
                            )}
                          </figure>
                        );
                      })()}
                      {block.type === 'video' && block.data?.url && (
                        <div>
                          {block.data.type === 'youtube' ? (
                            <div className="aspect-video">
                              <iframe
                                src={block.data.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                className="w-full h-full rounded-lg shadow-soft"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <video 
                              src={isCloudinary(block.data.url) ? optimizeCloudinaryUrl(block.data.url, true) : block.data.url} 
                              controls 
                              className="max-w-full rounded-lg shadow-soft"
                            />
                          )}
                        </div>
                      )}
                      {block.type === 'file' && block.data?.url && (
                        <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50">
                          <div>
                            <div className="font-medium text-slate-900">{block.data.name}</div>
                            <div className="text-sm text-slate-500">
                              {block.data.size ? `${(block.data.size / 1024).toFixed(2)} KB` : 'File'}
                            </div>
                          </div>
                          <a 
                            href={block.data.url} 
                            download 
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            Download
                          </a>
                        </div>
                      )}
                      {block.type === 'button' && (
                        <div className="flex">
                          <Button 
                            variant={block.data?.style === 'secondary' ? 'outline' : 'default'}
                            className="rounded-full"
                            onClick={() => {
                              if (block.data?.action === 'link' && block.data?.url) {
                                window.open(block.data.url, '_blank');
                              } else if (block.data?.action === 'next') {
                                handleNext();
                              }
                            }}
                            disabled={block.data?.action === 'next' && !canProceedNext()}
                          >
                            {block.data?.text || 'Button'}
                          </Button>
                        </div>
                      )}
                      {block.type === 'divider' && (
                        <hr className="border-slate-200" />
                      )}
                      {block.type === 'spacer' && (
                        <div style={{ height: block.data?.height || 32 }} />
                      )}
                      {block.type === 'problem' && (
                        <div className="border-l-4 border-warning/40 bg-warning/15 backdrop-blur-sm p-4 rounded-xl shadow-[0_2px_8px_rgba(90,200,250,0.15)] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none">
                          <h4 
                            className="font-semibold text-gray-900 mb-1 relative z-10"
                            dangerouslySetInnerHTML={{ __html: block.data?.title || '' }}
                          />
                          <div 
                            className="text-gray-700 relative z-10 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: block.data?.explanation || '' }}
                          />
                        </div>
                      )}
                      {block.type === 'carousel' && block.data?.slides && block.data.slides.length > 0 && (
                        <CarouselViewer slides={block.data.slides} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy Content Display */}
              {step?.content && !step?.blocks?.length && (
                <div 
                  className="prose max-w-none mb-8 text-slate-700"
                  dangerouslySetInnerHTML={{ __html: step?.content }}
                  data-testid="step-content"
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                {isStepCheckoffRequired() && (
                  <button
                    type="button"
                    onClick={() => {
                      const stepObj = walkthrough.steps?.[currentStep];
                      if (!stepObj?.id) return;
                      const next = new Set(checkoffSteps);
                      next.add(stepObj.id);
                      setCheckoffSteps(next);
                    }}
                    className={`text-sm font-medium px-3 py-2 rounded-lg border ${
                      canProceedNext()
                        ? 'border-success text-success bg-success/5'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                    data-testid="checkoff-button"
                  >
                    {canProceedNext() ? 'Done' : 'Mark as done'}
                  </button>
                )}
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  data-testid="previous-button"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceedNext()}
                  data-testid="next-button"
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
          ) : (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-heading font-bold text-slate-900 mb-4">
                Walkthrough Complete!
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                How was your experience?
              </p>

              <div className="flex justify-center gap-4 mb-6">
                <button
                  onClick={() => setFeedbackRating('happy')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    feedbackRating === 'happy' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid="feedback-happy"
                >
                  <Smile className="w-8 h-8 text-primary" />
                </button>
                <button
                  onClick={() => setFeedbackRating('neutral')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    feedbackRating === 'neutral' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid="feedback-neutral"
                >
                  <Meh className="w-8 h-8 text-slate-600" />
                </button>
                <button
                  onClick={() => setFeedbackRating('unhappy')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    feedbackRating === 'unhappy' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid="feedback-unhappy"
                >
                  <Frown className="w-8 h-8 text-destructive" />
                </button>
              </div>

              <Textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Any additional comments? (optional)"
                rows={4}
                className="mb-6"
                data-testid="feedback-comment"
              />

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/portal/${slug}`)}
                  data-testid="skip-feedback-button"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleFeedbackSubmit}
                  data-testid="submit-feedback-button"
                >
                  Submit Feedback
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to track your progress</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" className="w-full">Login</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" className="w-full">Create Account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password required</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPortalPassword} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="portal-password">Password</Label>
              <Input
                id="portal-password"
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Unlock</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/portal/${slug}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => !open && setImagePreviewUrl(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          {imagePreviewUrl && (
            <div className="w-full">
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="w-full max-h-[80vh] object-contain rounded-lg bg-slate-50"
                loading="eager"
                decoding="async"
                key={imagePreviewUrl}
              />
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => setImagePreviewUrl(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Dashboard Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Dashboard</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              You are currently viewing the walkthrough. Would you like to go to the Admin Dashboard to manage your workspace?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setAdminDialogOpen(false)}
              >
                Stay Here
              </Button>
              <Button
                onClick={() => {
                  setAdminDialogOpen(false);
                  navigate('/dashboard');
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Carousel Viewer Component (for end users)
const CarouselViewer = ({ slides }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Helper functions (defined in parent component scope)
  const isCloudinary = (url) => url && url.includes('res.cloudinary.com');
  
  const optimizeCloudinaryUrl = (url, isVideo = false) => {
    if (!isCloudinary(url)) return url;
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const hasVersion = /\/v\d+\//.test(path);
      const hasTransformations = path.match(/\/[a-z_]+:/);
      
      if (hasTransformations) return url;
      
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
      return url;
    }
  };

  const normalizeImageUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const rawBase = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
    const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
    if (url.startsWith('/api/') || url.startsWith('/media/')) {
      return `${API_BASE.replace(/\/$/, '')}${url}`;
    }
    if (url.startsWith('/')) {
      return `${API_BASE.replace(/\/$/, '')}${url}`;
    }
    return url;
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }
    if (isRightSwipe) {
      setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  if (!slides || slides.length === 0) return null;

  const currentSlide = slides[currentIndex];
  const imageUrl = currentSlide?.url ? normalizeImageUrl(currentSlide.url) : null;

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-lg transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-lg transition-all"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </>
        )}

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {imageUrl ? (
              <>
                {currentSlide.media_type === 'video' ? (
                  <video
                    src={isCloudinary(imageUrl) ? optimizeCloudinaryUrl(imageUrl, true) : imageUrl}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay={false}
                  />
                ) : (
                  <img
                    src={isCloudinary(imageUrl) ? optimizeCloudinaryUrl(imageUrl, false) : imageUrl}
                    alt={`Slide ${currentIndex + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <p className="text-sm">No media for this slide</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Dots Indicator */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-6' : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Caption below image */}
      {currentSlide.caption && (
        <div className="px-2">
          <div 
            className="prose prose-sm max-w-none bg-transparent text-slate-700 rounded-lg px-4 py-3"
            dangerouslySetInnerHTML={{ __html: currentSlide.caption }}
          />
        </div>
      )}
    </div>
  );
};

export default WalkthroughViewerPage;
