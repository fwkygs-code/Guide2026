import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, LogOut, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';

const DashboardLayout = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')} data-testid="dashboard-logo">
            <BookOpen className="w-7 h-7 text-primary" />
            <span className="text-xl font-heading font-bold">InterGuide</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              data-testid="nav-home-button"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};

export default DashboardLayout;