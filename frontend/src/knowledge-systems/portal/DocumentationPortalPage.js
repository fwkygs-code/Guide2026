/**
 * Documentation Portal Page - Knowledge Hub & Reference Library
 *
 * Purple-themed portal emphasizing deep knowledge, structured information hierarchy,
 * and comprehensive technical reference materials.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, FolderTree, Search, Lightbulb, FileText, ChevronRight, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import axios from 'axios';

/**
 * Documentation Portal Page - Knowledge-Focused Design
 */
function DocumentationPortalPage() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState(new Set());

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
      const documentationSystem = systems.find(s => s.type === 'documentation' && s.enabled);
      setSystem(documentationSystem);
    } catch (error) {
      console.error('Failed to load documentation system:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-purple-400 border-t-transparent rounded-full"
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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent mb-4">
              Documentation Not Available
            </h1>
            <p className="text-purple-100/80 leading-relaxed mb-6">
              Technical documentation is not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white shadow-lg">
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
      {/* Header - Purple knowledge theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-purple-200/80 hover:text-purple-100 hover:bg-purple-500/10 mb-6">
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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/25">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                {system.title}
              </h1>
              <p className="text-purple-100/80 text-xl leading-relaxed">{system.description}</p>
            </div>
          </motion.div>

          {/* Knowledge Stats & Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <FolderTree className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">
                {(system.content?.sections || []).length} Knowledge Sections
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <FileText className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <Lightbulb className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">
                Technical Reference Library
              </span>
            </div>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-8"
          >
            <div className="relative max-w-md">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-xl blur-lg" />
              <div className="relative bg-purple-500/10 backdrop-blur-xl border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-purple-400" />
                  <input
                    type="text"
                    placeholder="Search documentation..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent text-purple-100 placeholder-purple-300/60 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Knowledge Hub Notice */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Layers className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-purple-100 mb-2 text-lg">Comprehensive Knowledge Base</h3>
                  <p className="text-purple-200/80 leading-relaxed">
                    Explore our structured documentation library. Each section is carefully organized to provide deep technical insights, best practices, and comprehensive reference materials.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Lightbulb className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300/60 text-sm">Hierarchical Knowledge Structure</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Knowledge hierarchy layout */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {(system.content?.sections || []).length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-purple-500/30">
                <BookOpen className="w-16 h-16 text-purple-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-purple-100 mb-4">No Documentation Published</h3>
                <p className="text-purple-200/70">
                  Technical documentation has not been published yet. Check back for comprehensive knowledge resources.
                </p>
              </Surface>
            </motion.div>
          ) : (
            (system.content?.sections || [])
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((section, index) => (
                <DocumentationSectionRenderer
                  key={section.id}
                  section={section}
                  index={index}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Documentation Section Renderer - Hierarchical Knowledge Display
 */
function DocumentationSectionRenderer({ section, index, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
    >
      <Card system="documentation" animated={false} className="overflow-hidden">
        <CardHeader system="documentation">
          <motion.button
            onClick={onToggle}
            className="w-full text-left flex items-center justify-between hover:bg-purple-500/5 p-2 -m-2 rounded-lg transition-colors group"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ rotate: 10 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-white font-bold text-lg">{index + 1}</span>
              </motion.div>
              <div>
                <CardTitle system="documentation" className="text-2xl mb-1">{section.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/30 px-2 py-0.5 text-xs">
                    Section {index + 1}
                  </Badge>
                  {(section.subsections || []).length > 0 && (
                    <span className="text-purple-300/60 text-sm">
                      {(section.subsections || []).length} subsections
                    </span>
                  )}
                </div>
              </div>
            </div>
            <motion.div
              className="flex items-center gap-3"
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-5 h-5 text-purple-400" />
            </motion.div>
          </motion.button>
        </CardHeader>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent system="documentation" className="px-8 pb-8">
              {/* Main section content */}
              <div className="prose prose-lg max-w-none mb-8">
                {section.content.split('\n\n').map((paragraph, i) => (
                  <motion.p
                    key={i}
                    className="mb-6 text-purple-50/90 leading-relaxed last:mb-0 text-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    {paragraph.split('\n').map((line, j) => (
                      <span key={j}>
                        {line}
                        {j < paragraph.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </motion.p>
                ))}
              </div>

              {/* Subsections - Hierarchical display */}
              {section.subsections && section.subsections.length > 0 && (
                <div className="space-y-6">
                  <div className="border-t border-purple-500/20 pt-6">
                    <h4 className="text-purple-100 font-semibold mb-4 flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-purple-400" />
                      Detailed Topics
                    </h4>
                    <div className="space-y-4">
                      {section.subsections
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((subsection, subIndex) => (
                          <motion.div
                            key={subsection.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: subIndex * 0.1 }}
                            className="border-l-4 border-purple-500/30 pl-6 py-4 bg-purple-500/5 rounded-r-lg"
                          >
                            <h5 className="font-semibold text-purple-100 mb-3 text-lg">{subsection.title}</h5>
                            <div className="prose prose-base max-w-none">
                              {subsection.content.split('\n\n').map((paragraph, i) => (
                                <p key={i} className="mb-4 text-purple-50/80 leading-relaxed last:mb-0">
                                  {paragraph.split('\n').map((line, j) => (
                                    <span key={j}>
                                      {line}
                                      {j < paragraph.split('\n').length - 1 && <br />}
                                    </span>
                                  ))}
                                </p>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}

export default DocumentationPortalPage;