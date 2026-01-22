import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Eye, Play, CheckCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { PageHeader, PageSurface } from '../components/ui/design-system';

const AnalyticsPage = () => {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Resolve workspace slug to ID
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [analyticsData, setAnalyticsData] = useState({});
  const [feedbackData, setFeedbackData] = useState({});

  // Acquire workspace lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
          navigate(`/workspace/${workspaceSlug}/walkthroughs`);
        }
      } catch (error) {
        console.error('Failed to acquire workspace lock:', error);
      }
    };

    if (workspaceId) {
      acquireLock();
    }

    // Release lock on unmount (ignore errors - idempotent)
    return () => {
      if (workspaceId) {
        api.unlockWorkspace(workspaceId).catch(() => {
          // Ignore unlock errors - lock may already be released, expired, or user was forced out
        });
      }
    };
  }, [workspaceId, workspaceSlug, navigate]);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    if (!workspaceId) return; // Wait for workspace ID to be resolved
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

      // Fetch feedback for each walkthrough (published or not)
      const feedbackPromises = response.data.map(wt =>
        api.getFeedback(workspaceId, wt.id).catch(() => ({ data: [] }))
      );
      const feedbackResults = await Promise.all(feedbackPromises);
      const feedbackMap = {};
      response.data.forEach((wt, index) => {
        feedbackMap[wt.id] = feedbackResults[index]?.data || [];
      });
      setFeedbackData(feedbackMap);
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

  if (loading || workspaceLoading || !workspaceId) {
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
      <PageHeader
        title="Analytics"
        description="Track performance of your walkthroughs"
      />

      <PageSurface>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
className="rounded-xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-slate-400">Total Views</div>
            </div>
            <div className="text-3xl font-heading font-bold text-white">{totalViews}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
className="rounded-xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-accent" />
              </div>
              <div className="text-sm text-slate-400">Total Starts</div>
            </div>
            <div className="text-3xl font-heading font-bold text-white">{totalStarts}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
className="rounded-xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
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
className="rounded-xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-warning/20 backdrop-blur-sm border border-warning/30 flex items-center justify-center shadow-[0_2px_8px_rgba(90,200,250,0.2)] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent before:pointer-events-none">
                <TrendingUp className="w-5 h-5 text-warning-600 relative z-10" />
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
                const feedback = feedbackData[wt.id] || [];
                const happyCount = feedback.filter((f) => f.rating === 'happy').length;
                const neutralCount = feedback.filter((f) => f.rating === 'neutral').length;
                const unhappyCount = feedback.filter((f) => f.rating === 'unhappy').length;
                const totalFeedback = happyCount + neutralCount + unhappyCount;
                const pct = (n) => (totalFeedback > 0 ? Math.round((n / totalFeedback) * 100) : 0);
                return (
                  <div key={wt.id} className="border border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-heading font-semibold text-white">{wt.title}</h3>
                        <p className="text-sm text-slate-400">{wt.steps?.length || 0} steps</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-400">Views</div>
                        <div className="text-lg font-heading font-semibold">{analytics.views || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Starts</div>
                        <div className="text-lg font-heading font-semibold">{analytics.starts || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Completions</div>
                        <div className="text-lg font-heading font-semibold">{analytics.completions || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Rate</div>
                        <div className="text-lg font-heading font-semibold">
                          {analytics.completion_rate ? `${analytics.completion_rate.toFixed(1)}%` : '0%'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-700">Feedback</div>
                        <div className="text-sm text-slate-600">{feedback.length} submissions</div>
                      </div>
                      {totalFeedback > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl px-3 py-2">
                            <div className="text-sm font-medium text-slate-700">😊 Happy</div>
                            <div className="text-xs text-slate-600">{happyCount} ({pct(happyCount)}%)</div>
                          </div>
                          <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl px-3 py-2">
                            <div className="text-sm font-medium text-slate-700">😐 Neutral</div>
                            <div className="text-xs text-slate-600">{neutralCount} ({pct(neutralCount)}%)</div>
                          </div>
                          <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl px-3 py-2">
                            <div className="text-sm font-medium text-slate-700">☹️ Sad</div>
                            <div className="text-xs text-slate-600">{unhappyCount} ({pct(unhappyCount)}%)</div>
                          </div>
                        </div>
                      )}
                      {feedback.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {feedback.slice(0, 3).map((f) => (
                            <div key={f.id} className="text-sm text-gray-700 bg-gray-50/50 backdrop-blur-sm rounded-xl px-3 py-2">
                              <span className="font-medium">{f.rating}</span>
                              {f.comment ? <span className="text-slate-600"> — {f.comment}</span> : null}
                            </div>
                          ))}
                          {feedback.length > 3 && (
                            <div className="text-xs text-slate-400">Showing latest 3</div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-400">No feedback yet</div>
                      )}
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
            <div className="text-sm text-slate-400 mb-1">Total Walkthroughs</div>
            <div className="text-2xl font-heading font-bold text-white">{walkthroughs.length}</div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="text-sm text-slate-600 mb-1">Published</div>
            <div className="text-2xl font-heading font-bold text-slate-900">
              {walkthroughs.filter(w => w.status === 'published').length}
            </div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="text-sm text-slate-400 mb-1">Total Steps</div>
            <div className="text-2xl font-heading font-bold text-white">
              {walkthroughs.reduce((sum, w) => sum + (w.steps?.length || 0), 0)}
            </div>
          </div>
        </div>
      </PageSurface>
    </DashboardLayout>
  );
};

export default AnalyticsPage;