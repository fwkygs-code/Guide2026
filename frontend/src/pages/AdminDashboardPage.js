import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Database, BarChart3, Edit, Trash2, Crown, HardDrive, FileText, FolderOpen, Ban, CheckCircle, ArrowDown, ArrowUp, Clock, Settings, MoreVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';

const AdminDashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Users tab
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(50);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [membershipsDialogOpen, setMembershipsDialogOpen] = useState(false);
  const [userMemberships, setUserMemberships] = useState([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membershipsPage, setMembershipsPage] = useState(1);
  const [membershipsTotal, setMembershipsTotal] = useState(0);
  
  // Stats tab
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Edit user form
  const [editForm, setEditForm] = useState({
    role: 'owner',
    planName: 'free'
  });
  const [saving, setSaving] = useState(false);
  
  // Subscription form
  const [subscriptionForm, setSubscriptionForm] = useState({
    planName: 'pro',
    durationDays: null
  });
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  
  // Admin action states
  const [disablingUser, setDisablingUser] = useState(false);
  const [enablingUser, setEnablingUser] = useState(false);
  const [downgradingUser, setDowngradingUser] = useState(false);
  const [upgradingUser, setUpgradingUser] = useState(false);
  const [gracePeriodDialogOpen, setGracePeriodDialogOpen] = useState(false);
  const [gracePeriodForm, setGracePeriodForm] = useState({ gracePeriodEndsAt: '' });
  const [settingGracePeriod, setSettingGracePeriod] = useState(false);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaForm, setQuotaForm] = useState({ storageBytes: '', maxWorkspaces: '', maxWalkthroughs: '' });
  const [settingQuota, setSettingQuota] = useState(false);

  useEffect(() => {
    // Check if user is admin (role field from backend)
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
    fetchStats();
  }, [user, navigate]);

  useEffect(() => {
    fetchUsers();
  }, [usersPage, usersSearch]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.adminListUsers(usersPage, usersLimit, usersSearch || null);
      setUsers(response.data.users || []);
      setUsersTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      if (error.response?.status === 404) {
        toast.error('Admin endpoints not found. Server may need to restart.');
      } else if (error.response?.status === 403) {
        toast.error('Admin access required. Please contact support.');
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to load users');
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await api.adminGetStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      if (error.response?.status === 404) {
        toast.error('Admin endpoints not found. Server may need to restart.');
      } else if (error.response?.status === 403) {
        toast.error('Admin access required. Please contact support.');
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to load statistics');
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUserMemberships = async (userId, page = 1) => {
    try {
      setMembershipsLoading(true);
      const response = await api.adminGetUserMemberships(userId, page, 50);
      setUserMemberships(response.data.memberships || []);
      setMembershipsTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch memberships:', error);
      toast.error('Failed to load memberships');
    } finally {
      setMembershipsLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role || 'owner',
      planName: user.plan?.name || 'free'
    });
    setEditDialogOpen(true);
  };
  
  // Show current values before editing
  const getCurrentUserInfo = () => {
    if (!selectedUser) return null;
    return {
      email: selectedUser.email,
      name: selectedUser.name,
      role: selectedUser.role || 'owner',
      plan: selectedUser.plan?.display_name || 'Free',
      subscription: selectedUser.subscription?.status || 'None',
      disabled: selectedUser.disabled ? 'Yes' : 'No',
      deleted_at: selectedUser.deleted_at ? formatDateTime(selectedUser.deleted_at) : 'No',
      grace_period_ends_at: selectedUser.grace_period_ends_at ? formatDateTime(selectedUser.grace_period_ends_at) : 'None',
      custom_storage: selectedUser.custom_storage_bytes ? formatBytes(selectedUser.custom_storage_bytes) : 'None',
      custom_workspaces: selectedUser.custom_max_workspaces !== null && selectedUser.custom_max_workspaces !== undefined ? selectedUser.custom_max_workspaces : 'None',
      custom_walkthroughs: selectedUser.custom_max_walkthroughs !== null && selectedUser.custom_max_walkthroughs !== undefined ? selectedUser.custom_max_walkthroughs : 'None',
    };
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    try {
      setSaving(true);
      
      // Update role if changed
      if (editForm.role !== selectedUser.role) {
        await api.adminUpdateUserRole(selectedUser.id, editForm.role);
      }
      
      // Update plan if changed
      if (editForm.planName !== selectedUser.plan?.name) {
        await api.adminUpdateUserPlan(selectedUser.id, editForm.planName);
      }
      
      toast.success('User updated successfully');
      setEditDialogOpen(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to update user:', error);
      // Handle validation errors (422) - extract message from error response
      let errorMessage = 'Failed to update user';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation errors are arrays
          const firstError = error.response.data.detail[0];
          errorMessage = firstError?.msg || firstError?.loc?.join('. ') || errorMessage;
        } else if (error.response.data.detail?.msg) {
          errorMessage = error.response.data.detail.msg;
        }
      }
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!selectedUser) return;
    
    try {
      setCreatingSubscription(true);
      await api.adminCreateManualSubscription(
        selectedUser.id,
        subscriptionForm.planName,
        subscriptionForm.durationDays || null
      );
      toast.success('Subscription created successfully');
      setSubscriptionDialogOpen(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to create subscription:', error);
      // Handle validation errors (422) - extract message from error response
      let errorMessage = 'Failed to create subscription';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation errors are arrays
          const firstError = error.response.data.detail[0];
          errorMessage = firstError?.msg || firstError?.loc?.join('. ') || errorMessage;
        } else if (error.response.data.detail?.msg) {
          errorMessage = error.response.data.detail.msg;
        }
      }
      toast.error(errorMessage);
    } finally {
      setCreatingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedUser) return;
    
    try {
      setCancellingSubscription(true);
      await api.adminCancelSubscription(selectedUser.id);
      toast.success('Subscription cancelled successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      // Handle validation errors (422) - extract message from error response
      let errorMessage = 'Failed to cancel subscription';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation errors are arrays
          const firstError = error.response.data.detail[0];
          errorMessage = firstError?.msg || firstError?.loc?.join('. ') || errorMessage;
        } else if (error.response.data.detail?.msg) {
          errorMessage = error.response.data.detail.msg;
        }
      }
      toast.error(errorMessage);
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleDisableUser = async () => {
    if (!selectedUser) return;
    
    try {
      setDisablingUser(true);
      await api.adminDisableUser(selectedUser.id);
      toast.success('User disabled successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to disable user:', error);
      let errorMessage = 'Failed to disable user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setDisablingUser(false);
    }
  };

  const handleEnableUser = async () => {
    if (!selectedUser) return;
    
    try {
      setEnablingUser(true);
      await api.adminEnableUser(selectedUser.id);
      toast.success('User enabled successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to enable user:', error);
      let errorMessage = 'Failed to enable user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setEnablingUser(false);
    }
  };

  const handleDowngradeUser = async () => {
    if (!selectedUser) return;
    
    try {
      setDowngradingUser(true);
      await api.adminDowngradeUser(selectedUser.id);
      toast.success('User downgraded to Free plan successfully');
      fetchUsers();
      fetchStats();
      // Refresh memberships if dialog is open
      if (membershipsDialogOpen && selectedUser.id) {
        fetchUserMemberships(selectedUser.id, membershipsPage);
      }
    } catch (error) {
      console.error('Failed to downgrade user:', error);
      let errorMessage = 'Failed to downgrade user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setDowngradingUser(false);
    }
  };

  const handleUpgradeUser = async () => {
    if (!selectedUser) return;
    
    try {
      setUpgradingUser(true);
      await api.adminUpgradeUser(selectedUser.id);
      toast.success('User upgraded to Pro plan successfully');
      fetchUsers();
      fetchStats();
      // Refresh memberships if dialog is open
      if (membershipsDialogOpen && selectedUser.id) {
        fetchUserMemberships(selectedUser.id, membershipsPage);
      }
    } catch (error) {
      console.error('Failed to upgrade user:', error);
      let errorMessage = 'Failed to upgrade user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setUpgradingUser(false);
    }
  };

  const handleSetGracePeriod = async () => {
    if (!selectedUser) return;
    
    try {
      setSettingGracePeriod(true);
      const graceEndsAt = gracePeriodForm.gracePeriodEndsAt 
        ? new Date(gracePeriodForm.gracePeriodEndsAt).toISOString()
        : null;
      await api.adminSetGracePeriod(selectedUser.id, graceEndsAt);
      toast.success(graceEndsAt ? 'Grace period set successfully' : 'Grace period removed successfully');
      setGracePeriodDialogOpen(false);
      setGracePeriodForm({ gracePeriodEndsAt: '' });
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to set grace period:', error);
      let errorMessage = 'Failed to set grace period';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          const firstError = error.response.data.detail[0];
          errorMessage = firstError?.msg || firstError?.loc?.join('. ') || errorMessage;
        }
      }
      toast.error(errorMessage);
    } finally {
      setSettingGracePeriod(false);
    }
  };

  const handleSetCustomQuota = async () => {
    if (!selectedUser) return;
    
    try {
      setSettingQuota(true);
      const storageBytes = quotaForm.storageBytes ? parseInt(quotaForm.storageBytes) : null;
      const maxWorkspaces = quotaForm.maxWorkspaces ? parseInt(quotaForm.maxWorkspaces) : null;
      const maxWalkthroughs = quotaForm.maxWalkthroughs ? parseInt(quotaForm.maxWalkthroughs) : null;
      await api.adminSetCustomQuota(selectedUser.id, storageBytes, maxWorkspaces, maxWalkthroughs);
      toast.success('Custom quotas updated successfully');
      setQuotaDialogOpen(false);
      setQuotaForm({ storageBytes: '', maxWorkspaces: '', maxWalkthroughs: '' });
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to set custom quota:', error);
      let errorMessage = 'Failed to set custom quota';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          const firstError = error.response.data.detail[0];
          errorMessage = firstError?.msg || firstError?.loc?.join('. ') || errorMessage;
        }
      }
      toast.error(errorMessage);
    } finally {
      setSettingQuota(false);
    }
  };

  const handleSoftDeleteUser = async (userId) => {
    try {
      await api.adminSoftDeleteUser(userId);
      toast.success('User soft deleted successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to soft delete user:', error);
      let errorMessage = 'Failed to soft delete user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    }
  };

  const handleRestoreUser = async (userId) => {
    try {
      await api.adminRestoreUser(userId);
      toast.success('User restored successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Failed to restore user:', error);
      let errorMessage = 'Failed to restore user';
      if (error.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : errorMessage;
      }
      toast.error(errorMessage);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getEffectiveState = (user) => {
    if (user.disabled) return { label: 'Disabled', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    if (user.deleted_at) return { label: 'Deleted', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20' };
    
    const planName = user.plan?.name || 'free';
    const subscriptionStatus = user.subscription?.status;
    
    // Check grace period
    if (user.grace_period_ends_at) {
      const graceEnd = new Date(user.grace_period_ends_at);
      const now = new Date();
      if (graceEnd > now) {
        return { 
          label: `Grace (expires ${formatDate(user.grace_period_ends_at)})`, 
          color: 'text-orange-600 dark:text-orange-400', 
          bg: 'bg-orange-50 dark:bg-orange-900/20' 
        };
      } else {
        return { label: 'Grace Expired', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
      }
    }
    
    if (planName === 'pro' && subscriptionStatus === 'active') {
      return { label: 'Active (Pro)', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
    }
    if (planName === 'pro' && subscriptionStatus === 'expired') {
      return { label: 'Expired', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    }
    if (planName === 'free') {
      return { label: 'Free', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/20' };
    }
    
    return { label: 'Unknown', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/20' };
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage users, subscriptions, and system settings</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-slate-100">User Management</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">View and manage all users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by email or name..."
                      value={usersSearch}
                      onChange={(e) => {
                        setUsersSearch(e.target.value);
                        setUsersPage(1);
                      }}
                      className="w-full"
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400">Loading users...</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Email</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Name</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">State</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Role</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Plan</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Subscription</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Grace Period</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Storage</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Custom Quotas</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Created</th>
                            <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => {
                            const effectiveState = getEffectiveState(u);
                            return (
                            <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="p-2 text-slate-900 dark:text-slate-100">{u.email}</td>
                              <td className="p-2 text-slate-900 dark:text-slate-100">{u.name}</td>
                              <td className="p-2">
                                <Badge variant="outline" className={`${effectiveState.color} ${effectiveState.bg} border-current`}>
                                  {effectiveState.label}
                                </Badge>
                                {u.deleted_at && (
                                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Deleted: {formatDate(u.deleted_at)}
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                <Badge 
                                  variant={u.role === 'admin' ? 'outline' : 'secondary'}
                                  className={u.role === 'admin' ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400' : ''}
                                >
                                  {u.role || 'owner'}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Badge 
                                  variant={u.plan?.name === 'pro' ? 'outline' : 'outline'}
                                  className={u.plan?.name === 'pro' ? 'border-purple-500 text-purple-700 dark:text-purple-400' : 'border-slate-300 text-slate-600 dark:text-slate-400'}
                                >
                                  {u.plan?.display_name || 'Free'}
                                </Badge>
                              </td>
                              <td className="p-2">
                                {u.subscription ? (
                                  <Badge 
                                    variant={u.subscription.status === 'active' ? 'outline' : 'secondary'}
                                    className={u.subscription.status === 'active' ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
                                  >
                                    {u.subscription.status}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </td>
                              <td className="p-2 text-slate-700 dark:text-slate-300 text-sm">
                                {u.grace_period_ends_at ? (
                                  <div>
                                    <div>Until: {formatDate(u.grace_period_ends_at)}</div>
                                    {new Date(u.grace_period_ends_at) < new Date() && (
                                      <div className="text-xs text-red-600 dark:text-red-400">Expired</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </td>
                              <td className="p-2 text-slate-700 dark:text-slate-300">
                                <div>{formatBytes(u.storage_used || 0)}</div>
                                {u.custom_storage_bytes !== null && u.custom_storage_bytes !== undefined && (
                                  <div className="text-xs text-purple-600 dark:text-purple-400">
                                    Limit: {formatBytes(u.custom_storage_bytes)}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-slate-700 dark:text-slate-300 text-xs">
                                {(u.custom_max_workspaces !== null && u.custom_max_workspaces !== undefined) ||
                                 (u.custom_max_walkthroughs !== null && u.custom_max_walkthroughs !== undefined) ? (
                                  <div className="space-y-1">
                                    {u.custom_max_workspaces !== null && u.custom_max_workspaces !== undefined && (
                                      <div>Workspaces: {u.custom_max_workspaces}</div>
                                    )}
                                    {u.custom_max_walkthroughs !== null && u.custom_max_walkthroughs !== undefined && (
                                      <div>Walkthroughs: {u.custom_max_walkthroughs}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-400">{formatDate(u.created_at)}</td>
                              <td className="p-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    {/* Edit */}
                                    <DropdownMenuItem onClick={() => handleEditUser(u)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit User
                                    </DropdownMenuItem>
                                    
                                    {/* View Memberships */}
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedUser(u);
                                      setMembershipsDialogOpen(true);
                                      setMembershipsPage(1);
                                      fetchUserMemberships(u.id, 1);
                                    }}>
                                      <Users className="w-4 h-4 mr-2" />
                                      View Memberships
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Subscription Actions */}
                                    {!u.subscription && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedUser(u);
                                        setSubscriptionForm({ planName: 'pro', durationDays: null });
                                        setSubscriptionDialogOpen(true);
                                      }}>
                                        <Crown className="w-4 h-4 mr-2" />
                                        Create Subscription
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {u.subscription && u.subscription.status === 'active' && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedUser(u);
                                          if (window.confirm(`Cancel subscription for ${u.email}?`)) {
                                            handleCancelSubscription();
                                          }
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Cancel Subscription
                                      </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Plan Actions */}
                                    {u.plan?.name === 'pro' && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedUser(u);
                                        if (window.confirm(`Force downgrade ${u.email} to Free plan?`)) {
                                          handleDowngradeUser();
                                        }
                                      }}>
                                        <ArrowDown className="w-4 h-4 mr-2" />
                                        Downgrade to Free
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {u.plan?.name === 'free' && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedUser(u);
                                        handleUpgradeUser();
                                      }}>
                                        <ArrowUp className="w-4 h-4 mr-2" />
                                        Upgrade to Pro
                                      </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Account Status */}
                                    {!u.disabled && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedUser(u);
                                          if (window.confirm(`Disable ${u.email}? They will not be able to log in.`)) {
                                            handleDisableUser();
                                          }
                                        }}
                                        className="text-red-600"
                                      >
                                        <Ban className="w-4 h-4 mr-2" />
                                        Disable User
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {u.disabled && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedUser(u);
                                        handleEnableUser();
                                      }}>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Enable User
                                      </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Settings */}
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedUser(u);
                                      setGracePeriodForm({ 
                                        gracePeriodEndsAt: u.grace_period_ends_at 
                                          ? new Date(u.grace_period_ends_at).toISOString().slice(0, 16)
                                          : '' 
                                      });
                                      setGracePeriodDialogOpen(true);
                                    }}>
                                      <Clock className="w-4 h-4 mr-2" />
                                      Set Grace Period
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedUser(u);
                                      setQuotaForm({
                                        storageBytes: u.custom_storage_bytes ? String(u.custom_storage_bytes) : '',
                                        maxWorkspaces: u.custom_max_workspaces !== null && u.custom_max_workspaces !== undefined ? String(u.custom_max_workspaces) : '',
                                        maxWalkthroughs: u.custom_max_walkthroughs !== null && u.custom_max_walkthroughs !== undefined ? String(u.custom_max_walkthroughs) : ''
                                      });
                                      setQuotaDialogOpen(true);
                                    }}>
                                      <Settings className="w-4 h-4 mr-2" />
                                      Set Custom Quotas
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Delete/Restore */}
                                    {!u.deleted_at && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          if (window.confirm(`Soft delete ${u.email}? This will mark the user as deleted but preserve their data.`)) {
                                            handleSoftDeleteUser(u.id);
                                          }
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Soft Delete User
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {u.deleted_at && (
                                      <DropdownMenuItem onClick={() => {
                                        handleRestoreUser(u.id);
                                      }}>
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Restore User
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-slate-600">
                        Showing {(usersPage - 1) * usersLimit + 1} to {Math.min(usersPage * usersLimit, usersTotal)} of {usersTotal} users
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={usersPage === 1}
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={usersPage * usersLimit >= usersTotal}
                          onClick={() => setUsersPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            {statsLoading ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">Loading statistics...</div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Total:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.users.total}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Verified:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.users.verified}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Admins:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.users.admins}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Plans
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(stats.plans || {}).map(([name, data]) => (
                        <div key={name} className="flex justify-between text-slate-700 dark:text-slate-300">
                          <span>{data.display_name}:</span>
                          <strong className="text-slate-900 dark:text-slate-100">{data.count}</strong>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Subscriptions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Active:</span>
                        <strong className="text-green-600 dark:text-green-400">{stats.subscriptions.active}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Cancelled:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.subscriptions.cancelled}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Pending:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.subscriptions.pending}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Workspaces
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.workspaces.total}</div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      Walkthroughs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Total:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.walkthroughs.total}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Published:</span>
                        <strong className="text-green-600 dark:text-green-400">{stats.walkthroughs.published}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Draft:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.walkthroughs.draft}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      Storage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Total:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{formatBytes(stats.storage.total_bytes)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Files:</span>
                        <strong className="text-slate-900 dark:text-slate-100">{stats.files.active}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.email} - ${selectedUser.name}`}
              </DialogDescription>
            </DialogHeader>
            
            {/* Current State Display */}
            {selectedUser && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Current State</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Effective State:</span>
                    <Badge variant="outline" className={`ml-2 ${getEffectiveState(selectedUser).color} ${getEffectiveState(selectedUser).bg} border-current`}>
                      {getEffectiveState(selectedUser).label}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Role:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.role || 'owner'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Plan:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.plan?.display_name || 'Free'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Subscription:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.subscription?.status || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Disabled:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.disabled ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Deleted:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.deleted_at ? formatDateTime(selectedUser.deleted_at) : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Grace Period Ends:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{selectedUser.grace_period_ends_at ? formatDateTime(selectedUser.grace_period_ends_at) : 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Storage Used:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{formatBytes(selectedUser.storage_used || 0)}</span>
                  </div>
                  {selectedUser.custom_storage_bytes !== null && selectedUser.custom_storage_bytes !== undefined && (
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Custom Storage Limit:</span>
                      <span className="ml-2 text-purple-600 dark:text-purple-400">{formatBytes(selectedUser.custom_storage_bytes)}</span>
                    </div>
                  )}
                  {selectedUser.custom_max_workspaces !== null && selectedUser.custom_max_workspaces !== undefined && (
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Custom Workspaces Limit:</span>
                      <span className="ml-2 text-purple-600 dark:text-purple-400">{selectedUser.custom_max_workspaces}</span>
                    </div>
                  )}
                  {selectedUser.custom_max_walkthroughs !== null && selectedUser.custom_max_walkthroughs !== undefined && (
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Custom Walkthroughs Limit:</span>
                      <span className="ml-2 text-purple-600 dark:text-purple-400">{selectedUser.custom_max_walkthroughs}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={editForm.planName} onValueChange={(value) => setEditForm({ ...editForm, planName: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button variant="default" onClick={handleSaveUser} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Subscription Dialog */}
        <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Manual Subscription</DialogTitle>
              <DialogDescription>
                Create a subscription for {selectedUser?.email} (bypasses PayPal)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Plan</Label>
                <Select value={subscriptionForm.planName} onValueChange={(value) => setSubscriptionForm({ ...subscriptionForm, planName: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (days) - Leave empty for permanent</Label>
                <Input
                  type="number"
                  value={subscriptionForm.durationDays || ''}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, durationDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="365 or leave empty"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubscriptionDialogOpen(false)}>Cancel</Button>
              <Button variant="default" onClick={handleCreateSubscription} disabled={creatingSubscription}>
                {creatingSubscription ? 'Creating...' : 'Create Subscription'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Memberships Dialog */}
        <Dialog open={membershipsDialogOpen} onOpenChange={setMembershipsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Workspace Memberships</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.email} - ${selectedUser.name}`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {membershipsLoading ? (
                <div className="text-center py-8 text-slate-600 dark:text-slate-400">Loading memberships...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Workspace</th>
                          <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Status</th>
                          <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Frozen</th>
                          <th className="text-left p-2 text-slate-700 dark:text-slate-300 font-semibold">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userMemberships.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-8 text-slate-600 dark:text-slate-400">
                              No memberships found
                            </td>
                          </tr>
                        ) : (
                          userMemberships.map((m) => (
                            <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="p-2 text-slate-900 dark:text-slate-100">
                                {m.workspace?.name || 'Unknown'}
                                {m.workspace?.slug && (
                                  <div className="text-xs text-slate-500">/{m.workspace.slug}</div>
                                )}
                              </td>
                              <td className="p-2">
                                <Badge 
                                  variant={m.status === 'accepted' ? 'outline' : 'secondary'}
                                  className={m.status === 'accepted' ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
                                >
                                  {m.status || 'pending'}
                                </Badge>
                              </td>
                              <td className="p-2 text-slate-700 dark:text-slate-300 text-sm">
                                {m.frozen_reason ? (
                                  <div>
                                    <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                                      Frozen
                                    </Badge>
                                    <div className="text-xs text-slate-500 mt-1">Reason: {m.frozen_reason}</div>
                                    {m.frozen_at && (
                                      <div className="text-xs text-slate-500">At: {formatDateTime(m.frozen_at)}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">No</span>
                                )}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-400 text-sm">
                                {formatDate(m.created_at)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {membershipsTotal > 50 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-slate-600">
                        Showing {(membershipsPage - 1) * 50 + 1} to {Math.min(membershipsPage * 50, membershipsTotal)} of {membershipsTotal} memberships
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={membershipsPage === 1}
                          onClick={() => {
                            const newPage = membershipsPage - 1;
                            setMembershipsPage(newPage);
                            fetchUserMemberships(selectedUser.id, newPage);
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={membershipsPage * 50 >= membershipsTotal}
                          onClick={() => {
                            const newPage = membershipsPage + 1;
                            setMembershipsPage(newPage);
                            fetchUserMemberships(selectedUser.id, newPage);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMembershipsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Grace Period Dialog */}
        <Dialog open={gracePeriodDialogOpen} onOpenChange={setGracePeriodDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Set Grace Period</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.email} - ${selectedUser.name}`}
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Grace Period</h4>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedUser.grace_period_ends_at 
                    ? `Ends: ${formatDateTime(selectedUser.grace_period_ends_at)}`
                    : 'None'}
                </div>
              </div>
            )}
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Grace Period End Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={gracePeriodForm.gracePeriodEndsAt}
                  onChange={(e) => setGracePeriodForm({ ...gracePeriodForm, gracePeriodEndsAt: e.target.value })}
                  placeholder="Leave empty to remove grace period"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to remove grace period. Format: YYYY-MM-DDTHH:mm
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setGracePeriodDialogOpen(false);
                setGracePeriodForm({ gracePeriodEndsAt: '' });
              }}>Cancel</Button>
              <Button variant="default" onClick={handleSetGracePeriod} disabled={settingGracePeriod}>
                {settingGracePeriod ? 'Setting...' : 'Set Grace Period'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Custom Quotas Dialog */}
        <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Set Custom Quotas</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.email} - ${selectedUser.name}`}
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Custom Quotas</h4>
                <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                  <div>
                    Storage: {selectedUser.custom_storage_bytes 
                      ? formatBytes(selectedUser.custom_storage_bytes) 
                      : 'None (using plan default)'}
                  </div>
                  <div>
                    Workspaces: {selectedUser.custom_max_workspaces !== null && selectedUser.custom_max_workspaces !== undefined
                      ? selectedUser.custom_max_workspaces
                      : 'None (using plan default)'}
                  </div>
                  <div>
                    Walkthroughs: {selectedUser.custom_max_walkthroughs !== null && selectedUser.custom_max_walkthroughs !== undefined
                      ? selectedUser.custom_max_walkthroughs
                      : 'None (using plan default)'}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Storage Limit (bytes)</Label>
                <Input
                  type="number"
                  value={quotaForm.storageBytes}
                  onChange={(e) => setQuotaForm({ ...quotaForm, storageBytes: e.target.value })}
                  placeholder="Leave empty to use plan default"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to remove override and use plan default
                </p>
              </div>
              <div>
                <Label>Max Workspaces</Label>
                <Input
                  type="number"
                  value={quotaForm.maxWorkspaces}
                  onChange={(e) => setQuotaForm({ ...quotaForm, maxWorkspaces: e.target.value })}
                  placeholder="Leave empty to use plan default"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to remove override and use plan default
                </p>
              </div>
              <div>
                <Label>Max Walkthroughs</Label>
                <Input
                  type="number"
                  value={quotaForm.maxWalkthroughs}
                  onChange={(e) => setQuotaForm({ ...quotaForm, maxWalkthroughs: e.target.value })}
                  placeholder="Leave empty to use plan default"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to remove override and use plan default
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setQuotaDialogOpen(false);
                setQuotaForm({ storageBytes: '', maxWorkspaces: '', maxWalkthroughs: '' });
              }}>Cancel</Button>
              <Button variant="default" onClick={handleSetCustomQuota} disabled={settingQuota}>
                {settingQuota ? 'Setting...' : 'Set Custom Quotas'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboardPage;
