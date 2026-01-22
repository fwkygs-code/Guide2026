/**
 * Policy Portal Page - Authoritative & Formal
 *
 * Read-only display of policy content with trust indicators.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Calendar, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import axios from 'axios';

/**
 * Policy Portal Page - Authoritative Display
 */
function PolicyPortalPage() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      // Get workspace data from portal API
      const portalResponse = await axios.get(`/api/portal/${slug}`);
      const workspaceId = portalResponse.data.workspace.id;

      const systems = getKnowledgeSystems(workspaceId);
      const policySystem = systems.find(s => s.type === 'policy' && s.enabled);
      setSystem(policySystem);
    } catch (error) {
      console.error('Failed to load policy system:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Policies Not Available</h1>
            <p className="text-slate-600 max-w-md">
              Policy documentation is not currently published for this workspace.
            </p>
          </div>
          <Link to={`/portal/${slug}`}>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-amber-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{system.title}</h1>
              <p className="text-slate-600 text-lg">{system.description}</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center gap-6 text-sm text-slate-600">
            {system.content?.effectiveDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Effective: {new Date(system.content.effectiveDate).toLocaleDateString()}</span>
              </div>
            )}
            {system.content?.jurisdiction && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Jurisdiction: {system.content.jurisdiction}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Last Updated: {new Date(system.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Official Notice */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Official Policy Documentation</h3>
                <p className="text-amber-800 text-sm">
                  These policies establish official guidelines and requirements. All personnel are required to comply with these policies as applicable to their roles and responsibilities.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {(system.content?.policies || []).length === 0 ? (
            <Card className="border-dashed border-slate-300">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">No Policies Published</h3>
                <p className="text-slate-500">
                  Policy content has not been published yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            (system.content?.policies || []).map((policy, index) => (
              <PolicySection key={policy.id} policy={policy} index={index} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Individual Policy Section
 */
function PolicySection({ policy, index }) {
  return (
    <Card className="border-amber-200/50 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">{index + 1}</span>
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900 mb-1">{policy.title}</CardTitle>
              {policy.category && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {policy.category}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Updated {new Date(policy.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="prose prose-slate max-w-none">
          {policy.content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="mb-4 text-slate-700 leading-relaxed last:mb-0">
              {paragraph.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < paragraph.split('\n').length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </div>

        {/* Version Notice */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-3 h-3" />
            <span>This is the current version of this policy. Previous versions may be available upon request.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PolicyPortalPage;