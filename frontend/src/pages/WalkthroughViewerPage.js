import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

const API_BASE =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API = `${API_BASE.replace(/\/$/, '')}/api`;

const WalkthroughViewerPage = () => {
  const { slug, walkthroughId } = useParams();
  const [walkthrough, setWalkthrough] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
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

  const fetchWalkthrough = async () => {
    try {
      const response = await axios.get(`${API}/portal/${slug}/walkthroughs/${walkthroughId}`);
      setWalkthrough(response.data);
    } catch (error) {
      toast.error('Walkthrough not found');
    } finally {
      setLoading(false);
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
      toast.success('Welcome back!');
    } catch (error) {
      toast.error('Login failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/signup`, { email, password, name });
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setShowAuthDialog(false);
      toast.success('Account created!');
    } catch (error) {
      toast.error('Signup failed');
    }
  };

  const handleNext = () => {
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
      toast.error('Please select a rating');
      return;
    }

    try {
      await axios.post(`${API}/feedback`, {
        walkthrough_id: walkthroughId,
        rating: feedbackRating,
        comment: feedbackComment
      });
      toast.success('Thank you for your feedback!');
      setShowFeedback(false);
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!walkthrough) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-heading font-bold text-slate-900">{walkthrough.title}</h1>
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
          <div className="flex items-center gap-4">
            <Progress value={progress} className="flex-1" data-testid="walkthrough-progress" />
            <span className="text-sm text-slate-600 whitespace-nowrap">
              Step {currentStep + 1} of {walkthrough.steps.length}
            </span>
          </div>
        </div>
      </header>

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
              <h2 className="text-3xl font-heading font-bold text-slate-900 mb-6" data-testid="step-title">
                {step?.title}
              </h2>
              
              {/* Media Display (Legacy) */}
              {step?.media_url && (
                <div className="mb-6">
                  {step.media_type === 'image' && (
                    <img 
                      src={step.media_url} 
                      alt={step.title} 
                      className="max-w-full rounded-lg shadow-soft"
                    />
                  )}
                  {step.media_type === 'video' && (
                    <video 
                      src={step.media_url} 
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
                        <h3 className={`font-heading font-bold text-slate-900 ${
                          block.data?.level === 1 ? 'text-3xl' :
                          block.data?.level === 2 ? 'text-2xl' : 'text-xl'
                        }`}>
                          {block.data?.content}
                        </h3>
                      )}
                      {block.type === 'text' && (
                        <div 
                          className="prose max-w-none text-slate-700"
                          dangerouslySetInnerHTML={{ __html: block.data?.content }}
                        />
                      )}
                      {block.type === 'image' && block.data?.url && (
                        <figure>
                          <img 
                            src={block.data.url} 
                            alt={block.data?.alt || ''} 
                            className="max-w-full rounded-lg shadow-soft"
                          />
                          {block.data?.caption && (
                            <figcaption className="text-sm text-slate-500 mt-2 text-center">
                              {block.data.caption}
                            </figcaption>
                          )}
                        </figure>
                      )}
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
                              src={block.data.url} 
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
                        <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
                          <h4 className="font-semibold text-amber-900 mb-1">{block.data?.title}</h4>
                          <p className="text-amber-800">{block.data?.explanation}</p>
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
                  onClick={() => setShowFeedback(false)}
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
    </div>
  );
};

export default WalkthroughViewerPage;
