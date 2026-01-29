import React from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import WorkspaceLoader from '../components/WorkspaceLoader';
import { Button } from '@/components/ui/button';
import { KnowledgeRouteProvider } from './KnowledgeRouteContext';

const WorkspaceKnowledgeLayout = () => {
  const { workspaceSlug } = useParams();
  const { t, ready } = useTranslation('knowledgeSystems');

  if (!ready) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <WorkspaceLoader size={160} />
        </div>
      </DashboardLayout>
    );
  }

  if (!workspaceSlug) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center px-6 text-center">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('workspaceNotFound', { defaultValue: 'Workspace not found.' })}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <KnowledgeRouteProvider value={{ slug: workspaceSlug, context: 'workspace' }}>
      <DashboardLayout>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <Link to={`/workspace/${workspaceSlug}/knowledge-systems`}>
              <Button variant="ghost">
                {t('backToSystems')}
              </Button>
            </Link>
          </div>
          <Outlet />
        </div>
      </DashboardLayout>
    </KnowledgeRouteProvider>
  );
};

export default WorkspaceKnowledgeLayout;
