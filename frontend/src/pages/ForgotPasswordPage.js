import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import LanguageSwitcher from '../components/LanguageSwitcher';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSubmitted(true);
      toast.success('Reset email sent! Check your inbox.');
    } catch (error) {
      // Even if there's an error, show success for security (no user enumeration)
      setSubmitted(true);
      toast.success('If the email is registered, you\'ll receive a reset link shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/auth-background.jpg), linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        width: '100%',
        height: '100vh',
        minHeight: '100vh'
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/75 to-slate-900/85"></div>

      {/* Language Switcher */}
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
            <img
              src="/logo-main.png"
              alt="InterGuide"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <h1 className="text-2xl font-heading font-bold text-white mb-2">
            {submitted ? 'Check Your Email' : 'Forgot Password'}
          </h1>
          <p className="text-slate-200">
            {submitted
              ? 'We\'ve sent you a password reset link'
              : 'Enter your email address and we\'ll send you a reset link'
            }
          </p>
        </div>

        <div className="glass rounded-2xl p-8 backdrop-blur-xl bg-white/90 border border-white/20 shadow-2xl">
          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Email Sent!</h3>
              <p className="text-sm text-slate-600 mb-6">
                If the email address is registered with our service, you'll receive a password reset link shortly.
                Please check your inbox and spam folder.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="w-full"
                >
                  Send Another Email
                </Button>
                <Button asChild className="w-full rounded-full">
                  <Link to="/login">Back to Login</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-slate-900">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="mt-1.5 text-slate-900"
                    data-testid="forgot-password-email-input"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={loading || !email}
                  data-testid="forgot-password-submit-button"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Reset Email...
                    </span>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Reset Email
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline transition-colors"
                  data-testid="forgot-password-back-to-login"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;