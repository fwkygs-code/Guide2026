import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
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

const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('No verification token provided.');
    }
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await axios.get(`${API}/auth/verify-email`, {
        params: { token }
      });
      
      setStatus('success');
      setMessage(response.data.message || 'Email verified successfully!');
      
      // Refresh user data to get updated email_verified status
      if (refreshUser) {
        await refreshUser();
      }
      
      toast.success('Email verified successfully!');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.detail || 'Verification failed. The token may be invalid or expired.');
      toast.error('Email verification failed');
    }
  };

  const handleResend = async () => {
    if (!user) {
      toast.error('Please log in to resend verification email');
      navigate('/login');
      return;
    }

    setResending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      toast.success('Verification email sent! Please check your inbox.');
      setMessage('Verification email sent. Please check your inbox.');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to send verification email';
      toast.error(errorMsg);
      setMessage(errorMsg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-900 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <CardTitle>Verifying Email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>Your email has been successfully verified.</CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'error' && (
            <>
              <p className="text-sm text-slate-600 text-center">
                If your verification link has expired, you can request a new one.
              </p>
              {user ? (
                <Button onClick={handleResend} disabled={resending} className="w-full">
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
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => navigate('/login')} className="w-full">
                    Log In
                  </Button>
                  <Button onClick={() => navigate('/signup')} variant="outline" className="w-full">
                    Sign Up
                  </Button>
                </div>
              )}
            </>
          )}
          {status === 'success' && (
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;