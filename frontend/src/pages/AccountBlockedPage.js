import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldX, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AccountBlockedPage - Shown when user account is disabled or deleted
 */
const AccountBlockedPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear auth and redirect to login
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            {t('blocked.title', 'Account Disabled')}
          </h1>

          {/* Message */}
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('blocked.message', 'Your account has been disabled or deleted.')}
          </p>

          {/* Support Contact */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-2">
              <Mail className="w-4 h-4" />
              <span className="font-semibold">
                {t('blocked.contactSupport', 'Please contact support:')}
              </span>
            </div>
            <a
              href="mailto:support@interguide.app"
              className="text-primary hover:text-primary/80 font-medium text-lg"
            >
              support@interguide.app
            </a>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
          >
            {t('blocked.backToLogin', 'Back to Login')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountBlockedPage;
