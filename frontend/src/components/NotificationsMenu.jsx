import React, { useState, useEffect } from 'react';
import { Bell, Check, X, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const NotificationsMenu = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const response = await api.getNotifications();
      const fetchedNotifications = response.data || [];
      
      // Preserve local status updates for handled invitations
      setNotifications(prev => {
        const handledInvitations = new Map();
        prev.forEach(n => {
          if ((n.type === 'invite_accepted' || n.type === 'invite_declined') && n.metadata?.invitation_id) {
            handledInvitations.set(n.id, n);
          }
        });
        
        // Merge fetched notifications with handled invitations
        return fetchedNotifications.map(fetched => {
          const handled = handledInvitations.get(fetched.id);
          if (handled) {
            return handled; // Keep the handled status
          }
          return fetched;
        });
      });
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

  // Check for FORCED_DISCONNECT notifications and handle them
  useEffect(() => {
    const forcedDisconnect = notifications.find(n => n.type === 'forced_disconnect' && !n.is_read);
    if (forcedDisconnect) {
      // Mark as read immediately
      api.markNotificationRead(forcedDisconnect.id).catch(console.error);
      
      // Update notification state
      setNotifications(prev => prev.map(n => 
        n.id === forcedDisconnect.id ? { ...n, is_read: true } : n
      ));
      
      // Check if user is currently in a workspace
      const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)/);
      const workspaceId = forcedDisconnect.metadata?.workspace_id;
      
      // Release lock if we have workspace ID
      if (workspaceId) {
        api.unlockWorkspace(workspaceId).catch(console.error);
      }
      
      // Always redirect to dashboard when forced disconnect occurs
      // This ensures user is removed from workspace immediately
      navigate('/dashboard', { replace: true });
      
      // Show non-dismissible message (does not imply logout - user stays logged in)
      toast.error('Another user entered the workspace and your session was ended. You have been redirected to the dashboard.', {
        duration: 10000,
        important: true
      });
    }
  }, [notifications, location.pathname, navigate]);

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
      // Remove invitation notification immediately
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      // Refresh notifications to get the new confirmation notification
      await fetchNotifications();
      // Reload page to refresh workspace list and show new workspace
      setTimeout(() => {
        window.location.reload();
      }, 500); // Small delay to ensure notification is saved
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
      // Update notification to show declined status instead of removing
      setNotifications(prev => prev.map(n => 
        n.id === notification.id 
          ? { ...n, type: 'invite_declined', message: 'You have declined this invitation', is_read: true }
          : n
      ));
      await fetchNotifications();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to decline invitation';
      toast.error(errorMsg);
      
      // If invitation is already accepted/declined, update notification status
      if (errorMsg.includes('already been declined')) {
        setNotifications(prev => prev.map(n => 
          n.id === notification.id 
            ? { ...n, type: 'invite_declined', message: 'You have already declined this invitation', is_read: true }
            : n
        ));
        await fetchNotifications();
      } else if (errorMsg.includes('already been accepted') || errorMsg.includes('no longer pending')) {
        setNotifications(prev => prev.map(n => 
          n.id === notification.id 
            ? { ...n, type: 'invite_accepted', message: 'This invitation has already been accepted', is_read: true }
            : n
        ));
        await fetchNotifications();
      }
    }
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to delete notification';
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
        <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0 text-slate-200 hover:text-white">
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
                      {notification.type === 'invite_accepted' && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Accepted
                          </span>
                        </div>
                      )}
                      {notification.type === 'invite_declined' && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                            <XCircle className="w-3 h-3" />
                            Declined
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.is_read && notification.type !== 'invite' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-destructive"
                        onClick={(e) => handleDeleteNotification(notification.id, e)}
                        title="Delete notification"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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
