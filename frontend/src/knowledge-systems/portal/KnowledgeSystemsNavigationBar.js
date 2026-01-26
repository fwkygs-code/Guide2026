import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POLICY_ROUTES } from '../../policy-system/routes';
import { PROCEDURE_ROUTES } from '../../procedure-system/routes';
import { DOCUMENTATION_ROUTES } from '../../documentation-system/routes';
import { FAQ_ROUTES } from '../../faq-system/routes';
import { DECISION_TREE_ROUTES } from '../../decision-tree-system/routes';
import { portalKnowledgeSystemsService } from '../api-service';

function KnowledgeSystemsNavigationBar({ workspaceId }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [systemCounts, setSystemCounts] = useState({
    policy: 0,
    procedure: 0,
    documentation: 0,
    faq: 0,
    decision_tree: 0
  });

  useEffect(() => {
    if (!slug) return;
    
    // Fetch counts for each system type
    const fetchCounts = async () => {
      try {
        const [policies, procedures, documentation, faqs, decisionTrees] = await Promise.all([
          portalKnowledgeSystemsService.getAllByType(slug, 'policy'),
          portalKnowledgeSystemsService.getAllByType(slug, 'procedure'),
          portalKnowledgeSystemsService.getAllByType(slug, 'documentation'),
          portalKnowledgeSystemsService.getAllByType(slug, 'faq'),
          portalKnowledgeSystemsService.getAllByType(slug, 'decision_tree')
        ]);

        setSystemCounts({
          policy: policies.length,
          procedure: procedures.length,
          documentation: documentation.length,
          faq: faqs.length,
          decision_tree: decisionTrees.length
        });
      } catch (error) {
        console.error('Error fetching knowledge system counts:', error);
      }
    };

    fetchCounts();
  }, [slug]);

  const systems = useMemo(() => {
    const entries = [
      {
        id: 'policy',
        title: 'Policies',
        color: '#f59e0b',
        route: POLICY_ROUTES.portal,
        count: systemCounts.policy
      },
      {
        id: 'procedure',
        title: 'Procedures',
        color: '#22d3ee',
        route: PROCEDURE_ROUTES.portal,
        count: systemCounts.procedure
      },
      {
        id: 'documentation',
        title: 'Documentation',
        color: '#a855f7',
        route: DOCUMENTATION_ROUTES.portal,
        count: systemCounts.documentation
      },
      {
        id: 'faq',
        title: 'FAQs',
        color: '#34d399',
        route: FAQ_ROUTES.portal,
        count: systemCounts.faq
      },
      {
        id: 'decision-tree',
        title: 'Decision Trees',
        color: '#6366f1',
        route: DECISION_TREE_ROUTES.portal,
        count: systemCounts.decision_tree
      }
    ];
    return entries.filter((entry) => entry.count > 0);
  }, [systemCounts]);

  // Always return null to disable the Knowledge Base navigation bar
  // since knowledge systems are already embedded in the portal page
  return null;

  const handleSystemClick = (system) => {
    if (!slug) return;
    navigate(system.route.replace(':slug', slug));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: isMinimized ? 60 : 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-sm border-t border-slate-700/60 shadow-lg"
      >
        <div className="absolute -top-10 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="bg-slate-900/90 backdrop-blur-sm shadow-md h-8 w-8 p-0 border-slate-700"
          >
            <ChevronUp
              className={`h-4 w-4 transition-transform duration-200 text-slate-200 ${
                isMinimized ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </div>

        <div className="absolute -top-10 right-14">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="bg-slate-900/90 backdrop-blur-sm shadow-md h-8 w-8 p-0 border-slate-700"
          >
            <X className="h-4 w-4 text-slate-200" />
          </Button>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-100">Knowledge Base</h3>
                  <span className="text-xs text-slate-400">
                    {systems.length} system{systems.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {systems.map((system, index) => (
                    <motion.div
                      key={system.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Button
                        onClick={() => handleSystemClick(system)}
                        className="flex items-center gap-3 whitespace-nowrap border transition-all duration-200 hover:shadow-md hover:scale-105"
                        style={{
                          background: `${system.color}22`,
                          borderColor: `${system.color}55`,
                          color: '#f8fafc'
                        }}
                      >
                        <span className="text-sm font-medium">{system.title}</span>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default KnowledgeSystemsNavigationBar;