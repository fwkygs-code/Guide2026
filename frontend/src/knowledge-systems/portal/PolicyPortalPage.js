/**
 * Policy Portal Page - Authoritative & Futuristic
 *
 * Glass morphism policy display with trust indicators and official authority.
 * Warm amber theming represents legal compliance and institutional trust.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Calendar, FileText, Clock, Scale, Award, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { COLORS, ICONOGRAPHY, MOTION } from '@/components/ui/design-system';
import { portalKnowledgeSystemsService } from '../api-service';
import axios from 'axios';

/**
 * Policy Portal Page - Authoritative Display
 */
function PolicyPortalPage() {
  const { slug } = useParams();
  const [publishedPolicies, setPublishedPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      const policies = await portalKnowledgeSystemsService.getAllByType(slug, 'policy');
      console.log('[PolicyPortal] Loaded policies:', policies);
      setPublishedPolicies(policies);
    } catch (error) {
      console.error('Failed to load policy system:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8 max-w-md"
        >
          <Surface variant="glass-accent" className="p-8 rounded-2xl">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-4">
              Policies Not Available
            </h1>
            <p className="text-amber-100/80 leading-relaxed mb-6">
              Policy documentation is not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </Surface>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header - Glass morphism with amber theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-amber-200/80 hover:text-amber-100 hover:bg-amber-500/10 mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/25">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                Policies
              </h1>
              <p className="text-amber-100/80 text-xl leading-relaxed">Official policies and procedures with legal authority and compliance standards.</p>
            </div>
          </motion.div>


          {/* Official Authority Notice - Enhanced glass card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-amber-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-100 mb-2 text-lg">Official Policy Documentation</h3>
                  <p className="text-amber-200/80 leading-relaxed">
                    These policies establish official guidelines and requirements. All personnel are required to comply with these policies as applicable to their roles and responsibilities. This documentation carries full legal authority.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300/60 text-sm">Protected Official Document</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Futuristic layout */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {publishedPolicies.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-amber-500/30">
                <FileText className="w-16 h-16 text-amber-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-amber-100 mb-4">No Policies Published</h3>
                <p className="text-amber-200/70">
                  Policy content has not been published yet. Check back later for official documentation.
                </p>
              </Surface>
            </motion.div>
          ) : (
            publishedPolicies.map((policyData, index) => (
              <PolicySection key={policyData.id} policy={policyData} index={index} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Individual Policy Section - Futuristic Design
 */
function PolicySection({ policy, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card system="policy" animated={false} className="overflow-hidden">
        <CardHeader system="policy">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-white font-bold text-lg">{index + 1}</span>
              </motion.div>
              <div>
                <CardTitle system="policy" className="text-2xl mb-2">{policy.title}</CardTitle>
                {policy.content?.category && (
                  <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30 px-3 py-1">
                    {policy.content.category}
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-sm text-amber-200/60 font-medium">
              Updated {new Date(policy.updated_at).toLocaleDateString()}
            </div>
          </div>
        </CardHeader>

        <CardContent system="policy" className="px-8 pb-8">
          <div className="prose prose-lg max-w-none">
            {policy.content?.sections?.map((section, i) => (
              <motion.div
                key={i}
                className="mb-8 last:mb-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: (index * 0.1) + (i * 0.1) }}
              >
                <h3 className="text-xl font-bold text-amber-100 mb-3">{section.title}</h3>
                {section.content && section.content.split('\n\n').map((paragraph, j) => (
                  <p key={j} className="mb-4 text-amber-50/90 leading-relaxed last:mb-0 text-base">
                    {paragraph.split('\n').map((line, k) => (
                      <span key={k}>
                        {line}
                        {k < paragraph.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ))}
              </motion.div>
            )) || (
              <p className="text-amber-50/90 leading-relaxed text-lg">
                {policy.description || 'No content available'}
              </p>
            )}
          </div>

          {/* Authority Notice */}
          <motion.div
            className="mt-8 pt-6 border-t border-amber-500/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: (index * 0.1) + 0.3 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-amber-200/80 text-sm font-medium">
                  Current version of this policy. Previous versions may be available upon request.
                </span>
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default PolicyPortalPage;