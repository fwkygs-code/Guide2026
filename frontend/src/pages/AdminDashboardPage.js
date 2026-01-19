import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Database, BarChart3, Edit, Trash2, Crown, HardDrive, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
      toast.error('Failed to load users');
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
      toast.error('Failed to load statistics');
    } finally {
      setStatsLoading(false);
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
      toast.error(error.response?.data?.detail || 'Failed to update user');
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
      toast.error(error.response?.data?.detail || 'Failed to create subscription');
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
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setCancellingSubscription(false);
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

  return (
    <DashboardLayout>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
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
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all users</CardDescription>
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
                  <div className="text-center py-8">Loading users...</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Role</th>
                            <th className="text-left p-2">Plan</th>
                            <th className="text-left p-2">Subscription</th>
                            <th className="text-left p-2">Storage</th>
                            <th className="text-left p-2">Created</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900">
                              <td className="p-2">{u.email}</td>
                              <td className="p-2">{u.name}</td>
                              <td className="p-2">
                                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                  {u.role || 'owner'}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Badge variant={u.plan?.name === 'pro' ? 'default' : 'outline'}>
                                  {u.plan?.display_name || 'Free'}
                                </Badge>
                              </td>
                              <td className="p-2">
                                {u.subscription ? (
                                  <Badge variant={u.subscription.status === 'active' ? 'default' : 'secondary'}>
                                    {u.subscription.status}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </td>
                              <td className="p-2">{formatBytes(u.storage_used || 0)}</td>
                              <td className="p-2">{formatDate(u.created_at)}</td>
                              <td className="p-2">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(u)}
                                    title="Edit user"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {!u.subscription && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedUser(u);
                                        setSubscriptionForm({ planName: 'pro', durationDays: null });
                                        setSubscriptionDialogOpen(true);
                                      }}
                                      title="Create subscription"
                                    >
                                      <Crown className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {u.subscription && u.subscription.status === 'active' && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="Cancel subscription"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to cancel the subscription for {u.email}? 
                                            This will downgrade them to the Free plan.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              setSelectedUser(u);
                                              handleCancelSubscription();
                                            }}
                                            disabled={cancellingSubscription}
                                          >
                                            {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
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
              <div className="text-center py-8">Loading statistics...</div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <strong>{stats.users.total}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Verified:</span>
                        <strong>{stats.users.verified}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Admins:</span>
                        <strong>{stats.users.admins}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5" />
                      Plans
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(stats.plans || {}).map(([name, data]) => (
                        <div key={name} className="flex justify-between">
                          <span>{data.display_name}:</span>
                          <strong>{data.count}</strong>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Subscriptions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Active:</span>
                        <strong>{stats.subscriptions.active}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Cancelled:</span>
                        <strong>{stats.subscriptions.cancelled}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending:</span>
                        <strong>{stats.subscriptions.pending}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      Workspaces
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.workspaces.total}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Walkthroughs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <strong>{stats.walkthroughs.total}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Published:</span>
                        <strong>{stats.walkthroughs.published}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Draft:</span>
                        <strong>{stats.walkthroughs.draft}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="w-5 h-5" />
                      Storage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <strong>{formatBytes(stats.storage.total_bytes)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Files:</span>
                        <strong>{stats.files.active}</strong>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                {selectedUser && `${selectedUser.email} - ${selectedUser.name}`}
              </DialogDescription>
            </DialogHeader>
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
              <Button onClick={handleSaveUser} disabled={saving}>
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
              <Button onClick={handleCreateSubscription} disabled={creatingSubscription}>
                {creatingSubscription ? 'Creating...' : 'Create Subscription'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboardPage;
