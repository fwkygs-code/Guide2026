import React, { useState, useEffect } from 'react';
import { Bell, Check, X, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const NotificationsMenu = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const response = await api.getNotifications();
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleAcceptInvitation = async (notification, e) => {
    e.stopPropagation();
    if (!notification.metadata?.workspace_id || !notification.metadata?.invitation_id) {
      toast.error('Invalid invitation');
      return;
    }
    
    try {
      await api.acceptInvitation(notification.metadata.workspace_id, notification.metadata.invitation_id);
      toast.success('Invitation accepted!');
      // Remove notification and refresh
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      fetchNotifications();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to accept invitation';
      toast.error(errorMsg);
    }
  };

  const handleDeclineInvitation = async (notification, e) => {
    e.stopPropagation();
    if (!notification.metadata?.workspace_id || !notification.metadata?.invitation_id) {
      toast.error('Invalid invitation');
      return;
    }
    
    try {
      await api.declineInvitation(notification.metadata.workspace_id, notification.metadata.invitation_id);
      toast.success('Invitation declined');
      // Remove notification and refresh
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      fetchNotifications();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to decline invitation';
      toast.error(errorMsg);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Don't navigate if it's an invitation notification (user should use Accept/Decline buttons)
    if (notification.type === 'invite') {
      return;
    }
    
    if (!notification.is_read) {
      try {
        await api.markNotificationRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    
    // Navigate based on notification type
    if (notification.metadata?.workspace_id) {
      const workspaceId = notification.metadata.workspace_id;
      // Fetch workspace to get slug for navigation
      try {
        const workspaceResponse = await api.getWorkspace(workspaceId);
        const workspaceSlug = workspaceResponse.data.slug || workspaceId;
        navigate(`/workspace/${workspaceSlug}/settings`);
      } catch (error) {
        // Fallback to ID if slug fetch fails
        navigate(`/workspace/${workspaceId}/settings`);
      }
    } else {
      // For non-workspace notifications, go to dashboard
      navigate('/dashboard');
    }
    setOpen(false);
  };

  const formatNotificationTime = (createdAt) => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 ${notification.type === 'invite' ? '' : 'cursor-pointer'} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {formatNotificationTime(notification.created_at)}
                      </p>
                      {notification.type === 'invite' && notification.metadata?.workspace_id && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => handleAcceptInvitation(notification, e)}
                            className="h-7 text-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleDeclineInvitation(notification, e)}
                            className="h-7 text-xs"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                    {!notification.is_read && notification.type !== 'invite' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsMenu;
