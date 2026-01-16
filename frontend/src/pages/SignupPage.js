import React, { useState, useEffect } from 'react';
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

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'ready', 'sleeping', 'error'
  const { signup } = useAuth();
  const { getSizeClass } = useTextSize();
  const navigate = useNavigate();

  // Check backend status on mount
  useEffect(() => {
    const checkBackend = async () => {
      setBackendStatus('checking');
      try {
        const rawBase = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
        const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
        
        const response = await axios.get(`${API_BASE}/health`, {
          timeout: 5000
        });
        
        if (response.data?.status === 'healthy') {
          setBackendStatus('ready');
        } else {
          setBackendStatus('error');
        }
      } catch (error) {
        // Server might be sleeping (Render free tier)
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          setBackendStatus('sleeping');
        } else {
          setBackendStatus('error');
        }
      }
    };

    checkBackend();
    // Re-check every 10 seconds if server is sleeping
    const interval = setInterval(() => {
      if (backendStatus === 'sleeping' || backendStatus === 'error') {
        checkBackend();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [backendStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await signup(email, password, name);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className={`${getSizeClass('2xl')} font-heading font-bold`}>InterGuide</span>
          </Link>
          <h1 className={`${getSizeClass('2xl')} font-heading font-bold text-slate-900 mb-2`}>Get Started</h1>
          <p className={`${getSizeClass('base')} text-slate-600`}>Create your account</p>
        </div>

        <div className="glass rounded-2xl p-8">
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
                    <span className="text-xs text-amber-600">Server waking up...</span>
                  </>
                )}
                {backendStatus === 'error' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-600">Server unavailable</span>
                  </>
                )}
              </div>
              {backendStatus === 'sleeping' && (
                <Badge variant="outline" className="text-xs">
                  Wait 30-60s
                </Badge>
              )}
            </div>
            {backendStatus === 'sleeping' && (
              <p className="text-xs text-slate-500 mt-2">
                Render free tier servers sleep after inactivity. The first request wakes them up (30-60 seconds).
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

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline" data-testid="signup-login-link">
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;