import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, HelpCircle, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/design-system';
import { COLORS, ICONOGRAPHY, MOTION } from '@/components/ui/design-system';
import sanitizeHtml from '../../lib/sanitizeHtml';
import WorkspaceLoader from '../../components/WorkspaceLoader';
import { useKnowledgeRoute } from '../KnowledgeRouteContext';
import { portalKnowledgeSystemsService } from '../api-service';

/**
 * FAQ Portal Page - User-Friendly Help
 */
function FAQPortalPage() {
  const { slug } = useKnowledgeRoute();
  const { t, ready } = useTranslation(['knowledgeSystems', 'portal']);
  const [publishedFAQs, setPublishedFAQs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const loadSystem = useCallback(async () => {
    if (!slug) {
      setPublishedFAQs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const faqs = await portalKnowledgeSystemsService.getAllByType(slug, 'faq');
      setPublishedFAQs(Array.isArray(faqs) ? faqs : []);
    } catch (err) {
      console.error('[FAQPortal] Failed to load FAQ system:', err);
      setError(err);
      setPublishedFAQs([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadSystem();
  }, [loadSystem]);

  // Get all FAQs
  const allFaqs = publishedFAQs || [];
  const system = allFaqs[0];

  // Get unique categories
  const categories = ['all', ...new Set(allFaqs.map(faq => faq.content?.category).filter(Boolean))];

  // Filter FAQs based on search and category
  const filteredFaqs = allFaqs.filter(faq => {
    const matchesSearch = !searchTerm ||
      faq.content?.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.content?.answer?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.content?.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!ready || loading || publishedFAQs === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
        <Surface variant="glass-secondary" className="p-8 rounded-2xl border-emerald-500/30 max-w-lg text-center">
          <MessageCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-100 mb-2">{t('faq.errorTitle', 'Unable to load FAQs')}</h2>
          <p className="text-emerald-200/80">{t('faq.errorDescription', 'Please refresh the page or try again in a moment.')}</p>
        </Surface>
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
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-4">
              {t('faq.noFAQs')}
            </h1>
            <p className="text-emerald-100/80 leading-relaxed mb-6">
              {t('faq.noFAQsDescription')}
            </p>
          </Surface>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header - Glass morphism with emerald theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-between gap-4 mb-6" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent mb-2">
                {t('faq.title')}
              </h1>
              <p className="text-emerald-100/80 text-xl leading-relaxed">{t('faq.description')}</p>
            </div>
          </motion.div>

          {/* Trust Indicators - Glass morphism badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-100 text-sm font-medium">
                {allFaqs.length} Questions Answered
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-100 text-sm font-medium">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </motion.div>

          {/* Help Center Notice - Enhanced glass card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-emerald-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-100 mb-2 text-lg">Help & Support Center</h3>
                  <p className="text-emerald-200/80 leading-relaxed">
                    Find quick answers to common questions. Use the search bar to find exactly what you need, or browse by category. We're here to help you succeed.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300/60 text-sm">Your Questions, Answered</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Search and Filter Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="max-w-4xl mx-auto px-6 mb-8"
      >
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-slate-800/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-400 w-4 h-4" />
                <Input
                  placeholder="Search questions and answers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400"
                />
              </div>

              {/* Category Filter */}
              <div className="flex gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={`${
                      selectedCategory === category
                        ? 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30'
                        : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <Tag className="w-3 h-3 mr-2" />
                    {category === 'all' ? 'All Topics' : category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-emerald-200/60">
              {filteredFaqs.length === allFaqs.length
                ? `Showing all ${allFaqs.length} questions`
                : `Found ${filteredFaqs.length} of ${allFaqs.length} questions`
              }
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* FAQ Content - Fast Scanning Layout */}
      <main className="max-w-4xl mx-auto px-6 pb-12">
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-emerald-500/30">
                <HelpCircle className="w-16 h-16 text-emerald-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-emerald-100 mb-4">
                  {searchTerm ? t('faq.noMatching') : t('faq.noFAQs')}
                </h3>
                <p className="text-emerald-200/70">
                  {searchTerm
                    ? t('faq.tryAdjusting')
                    : t('faq.noFAQsDescription')}
                </p>
              </Surface>
            </motion.div>
          ) : (
            filteredFaqs.map((faq, index) => (
              <FaqItem
                key={faq.id}
                faq={faq}
                index={index}
                isExpanded={expandedFaq === faq.id}
                onToggle={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Individual FAQ Item - Fast Scanning Design
 */
function FaqItem({ faq, index, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`border border-slate-700/50 rounded-xl overflow-hidden transition-all duration-300 ${
        isExpanded ? 'bg-emerald-500/5 border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'bg-slate-800/30 hover:bg-slate-800/50'
      }`}
    >
      {/* Question Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full text-left p-6 flex items-center justify-between hover:bg-emerald-500/5 transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
            isExpanded
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-gradient-to-br from-emerald-400 to-green-500 text-white group-hover:scale-105'
          }`}>
            <HelpCircle className={`w-5 h-5 transition-transform duration-300 ${
              isExpanded ? 'scale-110' : ''
            }`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold text-lg mb-2 transition-colors ${
              isExpanded ? 'text-emerald-100' : 'text-emerald-50 group-hover:text-emerald-100'
            }`}>
              {faq.content?.question}
            </h3>
            {faq.content?.category && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                {faq.content.category}
              </Badge>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-emerald-400"
        >
          <HelpCircle className="w-5 h-5" />
        </motion.div>
      </button>

      {/* Answer Content - Expandable */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="border-t border-emerald-500/20"
        >
          <div className="p-6 pt-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 prose prose-sm max-w-none">
                <div className="text-emerald-50/90 leading-relaxed">
                  {faq.content?.answer ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(faq.content?.answer || '') }} />
                  ) : (
                    <span className="text-slate-500 italic">No answer provided yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* FAQ Footer */}
            <div className="mt-6 pt-4 border-t border-emerald-500/10">
              <div className="flex items-center justify-between text-sm">
                <div className="text-emerald-300/60">
                  Was this helpful?
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10 h-8">
                    👍 Yes
                  </Button>
                  <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10 h-8">
                    👎 No
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default FAQPortalPage;