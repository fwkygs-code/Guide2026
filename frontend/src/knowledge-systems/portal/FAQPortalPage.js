/**
 * FAQ Portal Page - Conversational Help Interface
 *
 * Emerald-themed portal emphasizing approachability, conversation, and smart assistance.
 * Interactive Q&A with search, categories, and conversational flow.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, HelpCircle, Search, Users, Heart, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import axios from 'axios';

/**
 * FAQ Portal Page - Conversational Help Interface
 */
function FAQPortalPage() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaqs, setExpandedFaqs] = useState(new Set());

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
      const faqSystem = systems.find(s => s.type === 'faq' && s.enabled);
      setSystem(faqSystem);
    } catch (error) {
      console.error('Failed to load FAQ system:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (faqId) => {
    const newExpanded = new Set(expandedFaqs);
    if (newExpanded.has(faqId)) {
      newExpanded.delete(faqId);
    } else {
      newExpanded.add(faqId);
    }
    setExpandedFaqs(newExpanded);
  };

  // Get filtered and categorized FAQs
  const { filteredFaqs, categories } = useMemo(() => {
    if (!system?.content?.faqs) return { filteredFaqs: [], categories: [] };

    const faqs = system.content.faqs;

    // Get unique categories
    const cats = ['all', ...new Set(faqs.map(faq => faq.category).filter(Boolean))];

    // Filter FAQs based on search and category
    let filtered = faqs;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(faq =>
        faq.question.toLowerCase().includes(searchLower) ||
        faq.answer.toLowerCase().includes(searchLower) ||
        faq.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    return { filteredFaqs: filtered, categories: cats };
  }, [system, searchTerm, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full"
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
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-4">
              FAQs Not Available
            </h1>
            <p className="text-emerald-100/80 leading-relaxed mb-6">
              Frequently asked questions are not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg">
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
      {/* Header - Emerald conversational theming */}
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
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-emerald-200/80 hover:text-emerald-100 hover:bg-emerald-500/10 mb-6">
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
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent mb-2">
                {system.title}
              </h1>
              <p className="text-emerald-100/80 text-xl leading-relaxed">{system.description}</p>
            </div>
          </motion.div>

          {/* FAQ Stats & Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-100 text-sm font-medium">
                {filteredFaqs.length} Questions Available
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-100 text-sm font-medium">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-100 text-sm font-medium">
                Community Support
              </span>
            </div>
          </motion.div>

          {/* Search and Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-8 space-y-4"
          >
            {/* Search */}
            <div className="relative max-w-md">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-xl blur-lg" />
              <div className="relative bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-emerald-400" />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent text-emerald-100 placeholder-emerald-300/60 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Category Filter */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <motion.button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/40'
                        : 'bg-emerald-500/10 text-emerald-200/80 border border-emerald-500/20 hover:bg-emerald-500/15'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {category === 'all' ? 'All Questions' : category}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Help Notice */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-emerald-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-100 mb-2 text-lg">Find Answers Quickly</h3>
                  <p className="text-emerald-200/80 leading-relaxed">
                    Browse our comprehensive FAQ collection or search for specific topics. Each question is designed to provide clear, helpful answers to common inquiries and concerns.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Heart className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300/60 text-sm">Here to Help</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Conversational FAQ layout */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-6">
          {filteredFaqs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-emerald-500/30">
                <HelpCircle className="w-16 h-16 text-emerald-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-emerald-100 mb-4">
                  {searchTerm ? 'No matching questions found' : 'No FAQs Published'}
                </h3>
                <p className="text-emerald-200/70">
                  {searchTerm
                    ? 'Try adjusting your search terms or browse all questions.'
                    : 'Frequently asked questions have not been published yet. Check back for helpful answers.'
                  }
                </p>
              </Surface>
            </motion.div>
          ) : (
            filteredFaqs.map((faq, index) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                index={index}
                isExpanded={expandedFaqs.has(faq.id)}
                onToggle={() => toggleFaq(faq.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Individual FAQ Item - Conversational Display
 */
function FAQItem({ faq, index, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
    >
      <Card system="faq" animated={false} className="overflow-hidden">
        <CardHeader system="faq">
          <motion.button
            onClick={onToggle}
            className="w-full text-left flex items-start justify-between hover:bg-emerald-500/5 p-2 -m-2 rounded-lg transition-colors group"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-start gap-4 flex-1">
              <motion.div
                className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 mt-1"
                whileHover={{ rotate: 10 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-white font-bold text-sm">Q</span>
              </motion.div>
              <div className="flex-1">
                <CardTitle system="faq" className="text-lg mb-3 leading-relaxed">{faq.question}</CardTitle>
                {faq.category && (
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 px-2 py-0.5 text-xs mb-2">
                    {faq.category}
                  </Badge>
                )}
              </div>
            </div>
            <motion.div
              className="flex items-center gap-3 ml-4"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-emerald-400" />
              )}
            </motion.div>
          </motion.button>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent system="faq" className="px-8 pb-8">
                <div className="pl-14">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                      <span className="text-white font-bold text-xs">A</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-emerald-50/90 leading-relaxed text-base">
                        {faq.answer}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  {faq.tags && faq.tags.length > 0 && (
                    <div className="pl-12">
                      <div className="flex items-center gap-2 mb-3">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300/60 text-sm">Related topics:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {faq.tags.map(tag => (
                          <Badge key={tag} className="bg-emerald-500/10 text-emerald-200 border-emerald-500/20 px-2 py-0.5 text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default FAQPortalPage;