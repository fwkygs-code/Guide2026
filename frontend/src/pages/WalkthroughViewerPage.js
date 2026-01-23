import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Check, X, Smile, Meh, Frown, LogIn, UserPlus, MessageCircle, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { detectRTL } from '../utils/blockUtils';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const API = `${API_BASE.replace(/\/$/, '')}/api`;

const WalkthroughViewerPage = ({ isEmbedded = false }) => {
  const { slug, walkthroughId } = useParams();
  const { t, i18n } = useTranslation();
  
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
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportContactInfo, setSupportContactInfo] = useState(null);
  
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
                          style={{ direction: detectRTL(block.data?.content) ? 'rtl' : 'ltr' }}
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
                      {block.type === 'button' && (() => {
                        const action = block.data?.action || 'next';
                        const buttonStyle = block.data?.style || 'primary';
                        
                        const getButtonVariant = () => {
                          if (buttonStyle === 'secondary') return 'outline';
                          if (buttonStyle === 'outline') return 'outline';
                          return 'default';
                        };
                        
                        const handleButtonClick = () => {
                          console.log('[Button Click]', { action, blockData: block.data });
                          
                          switch (action) {
                            case 'next':
                              handleNext();
                              break;
                              
                            case 'go_to_step':
                              if (block.data?.targetStepId) {
                                const targetIndex = walkthrough.steps.findIndex(s => s.id === block.data.targetStepId);
                                console.log('[Go to Step]', { targetStepId: block.data.targetStepId, targetIndex });
                                if (targetIndex !== -1) {
                                  setCurrentStep(targetIndex);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                } else {
                                  console.error('[Go to Step] Target step not found');
                                }
                              } else {
                                console.error('[Go to Step] No targetStepId configured');
                              }
                              break;
                              
                            case 'end':
                              console.log('[End Walkthrough]');
                              if (window.confirm('Are you sure you want to end this walkthrough?')) {
                                // Try to go back, or navigate to portal if no history
                                if (window.history.length > 1) {
                                  window.history.back();
                                } else {
                                  window.location.href = `/portal/${slug}`;
                                }
                              }
                              break;
                              
                            case 'restart':
                              console.log('[Restart Walkthrough]');
                              if (window.confirm('Restart walkthrough from the beginning?')) {
                                setCurrentStep(0);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                              break;
                              
                            case 'support':
                              console.log('[Get Support]', { 
                                usePortal: block.data?.usePortalContactInfo, 
                                workspaceWhatsapp: walkthrough?.workspace?.contact_whatsapp,
                                customWhatsapp: block.data?.supportWhatsapp,
                                customPhone: block.data?.supportPhone
                              });
                              
                              // Prepare contact info and show dialog
                              const contactInfo = {};
                              
                              if (block.data?.usePortalContactInfo !== false && walkthrough?.workspace) {
                                contactInfo.whatsapp = walkthrough.workspace.contact_whatsapp;
                                contactInfo.phone = walkthrough.workspace.contact_phone;
                                contactInfo.hours = walkthrough.workspace.contact_hours;
                              } else {
                                contactInfo.whatsapp = block.data?.supportWhatsapp;
                                contactInfo.phone = block.data?.supportPhone;
                                contactInfo.hours = block.data?.supportHours;
                              }
                              
                              if (!contactInfo.whatsapp && !contactInfo.phone) {
                                console.warn('[Get Support] No contact info configured');
                                alert('Support contact information not configured. Please contact the walkthrough creator.');
                              } else {
                                setSupportContactInfo(contactInfo);
                                setShowSupportDialog(true);
                              }
                              break;
                              
                            case 'link':
                              console.log('[External Link]', block.data?.url);
                              if (block.data?.url) {
                                window.open(block.data.url, '_blank');
                              }
                              break;
                              
                            case 'check':
                              console.log('[Checkpoint]');
                              // Checkpoint action - mark step as completed
                              setCompletedSteps(prev => new Set([...prev, currentStep]));
                              handleNext();
                              break;
                              
                            default:
                              console.log('[Default action] Moving to next');
                              handleNext();
                          }
                        };
                        
                        return (
                          <div className="flex">
                            <Button 
                              variant={getButtonVariant()}
                              className="rounded-full"
                              onClick={handleButtonClick}
                              disabled={action === 'next' && !canProceedNext()}
                            >
                              {block.data?.text || 'Button'}
                            </Button>
                          </div>
                        );
                      })()}
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
                      {block.type === 'checklist' && block.data?.items && block.data.items.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                          {block.data.items.map((item, itemIdx) => (
                            <label key={itemIdx} className="flex items-start gap-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                defaultChecked={false}
                              />
                              <span className="text-slate-700 flex-1">{item.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {block.type === 'callout' && (
                        <div className={`rounded-xl p-4 border-l-4 ${
                          block.data?.variant === 'warning' ? 'bg-amber-50 border-amber-500' :
                          block.data?.variant === 'important' ? 'bg-red-50 border-red-500' :
                          'bg-blue-50 border-blue-500'
                        }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">
                              {block.data?.variant === 'warning' ? '⚠️' :
                               block.data?.variant === 'important' ? '❗' : '💡'}
                            </span>
                            <div
                              className="prose prose-sm max-w-none text-slate-700"
                              dangerouslySetInnerHTML={{ __html: block.data?.content || block.data?.text || '' }}
                            />
                          </div>
                        </div>
                      )}
                      {block.type === 'annotated_image' && block.data?.url && (
                        <AnnotatedImageViewer block={block} />
                      )}
                      {block.type === 'embed' && block.data?.url && (() => {
                        // Transform URL based on provider
                        const getEmbedUrl = (url, provider) => {
                          if (!url) return '';
                          
                          try {
                            switch (provider) {
                              case 'youtube':
                                // Convert YouTube watch URLs to embed format
                                if (url.includes('youtube.com/watch')) {
                                  const videoId = url.split('v=')[1]?.split('&')[0];
                                  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                                } else if (url.includes('youtu.be/')) {
                                  const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                                  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                                } else if (url.includes('youtube.com/embed/')) {
                                  return url; // Already in embed format
                                }
                                return url;
                                
                              case 'vimeo':
                                // Convert Vimeo URLs to embed format
                                if (url.includes('vimeo.com/') && !url.includes('/video/')) {
                                  const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
                                  return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
                                }
                                return url;
                                
                              case 'loom':
                                // Loom share URLs to embed format
                                if (url.includes('loom.com/share/')) {
                                  const videoId = url.split('/share/')[1]?.split('?')[0];
                                  return videoId ? `https://www.loom.com/embed/${videoId}` : url;
                                }
                                return url;
                                
                              case 'figma':
                                // Figma URLs need embed parameter
                                if (url.includes('figma.com/') && !url.includes('embed')) {
                                  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
                                }
                                return url;
                                
                              case 'google_docs':
                                // Google Docs need /preview or /pub?embedded=true
                                if (url.includes('docs.google.com/document/')) {
                                  const docId = url.split('/d/')[1]?.split('/')[0];
                                  return docId ? `https://docs.google.com/document/d/${docId}/preview` : url;
                                } else if (url.includes('docs.google.com/presentation/')) {
                                  const docId = url.split('/d/')[1]?.split('/')[0];
                                  return docId ? `https://docs.google.com/presentation/d/${docId}/embed` : url;
                                } else if (url.includes('docs.google.com/spreadsheets/')) {
                                  const docId = url.split('/d/')[1]?.split('/')[0];
                                  return docId ? `https://docs.google.com/spreadsheets/d/${docId}/preview` : url;
                                }
                                return url;
                                
                              default:
                                return url;
                            }
                          } catch (error) {
                            console.error('Error transforming embed URL:', error);
                            return url;
                          }
                        };
                        
                        const embedUrl = getEmbedUrl(block.data.url, block.data?.provider || 'youtube');
                        
                        return (
                          <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden">
                            <iframe
                              src={embedUrl}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              loading="lazy"
                            />
                          </div>
                        );
                      })()}
                      {block.type === 'section' && (
                        <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50">
                          {block.data?.title && (
                            <h4 className="font-semibold text-lg text-slate-900 mb-3">
                              {block.data.title}
                            </h4>
                          )}
                          {block.data?.content && (
                            <div
                              className="prose prose-sm max-w-none text-slate-700"
                              dangerouslySetInnerHTML={{ __html: block.data.content }}
                            />
                          )}
                        </div>
                      )}
                      {block.type === 'confirmation' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 w-5 h-5 rounded border-primary/30 text-primary focus:ring-primary"
                          />
                          <div
                            className="prose prose-sm max-w-none text-slate-700 flex-1"
                            dangerouslySetInnerHTML={{ __html: block.data?.message || '' }}
                          />
                        </div>
                      )}
                      {block.type === 'external_link' && block.data?.url && (() => {
                        // Normalize URL to ensure it has a protocol
                        let normalizedUrl = block.data.url;
                        if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
                          normalizedUrl = `https://${normalizedUrl}`;
                        }
                        
                        return (
                          <a
                            href={normalizedUrl}
                            target={block.data?.newTab !== false ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                          >
                            {block.data?.text || 'Visit Link'}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        );
                      })()}
                      {block.type === 'code' && (
                        <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                            <span className="text-xs font-medium text-slate-400">
                              {block.data?.language || 'code'}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(block.data?.code || '');
                                toast.success('Copied to clipboard!');
                              }}
                              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="p-4 overflow-x-auto text-sm font-mono">
                            <code>{block.data?.code || ''}</code>
                          </pre>
                        </div>
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
                    {canProceedNext() ? t('common.done') : t('common.markAsDone')}
                  </button>
                )}
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  data-testid="previous-button"
                >
                  {i18n.language === 'he' ? (
                    <>
                      <ChevronRight className="w-4 h-4 ml-2" />
                      {t('common.previous')}
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      {t('common.previous')}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceedNext()}
                  data-testid="next-button"
                >
                  {currentStep === walkthrough.steps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t('common.complete')}
                    </>
                  ) : (
                    <>
                      {i18n.language === 'he' ? (
                        <>
                          {t('common.next')}
                          <ChevronLeft className="w-4 h-4 ml-2" />
                        </>
                      ) : (
                        <>
                          {t('common.next')}
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </>
                      )}
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

      {/* Support Contact Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {supportContactInfo?.whatsapp && (
              <Button
                variant="default"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => {
                  const number = supportContactInfo.whatsapp.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${number}`, '_blank');
                  setShowSupportDialog(false);
                }}
              >
                <MessageCircle className="w-5 h-5" />
                <div className="text-left flex-1">
                  <div className="font-semibold">WhatsApp</div>
                  <div className="text-sm opacity-90">{supportContactInfo.whatsapp}</div>
                </div>
              </Button>
            )}
            
            {supportContactInfo?.phone && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => {
                  window.open(`tel:${supportContactInfo.phone}`, '_self');
                  setShowSupportDialog(false);
                }}
              >
                <Phone className="w-5 h-5" />
                <div className="text-left flex-1">
                  <div className="font-semibold">Phone</div>
                  <div className="text-sm opacity-90">{supportContactInfo.phone}</div>
                </div>
              </Button>
            )}
            
            {supportContactInfo?.hours && (
              <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 rounded-lg">
                <Clock className="w-5 h-5 text-slate-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-slate-900">Working Hours</div>
                  <div className="text-sm text-slate-600">{supportContactInfo.hours}</div>
                </div>
              </div>
            )}
          </div>
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

// Annotated Image Viewer Component (for end users) - Supports dots (%) and rectangles
const AnnotatedImageViewer = ({ block }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const imageRef = useRef(null);
  const imageUrl = block.data?.url;
  const markers = block.data?.markers || [];
  const [imageDimensions, setImageDimensions] = useState({ width: 400, height: 300 }); // Default fallback

  // Get actual rendered image dimensions
  useEffect(() => {
    if (imageRef.current) {
      const updateDimensions = () => {
        if (imageRef.current) {
          setImageDimensions({
            width: imageRef.current.offsetWidth || imageRef.current.clientWidth || 400,
            height: imageRef.current.offsetHeight || imageRef.current.clientHeight || 300
          });
        }
      };

      // Update immediately and on resize
      updateDimensions();
      window.addEventListener('resize', updateDimensions);

      // Also update when image loads
      if (imageRef.current.complete) {
        updateDimensions();
      } else {
        imageRef.current.addEventListener('load', updateDimensions);
      }

      return () => {
        window.removeEventListener('resize', updateDimensions);
        if (imageRef.current) {
          imageRef.current.removeEventListener('load', updateDimensions);
        }
      };
    }
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <div
      className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50 select-none mx-auto"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        maxWidth: '400px',
        aspectRatio: '1/1' // Force square aspect ratio like builder
      }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt={block.data?.alt || 'Annotated image'}
        className="w-full h-full object-cover"
        draggable={false}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      />
      {markers.map((marker, idx) => {
        const markerShape = marker.shape || 'dot';



        // ALL shapes use consistent coordinate system - positions as % of rendered image
        const markerSize = marker.size || 30; // Circle diameter in pixels (fixed visual size)
        const markerWidth = marker.width || 10; // Rectangle width as percentage
        const markerHeight = marker.height || 10; // Rectangle height as percentage
        const arrowLength = marker.length || 80; // Arrow length in pixels (fixed visual size)
        const markerColor = marker.color || '#3b82f6';
        const isActive = selectedMarker === idx;

        if (markerShape === 'rectangle') {
          // Rectangle marker
          return (
            <div
              key={marker.id || idx}
              className="absolute"
              style={{
                position: 'absolute',
                left: `${marker.x}%`,
                top: `${marker.y}%`,
                width: `${markerWidth}%`,
                height: `${markerHeight}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`w-full h-full border-2 cursor-pointer transition-all select-none ${isActive ? 'shadow-lg ring-2' : 'shadow-md'}`}
                style={{
                  borderColor: markerColor,
                  backgroundColor: isActive ? `${markerColor}1a` : `${markerColor}0d`, // 10% and 5% opacity
                  ringColor: isActive ? `${markerColor}4d` : undefined, // 30% opacity ring
                  userSelect: 'none',
                  position: 'relative',
                }}
                onClick={() => setSelectedMarker(isActive ? null : idx)}
              >
                {/* Number badge positioned outside top-right corner like an exponent */}
                <span
                  className="absolute text-white rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
                  style={{
                    width: '18px',
                    height: '18px',
                    top: '-9px',
                    right: '-9px',
                    backgroundColor: markerColor,
                    fontSize: '10px'
                  }}
                >
                  {idx + 1}
                </span>
              </div>
              {isActive && (marker.title || marker.description) && (
                <div
                  className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px]"
                  style={{
                    left: '50%',
                    top: '0',
                    transform: 'translate(-50%, calc(-100% - 10px))',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {marker.title && (
                    <div className="font-semibold text-slate-900 mb-2">{marker.title}</div>
                  )}
                  {marker.description && (
                    <div className="text-sm text-slate-600">{marker.description}</div>
                  )}
                </div>
              )}
            </div>
          );
        }

        if (markerShape === 'arrow') {
          // Arrow marker - TIP points to exact click position
          const arrowRotation = marker.rotation || 0;

          return (
            <div key={marker.id || idx}>
              <div
                className="absolute cursor-pointer select-none"
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  transform: `rotate(${arrowRotation}rad)`, // No center translation - tip at click position
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onClick={() => setSelectedMarker(isActive ? null : idx)}
              >
                {/* Arrow shaft - extends leftward from tip */}
                <div
                  className={`absolute ${isActive ? 'shadow-lg' : 'shadow-md'}`}
                  style={{
                    left: '0',
                    top: '50%',
                    width: `${arrowLength - 8}px`, // Subtract arrowhead size
                    height: '2px',
                    transform: 'translateX(-100%) translateY(-50%)', // Extend left from tip
                    transformOrigin: 'right center', // Rotate from tip end
                    backgroundColor: markerColor
                  }}
                />

                {/* Arrowhead - positioned at tip (click position) */}
                <div
                  className={`absolute ${isActive ? 'shadow-lg' : 'shadow-md'}`}
                  style={{
                    left: '0',
                    top: '50%',
                    width: '0',
                    height: '0',
                    borderLeft: `8px solid ${markerColor}`,
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    transform: 'translateY(-50%)', // Center vertically at tip
                    transformOrigin: 'left center',
                  }}
                />

                {/* Number badge positioned above the tip (matching builder) */}
                <span
                  className="absolute text-white rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
                  style={{
                    width: '18px',
                    height: '18px',
                    left: '0',
                    top: '50%',
                    transform: 'translate(-50%, -50%) translateY(-20px)',
                    backgroundColor: markerColor,
                    fontSize: '10px',
                    zIndex: 10,
                  }}
                >
                  {idx + 1}
                </span>
              </div>
              {isActive && (marker.title || marker.description) && (
                <div
                  className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px]"
                  style={{
                    left: '0',
                    top: '50%',
                    transform: 'translate(-50%, calc(100% + 10px))', // Position below tip
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {marker.title && (
                    <div className="font-semibold text-slate-900 mb-2">{marker.title}</div>
                  )}
                  {marker.description && (
                    <div className="text-sm text-slate-600">{marker.description}</div>
                  )}
                </div>
              )}
            </div>
          );
        }

        if (markerShape === 'line') {
          // Line marker
          const startX = marker.x1 || marker.x || 0;
          const startY = marker.y1 || marker.y || 0;
          const endX = marker.x2 || marker.x || 10;
          const endY = marker.y2 || marker.y || 0;

          return (
            <div key={marker.id || idx}>
              <svg
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none'
                }}
              >
                {/* Main line */}
                <line
                  x1={`${startX}%`}
                  y1={`${startY}%`}
                  x2={`${endX}%`}
                  y2={`${endY}%`}
                  stroke={markerColor}
                  strokeWidth="3"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={() => setSelectedMarker(isActive ? null : idx)}
                />

                {/* Number badge at midpoint */}
                <circle
                  cx={`${(startX + endX) / 2}%`}
                  cy={`${(startY + endY) / 2 - 2}%`}
                  r="9"
                  fill={markerColor}
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={`${(startX + endX) / 2}%`}
                  y={`${(startY + endY) / 2 - 2}%`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {idx + 1}
                </text>
              </svg>
              {isActive && (marker.title || marker.description) && (
                <div
                  className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px]"
                  style={{
                    left: `${(startX + endX) / 2}%`,
                    top: `${(startY + endY) / 2}%`,
                    transform: 'translate(-50%, calc(-100% - 10px))',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {marker.title && (
                    <div className="font-semibold text-slate-900 mb-2">{marker.title}</div>
                  )}
                  {marker.description && (
                    <div className="text-sm text-slate-600">{marker.description}</div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // Dot marker - positioned relative to image dimensions
        return (
          <div
            key={marker.id || idx}
            className="absolute"
            style={{
              position: 'absolute',
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              transform: 'translate(-50%, -50%)',
              // Ensure markers are positioned relative to the image, not container
              pointerEvents: 'auto',
            }}
          >
            {/* Circle marker */}
            <div
              className={`absolute rounded-full cursor-pointer select-none transition-all ${
                isActive ? 'shadow-lg ring-2' : 'hover:shadow-md shadow-md'
              }`}
              style={{
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                border: `2px solid ${markerColor}`,
                backgroundColor: isActive ? `${markerColor}1a` : `${markerColor}0d`, // Match builder opacity
                ringColor: isActive ? `${markerColor}4d` : undefined, // 30% opacity ring
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onClick={() => setSelectedMarker(isActive ? null : idx)}
            />


            {/* Number badge positioned outside top-right corner like exponent */}
            <span
              className="absolute text-white rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
              style={{
                width: '18px',
                height: '18px',
                top: '-9px',
                right: '-9px',
                backgroundColor: markerColor,
                fontSize: '10px',
                zIndex: 10,
              }}
            >
              {idx + 1}
            </span>
            {isActive && (marker.title || marker.description) && (
              <div
                className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px]"
                style={{
                  left: '50%',
                  top: '0',
                  transform: 'translate(-50%, calc(-100% - 10px))',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {marker.title && (
                  <div className="font-semibold text-slate-900 mb-2">{marker.title}</div>
                )}
                {marker.description && (
                  <div className="text-sm text-slate-600">{marker.description}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
