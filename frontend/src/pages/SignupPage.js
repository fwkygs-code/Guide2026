import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTextSize } from '../contexts/TextSizeContext';
import { BookOpen, CheckCircle2, AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import PlanSelectionModal from '../components/PlanSelectionModal';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'ready', 'sleeping', 'error'
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const statusRef = useRef('checking');
  const { signup } = useAuth();
  const { getSizeClass } = useTextSize();
  const navigate = useNavigate();

  // Check backend status on mount (only once)
  useEffect(() => {
    let isMounted = true;
    let currentController = null;
    let intervalId = null;

    const checkBackend = async () => {
      if (!isMounted) return;
      
      // Cancel any existing request
      if (currentController) {
        currentController.abort();
      }
      
      statusRef.current = 'checking';
      setBackendStatus('checking');
      
      try {
        const rawBase = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
        const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
        
        console.log('[Health Check] Checking:', `${API_BASE}/health`);
        
        // Create abort controller for request cancellation
        currentController = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('[Health Check] Timeout after 5s, aborting...');
          currentController.abort();
        }, 5000);
        
        // Try /health first, then /api/health as fallback
        let response;
        let healthUrl = `${API_BASE}/health`;
        
        try {
          response = await axios.get(healthUrl, {
            timeout: 5000,
            signal: currentController.signal,
            validateStatus: (status) => status < 500 // Don't throw on 4xx
          });
          console.log('[Health Check] Response from /health:', response.status, response.data);
        } catch (err) {
          clearTimeout(timeoutId);
          
          if (currentController.signal.aborted || err.name === 'AbortError' || err.code === 'ECONNABORTED') {
            console.log('[Health Check] Request aborted/timed out');
            throw new Error('Request timeout');
          }
          
          // If /health fails with 404, try /api/health
          if (err.response?.status === 404) {
            console.log('[Health Check] /health returned 404, trying /api/health');
            healthUrl = `${API_BASE}/api/health`;
            currentController = new AbortController();
            const timeoutId2 = setTimeout(() => {
              console.log('[Health Check] Timeout on /api/health, aborting...');
              currentController.abort();
            }, 5000);
            
            try {
              response = await axios.get(healthUrl, {
                timeout: 5000,
                signal: currentController.signal,
                validateStatus: (status) => status < 500
              });
              console.log('[Health Check] Response from /api/health:', response.status, response.data);
            } catch (err2) {
              clearTimeout(timeoutId2);
              if (currentController.signal.aborted || err2.name === 'AbortError' || err2.code === 'ECONNABORTED') {
                throw new Error('Request timeout');
              }
              throw err2;
            } finally {
              clearTimeout(timeoutId2);
            }
          } else {
            console.log('[Health Check] Error:', err.message, err.response?.status);
            throw err;
          }
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!isMounted) return;
        
        // Check if we got a valid response
        if (response && response.data) {
          if (response.data.status === 'healthy') {
            console.log('[Health Check] Server is ready!');
            statusRef.current = 'ready';
            setBackendStatus('ready');
          } else {
            console.log('[Health Check] Unexpected status:', response.data);
            statusRef.current = 'error';
            setBackendStatus('error');
          }
        } else {
          console.log('[Health Check] No response data');
          statusRef.current = 'error';
          setBackendStatus('error');
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.log('[Health Check] Catch block - Error type:', error.name, 'Message:', error.message, 'Code:', error.code);
        
        // Server might be sleeping (Render free tier) or health endpoint not deployed yet
        if (error.code === 'ECONNABORTED' || 
            error.message.includes('timeout') || 
            error.message === 'Request timeout' || 
            error.name === 'AbortError' ||
            error.name === 'CanceledError' ||
            error.code === 'ERR_CANCELED' ||
            error.response?.status === 404 || 
            error.response?.status === 503 ||
            !error.response) { // Network error (no response)
          console.log('[Health Check] Server appears to be sleeping/unavailable');
          statusRef.current = 'sleeping';
          setBackendStatus('sleeping');
        } else {
          console.log('[Health Check] Other error, setting to error state');
          statusRef.current = 'error';
          setBackendStatus('error');
        }
      } finally {
        currentController = null;
      }
    };

    // Initial check
    checkBackend();
    
    // Re-check every 15 seconds if server is sleeping or error
    intervalId = setInterval(() => {
      if (isMounted && (statusRef.current === 'sleeping' || statusRef.current === 'error')) {
        checkBackend();
      }
    }, 15000);

    return () => {
      isMounted = false;
      if (currentController) {
        currentController.abort();
      }
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty dependency array - only run once on mount

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await signup(email, password, name);
      toast.success('Account created successfully!');
      
      // Show plan selection modal if plan selection is required
      if (result?.plan_selection_required) {
        setShowPlanSelection(true);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelected = (planName) => {
    // Plan has been selected, navigate to dashboard
    navigate('/dashboard');
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/auth-background.jpg), linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Dark overlay for better readability - ensures text is always readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/75 to-slate-900/85"></div>
      
      {/* Animated gradient overlay for depth and visual interest */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/10"></div>
      
      {/* Subtle animated particles effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className={`${getSizeClass('2xl')} font-heading font-bold text-white`}>InterGuide</span>
          </Link>
          <h1 className={`${getSizeClass('2xl')} font-heading font-bold text-white mb-2`}>Get Started</h1>
          <p className={`${getSizeClass('base')} text-slate-200`}>Create your account</p>
        </div>

        <div className="glass rounded-2xl p-8 backdrop-blur-xl bg-white/90 border border-white/20 shadow-2xl">
          {/* Backend Status Indicator */}
          <div className="mb-6 pb-4 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {backendStatus === 'checking' && (
                  <>
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    <span className="text-xs text-slate-500">Checking server...</span>
                  </>
                )}
                {backendStatus === 'ready' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-600">Server ready</span>
                  </>
                )}
                {backendStatus === 'sleeping' && (
                  <>
                    <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-xs text-amber-600">Initializing system...</span>
                  </>
                )}
                {backendStatus === 'error' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-600">Connection unavailable</span>
                  </>
                )}
              </div>
              {backendStatus === 'sleeping' && (
                <Badge variant="outline" className="text-xs">
                  Please wait
                </Badge>
              )}
            </div>
            {backendStatus === 'sleeping' && (
              <p className="text-xs text-slate-500 mt-2">
                The system is preparing your environment. This may take a moment.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                data-testid="signup-name-input"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                data-testid="signup-email-input"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                data-testid="signup-password-input"
                className="mt-1.5"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={loading || backendStatus === 'checking'}
              data-testid="signup-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {backendStatus === 'sleeping' ? 'Waking server...' : 'Creating account...'}
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors" data-testid="signup-login-link">
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        open={showPlanSelection}
        onOpenChange={setShowPlanSelection}
        onPlanSelected={handlePlanSelected}
        isSignup={true}
      />
    </div>
  );
};

export default SignupPage;