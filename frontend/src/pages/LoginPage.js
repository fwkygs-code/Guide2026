import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTextSize } from '../contexts/TextSizeContext';
import { CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { INTERGUIDE_LOGIN_VIDEO_URL, INTERGUIDE_LOGO_ALT } from '../utils/logo';

const LoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'ready', 'sleeping', 'error'
  const statusRef = useRef('checking');
  const { login } = useAuth();
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
        let responseData = null;
        let healthUrl = `${API_BASE}/health`;
        
        try {
          response = await fetch(healthUrl, {
            signal: currentController.signal
          });
          responseData = await response.json().catch(() => null);
          console.log('[Health Check] Response from /health:', response.status, responseData);
        } catch (err) {
          clearTimeout(timeoutId);
          
          if (currentController.signal.aborted || err.name === 'AbortError' || err.code === 'ECONNABORTED') {
            console.log('[Health Check] Request aborted/timed out');
            throw new Error('Request timeout');
          }
          
          // If /health fails with 404, try /api/health
          if (response?.status === 404) {
            console.log('[Health Check] /health returned 404, trying /api/health');
            healthUrl = `${API_BASE}/api/health`;
            currentController = new AbortController();
            const timeoutId2 = setTimeout(() => {
              console.log('[Health Check] Timeout on /api/health, aborting...');
              currentController.abort();
            }, 5000);
            
            try {
              response = await fetch(healthUrl, {
                signal: currentController.signal
              });
              responseData = await response.json().catch(() => null);
              console.log('[Health Check] Response from /api/health:', response.status, responseData);
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
        if (response) {
          if (responseData?.status === 'healthy') {
            console.log('[Health Check] Server is ready!');
            statusRef.current = 'ready';
            setBackendStatus('ready');
          } else {
            console.log('[Health Check] Unexpected status:', responseData);
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
      await login(email, password);
      toast.success(t('toast.welcomeBack'));
      navigate('/dashboard', { replace: true });

    } catch (error) {
      // Show user-friendly error messages
      let errorMessage = error.response?.data?.detail || error.message || t('toast.loginFailed');
      
      // Map specific error messages to translations
      if (errorMessage === 'Invalid credentials') {
        errorMessage = t('toast.invalidCredentials');
      }
      
      // Provide helpful context for timeout errors
      if (errorMessage.includes('not responding') || errorMessage.includes('timeout')) {
        errorMessage += ' ' + t('toast.systemInitializing');
      }
      
      toast.error(errorMessage, {
        duration: 8000 // Show longer for important errors
      });
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
      data-auth-container
      style={{
        backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        width: '100%',
        height: '100vh',
        minHeight: '100vh'
      }}
    >
      {/* TEMP – mobile-only auth pages background test */}
      <style jsx>{`
        @media (max-width: 768px) {
          [data-auth-container] {
            background-color: #000 !important;
            background-image: none !important;
            min-height: 100vh;
          }
          [data-auth-container] > div.absolute.inset-0 {
            background: transparent !important;
            opacity: 0 !important;
          }
        }
      `}</style>
      {/* Dark overlay for better readability - ensures text is always readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/75 to-slate-900/85"></div>
      
      {/* Animated gradient overlay for depth and visual interest */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/10"></div>
      
      {/* Subtle animated particles effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="fixed top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <video
              src={INTERGUIDE_LOGIN_VIDEO_URL}
              alt={INTERGUIDE_LOGO_ALT}
              className="h-32 w-auto object-contain"
              autoPlay
              muted
              loop
              playsInline
            />
          </Link>
          <p className="text-lg font-medium text-foreground mb-2">InterGuide.app</p>
          <p className={`${getSizeClass('base')} text-muted-foreground`}>{t('auth.loginTitle')}</p>
        </div>

        <div className="glass rounded-2xl p-8 backdrop-blur-xl bg-white/90 border border-white/20 shadow-2xl">
          <div className="mb-6 pb-4 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {backendStatus === 'checking' && (
                  <>
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    <span className="text-xs text-muted-foreground">{t('auth.checkingServer')}</span>
                  </>
                )}
                {backendStatus === 'ready' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-600">{t('auth.serverReady')}</span>
                  </>
                )}
                {backendStatus === 'sleeping' && (
                  <>
                    <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-xs text-amber-600">{t('auth.initializingSystem')}</span>
                  </>
                )}
                {backendStatus === 'error' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-600">{t('auth.connectionUnavailable')}</span>
                  </>
                )}
              </div>
              {backendStatus === 'sleeping' && (
                <Badge variant="outline" className="text-xs">
                  {t('auth.pleaseWait')}
                </Badge>
              )}
            </div>
            {backendStatus === 'sleeping' && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('auth.systemPreparing')}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                data-testid="login-email-input"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                data-testid="login-password-input"
                className="mt-1.5"
              />
            </div>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                data-testid="login-forgot-password-link"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={loading || backendStatus === 'checking'}
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {backendStatus === 'sleeping' ? t('auth.wakingServer') : t('common.signingIn')}
                </span>
              ) : (
                t('common.login')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors" data-testid="login-signup-link">
              {t('auth.signUpHere')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;