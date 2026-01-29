import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { api } from '../lib/api';
import WorkspaceLoader from '../components/WorkspaceLoader';

type PolicyListPageProps = {
  workspaceId: string;
  workspaceSlug: string;
};

export const PolicyListPage = ({ workspaceId, workspaceSlug }: PolicyListPageProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicies();
  }, [workspaceId]);

  const loadPolicies = async () => {
    try {
      const response = await api.getKnowledgeSystems(workspaceId, 'policy');
      setPolicies(response.data || []);
    } catch (error) {
      console.error('Failed to load policies:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate(`/workspace/${workspaceSlug}/knowledge/policy/new`);
  };

  const handleEdit = (policyId: string) => {
    navigate(`/workspace/${workspaceSlug}/knowledge/policy/${policyId}`);
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm(t('dialogs.confirm.deletePolicy'))) return;
    
    try {
      await api.deleteKnowledgeSystem(workspaceId, policyId);
      await loadPolicies();
    } catch (error) {
      console.error('Failed to delete policy:', error);
      alert(t('dialogs.alert.failedToDeletePolicy'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-amber-50">
      <header className="border-b border-amber-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-wide">Policies</h1>
              <p className="text-amber-200/70 mt-2">Manage legal and compliance policies</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-6 py-3 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 hover:bg-amber-500/40 transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Policy
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {policies.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-amber-400/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-amber-100 mb-2">No Policies Yet</h3>
            <p className="text-amber-200/60 mb-6">Create your first policy to get started</p>
            <button
              onClick={handleCreate}
              className="px-6 py-3 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 hover:bg-amber-500/40 transition"
            >
              Create Policy
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {policies.map((policy, index) => (
              <motion.div
                key={policy.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border border-amber-500/20 bg-slate-900/60 rounded-xl p-6 hover:border-amber-400/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-amber-50 mb-2">{policy.title || 'Untitled Policy'}</h3>
                    {policy.description && (
                      <p className="text-amber-200/70 mb-3">{policy.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-amber-200/60">
                      <span className={`px-3 py-1 rounded-full border ${
                        policy.status === 'published' 
                          ? 'border-green-400/40 text-green-200 bg-green-500/10' 
                          : 'border-amber-400/40 text-amber-200 bg-amber-500/10'
                      }`}>
                        {policy.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span>Updated {new Date(policy.updated_at).toLocaleDateString()}</span>
                      {policy.content?.sections && (
                        <span>{policy.content.sections.length} sections</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(policy.id)}
                      className="p-2 rounded-lg border border-amber-400/30 text-amber-200 hover:text-white hover:border-amber-400 transition"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(policy.id)}
                      className="p-2 rounded-lg border border-red-400/30 text-red-200 hover:text-white hover:border-red-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PolicyListPage;
