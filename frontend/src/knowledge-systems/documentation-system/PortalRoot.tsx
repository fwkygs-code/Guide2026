import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, FileText, Hash, Clock, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { apiClient } from '../../lib/api';
import { DocumentationSystem } from './model';
import { getPublishedDocumentationSystems } from './service';

export function DocumentationPortalRoot() {
  const { slug } = useParams();
  const [system, setSystem] = useState<DocumentationSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      const portalResponse = await apiClient.get(`/portal/${slug}`);
      const workspaceId = portalResponse.data.workspace.id;
      const publishedSystems = getPublishedDocumentationSystems(workspaceId);
      const documentationSystem = publishedSystems[0];
      setSystem(documentationSystem || null);
    } catch (error) {
      console.error('Failed to load documentation system:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!document.querySelector('[data-section-id]')) return;
      const sections = document.querySelectorAll('[data-section-id]');
      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top + scrollTop;
        const sectionHeight = rect.height;
        if (scrollTop >= sectionTop - windowHeight / 2 && scrollTop < sectionTop + sectionHeight - windowHeight / 2) {
          setActiveSection(section.getAttribute('data-section-id'));
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [system]);

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-2 border-purple-400 border-t-transparent rounded-full" />
    </div>;
  }

  if (!system) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center space-y-8 max-w-md">
        <Surface variant="glass-accent" className="p-8 rounded-2xl">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">Documentation Not Available</h1>
          <p className="text-purple-100/80 leading-relaxed mb-6">Product documentation is not currently published for this workspace.</p>
          <Link to={`/portal/${slug}`}>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Portal
            </Button>
          </Link>
        </Surface>
      </motion.div>
    </div>;
  }

  const publishedContent = system.publishedContent!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-purple-200/80 hover:text-purple-100 hover:bg-purple-500/10 mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Portal
              </Button>
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 via-pink-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/25">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent mb-2">{publishedContent.title}</h1>
              <p className="text-purple-100/80 text-xl leading-relaxed">{publishedContent.description}</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">{publishedContent.sections?.length || 0} Sections Available</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">Updated: {new Date(system.updatedAt).toLocaleDateString()}</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Hash className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-purple-100 mb-2 text-lg">Comprehensive Knowledge Base</h3>
                  <p className="text-purple-200/80 leading-relaxed">This documentation provides authoritative knowledge and reference materials. Use the navigation sidebar to explore topics systematically.</p>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="flex gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.6 }} className="w-80 flex-shrink-0">
            <div className="sticky top-6">
              <div className="border border-purple-500/20 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Table of Contents
                </h3>
                <nav className="space-y-1">
                  {publishedContent.sections?.map((section) => (
                    <button key={section.id} onClick={() => scrollToSection(section.id)} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeSection === section.id ? 'bg-purple-500/20 border-r-2 border-purple-400 text-purple-100' : 'text-purple-200/80 hover:bg-slate-700/50'}`}>
                      {section.title || `Section ${section.order}`}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }} className="flex-1 space-y-12">
            {publishedContent.sections?.map((section, index) => (
              <motion.div key={section.id} id={`section-${section.id}`} data-section-id={section.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }} className="scroll-mt-24">
                <div className="border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
                  <div className="p-6 border-b border-purple-500/20">
                    <div className="flex items-center gap-4">
                      <motion.div className="w-12 h-12 bg-gradient-to-br from-purple-400 via-pink-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ duration: 0.2 }}>
                        <span className="text-white font-bold text-lg">{section.order}</span>
                      </motion.div>
                      <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-100 to-white bg-clip-text text-transparent mb-2">{section.title}</h2>
                        <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/30 px-3 py-1">Section {section.order}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="px-8 pb-8">
                    <div className="prose prose-lg max-w-none">
                      {section.content.split('\n\n').map((paragraph, i) => (
                        <motion.p key={i} className="mb-6 text-purple-50/90 leading-relaxed last:mb-0 text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                          {paragraph.split('\n').map((line, j) => (
                            <span key={j}>{line}{j < paragraph.split('\n').length - 1 && <br />}</span>
                          ))}
                        </motion.p>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}