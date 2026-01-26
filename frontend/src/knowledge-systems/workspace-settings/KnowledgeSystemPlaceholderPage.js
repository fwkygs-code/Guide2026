/**
 * Knowledge System Placeholder Page
 *
 * Placeholder page for knowledge systems that are not yet implemented.
 * Provides clear information about what will be available and next steps.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge System Placeholder Page
 */
function KnowledgeSystemPlaceholderPage() {
  const { t } = useTranslation('knowledgeSystems');
  const { workspaceSlug, systemType } = useParams();
  const navigate = useNavigate();

  const config = getKnowledgeSystemConfig(systemType);

  const getSystemDescription = (type) => {
    const descriptions = {
      procedure: {
        title: "Standard Operating Procedures",
        description: "Create and manage standardized procedures for your team. Define step-by-step processes, checklists, and best practices that ensure consistency and quality across your organization.",
        features: ["Step-by-step workflows", "Role-based assignments", "Progress tracking", "Version control"]
      },
      documentation: {
        title: "Product Documentation",
        description: "Build comprehensive product documentation including user guides, API references, troubleshooting guides, and release notes. Keep your users informed and supported.",
        features: ["Multi-format support", "Search functionality", "Version management", "User feedback integration"]
      },
      faq: {
        title: "Frequently Asked Questions",
        description: "Maintain a dynamic FAQ system that learns from user interactions. Automatically surface the most relevant answers and continuously improve based on user behavior.",
        features: ["Smart search", "Usage analytics", "Auto-categorization", "Multi-language support"]
      },
      decision_tree: {
        title: "Decision Support System",
        description: "Create interactive decision trees that guide users through complex decision-making processes. Perfect for troubleshooting, product selection, or policy guidance.",
        features: ["Interactive flows", "Conditional logic", "Progress saving", "Analytics integration"]
      }
    };
    return descriptions[type] || {
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} System`,
      description: `A specialized knowledge management system for ${type} content.`,
      features: ["Coming soon", "Advanced features", "Full integration"]
    };
  };

  const systemInfo = getSystemDescription(systemType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}
                className="text-slate-200 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Systems
              </Button>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl ${config?.iconBg || 'bg-slate-600'}`}>
                  {config?.icon || '🚧'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{systemInfo.title}</h1>
                  <p className="text-slate-400 text-sm">Coming Soon</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                <Clock className="w-3 h-3 mr-2" />
                In Development
              </Badge>
              <Button
                variant="outline"
                onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}/configure`)}
                className="border-slate-600 text-slate-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure System
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="text-8xl mb-6">🚧</div>
          <h2 className="text-3xl font-bold text-white mb-4">System Under Construction</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            We're building a powerful {systemInfo.title.toLowerCase()} system that will revolutionize how you manage and deliver this type of knowledge content.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

          {/* System Description */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">What This System Will Do</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 leading-relaxed">
                {systemInfo.description}
              </p>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Planned Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {systemInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Development Timeline */}
        <Card className="border-slate-700/50 bg-slate-800/50 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Development Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <div>
                  <div className="text-white font-medium">System Configuration</div>
                  <div className="text-slate-400 text-sm">Complete - Configure system settings</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div>
                  <div className="text-white font-medium">Content Builder Interface</div>
                  <div className="text-slate-400 text-sm">In Progress - Specialized editing interface</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <div>
                  <div className="text-white font-medium">Portal Integration</div>
                  <div className="text-slate-400 text-sm">Planned - Public portal display</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <div>
                  <div className="text-white font-medium">Analytics & Insights</div>
                  <div className="text-slate-400 text-sm">Planned - Usage tracking and reporting</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h3 className="text-xl font-semibold text-white mb-4">Want to Help Shape This Feature?</h3>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            We're actively developing this system and would love to hear your specific needs and use cases.
            Your feedback will help us prioritize features and ensure the final product meets your requirements.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}
              className="border-slate-600 text-slate-300"
            >
              {t('knowledgeSystems.backToSystems')}
            </Button>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Get Early Access
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default KnowledgeSystemPlaceholderPage;