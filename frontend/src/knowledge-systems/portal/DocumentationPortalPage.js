import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, ChevronRight, Hash, Clock, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { portalKnowledgeSystemsService } from '../api-service';

/**
 * Documentation Portal Page - Knowledge Repository
 */
function DocumentationPortalPage() {
  const { slug } = useParams();
  const [publishedDocumentation, setPublishedDocumentation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null);
  const [activeSubsection, setActiveSubsection] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      const documentation = await portalKnowledgeSystemsService.getAllByType(slug, 'documentation');
      setPublishedDocumentation(documentation);
    } catch (error) {
      console.error('Failed to load documentation system:', error);
    } finally {
      setLoading(false);
    }
  };
    } catch (error) {
      console.error('Failed to load documentation system:', error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to section when navigation is clicked
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Track scroll position to highlight active section
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const sections = contentRef.current.querySelectorAll('[data-section-id]');
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top + scrollTop;
        const sectionHeight = rect.height;

        if (scrollTop >= sectionTop - windowHeight / 2 &&
            scrollTop < sectionTop + sectionHeight - windowHeight / 2) {
          setActiveSection(section.getAttribute('data-section-id'));
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [system]);

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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              Documentation Not Available
            </h1>
            <p className="text-purple-100/80 leading-relaxed mb-6">
              Product documentation is not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg">
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
      {/* Header - Glass morphism with purple theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-slate-900/80 backdrop-blur-xl" />
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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 via-pink-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/25">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                Documentation
              </h1>
              <p className="text-purple-100/80 text-xl leading-relaxed">Comprehensive technical documentation and knowledge base resources.</p>
            </div>
          </motion.div>

          {/* Trust Indicators - Glass morphism badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">
                {publishedDocumentation.length} Documents Available
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-purple-100 text-sm font-medium">
              </span>
            </div>
          </motion.div>

          {/* Knowledge Repository Notice - Enhanced glass card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Hash className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-purple-100 mb-2 text-lg">Comprehensive Knowledge Base</h3>
                  <p className="text-purple-200/80 leading-relaxed">
                    This documentation provides authoritative knowledge and reference materials. Use the navigation sidebar to explore topics systematically and find the information you need.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300/60 text-sm">Official Documentation Repository</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content with Navigation */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="flex gap-8">
          {/* Navigation Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-80 flex-shrink-0"
          >
            <div className="sticky top-6">
              <DocumentationNavigation
                documents={publishedDocumentation}
                activeSection={activeSection}
                onSectionClick={scrollToSection}
              />
            </div>
          </motion.div>

          {/* Content Area */}
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex-1 space-y-12"
          >
            {publishedDocumentation.length === 0 ? (
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-purple-500/30">
                <BookOpen className="w-16 h-16 text-purple-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-purple-100 mb-4">No Documentation Published</h3>
                <p className="text-purple-200/70">
                  Documentation content has not been published yet. Check back later for comprehensive knowledge materials.
                </p>
              </Surface>
            ) : (
              publishedDocumentation.map((docData, index) => (
                <DocumentationSection
                  key={docData.meta.id}
                  document={docData}
                  index={index}
                  isActive={activeSection === docData.meta.id}
                />
              ))
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Documentation Navigation Sidebar
 */
function DocumentationNavigation({ sections, activeSection, onSectionClick }) {
  return (
    <Card className="border-purple-500/20 bg-slate-800/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Table of Contents
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <nav className="space-y-1">
          {sections.map((docData) => (
            <div key={docData.meta.id}>
              <button
                onClick={() => onSectionClick(docData.meta.id)}
                className={`w-full text-left px-4 py-3 hover:bg-purple-500/10 transition-colors ${
                  activeSection === docData.meta.id
                    ? 'bg-purple-500/20 border-r-2 border-purple-400 text-purple-100'
                    : 'text-purple-200/80 hover:text-purple-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    activeSection === section.id ? 'rotate-90 text-purple-400' : 'text-purple-400/60'
                  }`} />
                  <span className="font-medium">{docData.meta.title || `Document ${index + 1}`}</span>
                </div>
              </button>

              {/* Subsections */}
              {docData.content?.subsections && docData.content.subsections.length > 0 && (
                <div className={`ml-8 space-y-1 ${activeSection === docData.id ? 'block' : 'hidden'}`}>
                  {docData.content.subsections.map((subsection) => (
                    <button
                      key={subsection.id}
                      onClick={() => onSectionClick(docData.id)}
                      className="w-full text-left px-4 py-2 text-sm text-purple-300/60 hover:text-purple-200 hover:bg-purple-500/5 transition-colors"
                    >
                      {subsection.title || `Subsection ${subsection.order}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

/**
 * Individual Documentation Section - Hierarchical Display
 */
function DocumentationSection({ document, index, isActive }) {
  return (
    <motion.div
      id={`section-${document.id}`}
      data-section-id={document.id}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="scroll-mt-24"
    >
      <Card system="documentation" animated={false} className="overflow-hidden">
        <CardHeader system="documentation" className="pb-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-12 h-12 bg-gradient-to-br from-purple-400 via-pink-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-white font-bold text-lg">{index + 1}</span>
            </motion.div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-100 to-white bg-clip-text text-transparent mb-2">
                {document.title}
              </h2>
              <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/30 px-3 py-1">
                Document {index + 1}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent system="documentation" className="px-8 pb-8">
          {/* Main Section Content */}
          {document.content?.content && (
            <div className="prose prose-lg max-w-none mb-12">
              <div className="text-purple-50/90 leading-relaxed text-lg">
                {document.content.content.split('\n\n').map((paragraph, i) => (
                  <motion.p
                    key={i}
                    className="mb-6 last:mb-0"
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
            </div>
          )}

          {/* Subsections */}
          {document.content?.subsections && document.content.subsections.length > 0 && (
            <div className="space-y-8">
              <div className="border-t border-purple-500/20 pt-8">
                <h3 className="text-xl font-semibold text-purple-100 mb-6">Detailed Topics</h3>
                <div className="space-y-6">
                  {document.content.subsections.map((subsection, subIndex) => (
                    <DocumentationSubsection
                      key={subsection.id}
                      subsection={subsection}
                      index={subIndex}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Documentation Subsection - Nested Content
 */
function DocumentationSubsection({ subsection, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="border-l-4 border-purple-500/30 pl-6 py-4"
    >
      <h4 className="text-xl font-semibold text-purple-200 mb-4 flex items-center gap-3">
        <div className="w-6 h-6 bg-gradient-to-br from-purple-400/50 to-pink-500/50 rounded-full flex items-center justify-center text-purple-200 font-bold text-sm">
          {subsection.order}
        </div>
        {subsection.title}
      </h4>

      {subsection.content && (
        <div className="prose prose-base max-w-none">
          <div className="text-purple-100/80 leading-relaxed">
            {subsection.content.split('\n\n').map((paragraph, i) => (
              <motion.p
                key={i}
                className="mb-4 last:mb-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
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
        </div>
      )}
    </motion.div>
  );
}

export default DocumentationPortalPage;