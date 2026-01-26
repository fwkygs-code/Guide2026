import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

const EmailVerificationRequiredPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is verified
    if (user) {
      if (user.email_verified) {
        // User is verified, redirect to dashboard
        navigate('/dashboard');
      } else {
        setChecking(false);
      }
    }
  }, [user, navigate]);

  // Show loading while checking
  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleResend = async () => {
    setResending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to send verification email';
      toast.error(errorMsg);
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-900 p-6">
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <CardTitle>Email Verification Required</CardTitle>
          <CardDescription>
            Please verify your email address to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 mb-3">
              We've sent a verification email to <strong>{user.email}</strong>. 
              Please check your inbox and click the verification link.
            </p>
            <p className="text-xs text-blue-700">
              Don't see the email? Check your spam folder or click the button below to resend.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Log Out
            </Button>
          </div>

          {/* Support Contact */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              For support / bug report contact:{' '}
              <a 
                href="mailto:support@interguide.app" 
                className="text-primary hover:text-primary/80 font-medium underline"
              >
                support@interguide.app
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationRequiredPage;