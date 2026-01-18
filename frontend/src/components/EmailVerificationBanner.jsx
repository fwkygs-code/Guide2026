import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Mail, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

const EmailVerificationBanner = ({ user, onVerify }) => {
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if user is verified or has active subscription
  if (!user || user.email_verified || dismissed) {
    return null;
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

  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50">
      <AlertCircle className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-900 font-semibold">
        Email Verification Required
      </AlertTitle>
      <AlertDescription className="text-blue-800 mt-2">
        <p className="mb-3">
          Please verify your email address to unlock Pro features and upgrade your plan. 
          Check your inbox for the verification email.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={resending}
            className="border-blue-300 text-blue-900 hover:bg-blue-100"
          >
            {resending ? (
              <>
                <Mail className="w-4 h-4 mr-2 animate-pulse" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Resend Email
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default EmailVerificationBanner;