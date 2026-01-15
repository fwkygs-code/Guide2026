import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Eye, Play, CheckCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

const AnalyticsPage = () => {
  const { workspaceId } = useParams();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({});

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const response = await api.getWalkthroughs(workspaceId);
      setWalkthroughs(response.data);
      
      // Fetch analytics for each walkthrough
      const analyticsPromises = response.data.map(wt => 
        api.getAnalytics(workspaceId, wt.id).catch(() => ({ data: {} }))
      );
      const analyticsResults = await Promise.all(analyticsPromises);
      
      const analyticsMap = {};
      response.data.forEach((wt, index) => {
        analyticsMap[wt.id] = analyticsResults[index]?.data || {};
      });
      setAnalyticsData(analyticsMap);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const totalViews = Object.values(analyticsData).reduce((sum, data) => sum + (data.views || 0), 0);
  const totalStarts = Object.values(analyticsData).reduce((sum, data) => sum + (data.starts || 0), 0);
  const totalCompletions = Object.values(analyticsData).reduce((sum, data) => sum + (data.completions || 0), 0);
  const avgCompletionRate = totalStarts > 0 ? ((totalCompletions / totalStarts) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">Track performance of your walkthroughs</p>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-slate-600">Total Views</div>
            </div>
            <div className="text-3xl font-heading font-bold text-slate-900">{totalViews}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-accent" />
              </div>
              <div className="text-sm text-slate-600">Total Starts</div>
            </div>
            <div className="text-3xl font-heading font-bold text-slate-900">{totalStarts}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div className="text-sm text-slate-600">Completions</div>
            </div>
            <div className="text-3xl font-heading font-bold text-slate-900">{totalCompletions}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div className="text-sm text-slate-600">Completion Rate</div>
            </div>
            <div className="text-3xl font-heading font-bold text-slate-900">{avgCompletionRate}%</div>
          </motion.div>
        </div>

        {/* Walkthrough Stats */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-heading font-semibold text-slate-900 mb-4">Walkthrough Performance</h2>
          
          {walkthroughs.length > 0 ? (
            <div className="space-y-4">
              {walkthroughs.filter(w => w.status === 'published').map((wt) => {
                const analytics = analyticsData[wt.id] || {};
                return (
                  <div key={wt.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-heading font-semibold text-slate-900">{wt.title}</h3>
                        <p className="text-sm text-slate-600">{wt.steps?.length || 0} steps</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">Views</div>
                        <div className="text-lg font-heading font-semibold">{analytics.views || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Starts</div>
                        <div className="text-lg font-heading font-semibold">{analytics.starts || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Completions</div>
                        <div className="text-lg font-heading font-semibold">{analytics.completions || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Rate</div>
                        <div className="text-lg font-heading font-semibold">
                          {analytics.completion_rate ? `${analytics.completion_rate.toFixed(1)}%` : '0%'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No published walkthroughs yet</p>
            </div>
          )}
        </div>

        {/* Basic Workspace Stats */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="glass rounded-xl p-6">
            <div className="text-sm text-slate-600 mb-1">Total Walkthroughs</div>
            <div className="text-2xl font-heading font-bold text-slate-900">{walkthroughs.length}</div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="text-sm text-slate-600 mb-1">Published</div>
            <div className="text-2xl font-heading font-bold text-slate-900">
              {walkthroughs.filter(w => w.status === 'published').length}
            </div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="text-sm text-slate-600 mb-1">Total Steps</div>
            <div className="text-2xl font-heading font-bold text-slate-900">
              {walkthroughs.reduce((sum, w) => sum + (w.steps?.length || 0), 0)}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;