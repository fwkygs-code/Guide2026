import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, FolderOpen, Search, Lock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { normalizeImageUrl } from '../lib/utils';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

const PortalPage = ({ isEmbedded = false }) => {
  const { slug } = useParams();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const isLoggedIn = !!localStorage.getItem('token');
  
  // Detect if we're in an iframe
  const inIframe = isEmbedded || window.self !== window.top;

  useEffect(() => {
    fetchPortal();
  }, [slug]);

  const fetchPortal = async () => {
    try {
      const response = await axios.get(`${API}/portal/${slug}`);
      setPortal(response.data);
    } catch (error) {
      toast.error('Portal not found');
    } finally {
      setLoading(false);
    }
  };

  // Organize categories into parent/children structure
  const categoryTree = useMemo(() => {
    if (!portal?.categories) return [];
    const parents = portal.categories.filter(c => !c.parent_id);
    return parents.map(parent => ({
      ...parent,
      children: portal.categories.filter(c => c.parent_id === parent.id)
    }));
  }, [portal?.categories]);

  // Get all category IDs (including children) when a parent is selected
  const getCategoryIds = (categoryId) => {
    if (!categoryId) return null;
    const category = portal.categories.find(c => c.id === categoryId);
    if (!category) return [categoryId];
    const children = portal.categories.filter(c => c.parent_id === categoryId).map(c => c.id);
    return [categoryId, ...children];
  };

  const filteredWalkthroughs = portal?.walkthroughs?.filter(wt => {
    const matchesSearch = wt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         wt.description?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!selectedCategory) return matchesSearch;
    const categoryIds = getCategoryIds(selectedCategory);
    return matchesSearch && categoryIds && wt.category_ids?.some(id => categoryIds.includes(id));
  }) || [];

  // Group walkthroughs by category
  const walkthroughsByCategory = useMemo(() => {
    const grouped = {};
    categoryTree.forEach(cat => {
      const catIds = [cat.id, ...cat.children.map(c => c.id)];
      const items = filteredWalkthroughs.filter(wt => 
        wt.category_ids?.some(id => catIds.includes(id))
      );
      if (items.length > 0) {
        grouped[cat.id] = { category: cat, walkthroughs: items };
      }
    });
    // Uncategorized
    const uncategorized = filteredWalkthroughs.filter(wt => 
      !wt.category_ids || wt.category_ids.length === 0
    );
    if (uncategorized.length > 0) {
      grouped['_uncategorized'] = { category: null, walkthroughs: uncategorized };
    }
    return grouped;
  }, [categoryTree, filteredWalkthroughs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-slate-900 mb-2">Portal Not Found</h1>
          <p className="text-slate-600">The portal you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const workspace = portal.workspace;
  const showByCategory = selectedCategory === null && categoryTree.length > 0;

  // Get portal styling from workspace
  const portalPalette = workspace.portal_palette || {};
  const primaryColor = portalPalette.primary || workspace.brand_color || '#4f46e5';
  const secondaryColor = portalPalette.secondary || '#8b5cf6';
  const accentColor = portalPalette.accent || '#10b981';
  const backgroundStyle = workspace.portal_background_url 
    ? { backgroundImage: `url(${normalizeImageUrl(workspace.portal_background_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : {};

  return (
      <div className={`min-h-screen ${inIframe ? 'iframe-mode' : ''}`} style={backgroundStyle}>
      {/* Overlay for background image readability */}
      {workspace.portal_background_url && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm -z-10" />
      )}
      
      {/* Header - Hide in iframe mode */}
      {!inIframe && (
      <header className="glass border-b border-slate-200/50 sticky top-0 z-50 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {workspace.logo ? (
              <img src={normalizeImageUrl(workspace.logo)} alt={workspace.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-heading font-bold text-slate-900 truncate">{workspace.name}</h1>
              <p className="text-sm text-slate-600">Knowledge Base</p>
            </div>
          </div>

          {isLoggedIn && (
            <Link to="/dashboard" data-testid="back-to-dashboard-link">
              <Button variant="outline" size="sm">
                Admin Dashboard
              </Button>
            </Link>
          )}
        </div>
      </header>
      )}

      {/* Hero Section - Compact in iframe */}
      <section className={`${inIframe ? 'py-8' : 'py-16'} px-6 relative`} style={{ backgroundColor: workspace.portal_background_url ? 'transparent' : 'white' }}>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            {/* 3D Glass Bubble Container */}
            <div className="glass rounded-3xl p-8 md:p-12 backdrop-blur-xl bg-white/80 border border-white/50 shadow-2xl transform hover:scale-[1.02] transition-transform duration-300"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
                   boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
                 }}>
              <h1 className="text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-4 drop-shadow-sm">
                How can we help you?
              </h1>
              <p className="text-lg text-slate-700 mb-8 font-medium">Search our knowledge base or browse categories</p>
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5 z-10" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for guides..."
                  className="pl-12 h-14 text-lg rounded-xl shadow-lg border-slate-200/50 bg-white/90 backdrop-blur-sm"
                  data-testid="portal-search-input"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Filter */}
      {categoryTree.length > 0 && (
        <section className="py-6 px-6 relative">
          <div className="max-w-7xl mx-auto">
            {/* 3D Glass Bubble for Categories */}
            <div className="glass rounded-2xl p-4 md:p-6 backdrop-blur-xl bg-white/80 border border-white/50 shadow-xl"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 100%)',
                   boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
                 }}>
              <div className="flex gap-3 flex-wrap justify-center">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2 text-sm font-medium transition-all hover:scale-105"
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
                style={selectedCategory === null ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
              >
                All
              </Badge>
              {categoryTree.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2 text-sm font-medium transition-all hover:scale-105"
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                  style={selectedCategory === category.id ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                >
                  {category.name}
                  {category.children.length > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">({category.children.length})</span>
                  )}
                </Badge>
              ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Walkthroughs - Organized by Category */}
      <section className="py-12 px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {showByCategory ? (
            // Show organized by categories
            Object.keys(walkthroughsByCategory).length > 0 ? (
              <div className="space-y-12">
                {Object.entries(walkthroughsByCategory).map(([key, { category, walkthroughs }], sectionIndex) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIndex * 0.1 }}
                  >
                    {category && (
                      <div className="glass rounded-2xl p-4 mb-6 backdrop-blur-xl bg-white/80 border border-white/50 shadow-lg inline-block"
                           style={{
                             background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 100%)',
                             boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
                           }}>
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-6 h-6" style={{ color: primaryColor }} />
                          <h2 className="text-2xl font-heading font-bold text-slate-900">{category.name}</h2>
                          {category.description && (
                            <p className="text-sm text-slate-700 font-medium">{category.description}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {category?.children.length > 0 && (
                      <div className="mb-4 flex gap-2 flex-wrap">
                        {category.children.map(subCat => (
                          <Badge key={subCat.id} variant="secondary" className="text-xs">
                            {subCat.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {walkthroughs.map((walkthrough, index) => (
                        <motion.div
                          key={walkthrough.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (sectionIndex * 0.1) + (index * 0.05) }}
                        >
                          <Link to={`/portal/${slug}/${walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`}>
                            <div className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all h-full border border-slate-200/50 hover:border-primary/30 group">
                              <div className="flex items-start gap-4 mb-4">
                                {walkthrough.icon_url ? (
                                  <img
                                    src={normalizeImageUrl(walkthrough.icon_url)}
                                    alt={walkthrough.title}
                                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-200 group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      console.error('Failed to load icon:', walkthrough.icon_url);
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className="w-16 h-16 rounded-2xl backdrop-blur-sm border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                                    style={{ 
                                      backgroundColor: `${primaryColor}15`, 
                                      borderColor: `${primaryColor}30` 
                                    }}
                                  >
                                    <BookOpen className="w-8 h-8" style={{ color: primaryColor }} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 
                                    className="text-lg font-heading font-semibold text-slate-900 mb-2 transition-colors"
                                    style={{ '--hover-color': primaryColor }}
                                    onMouseEnter={(e) => e.target.style.color = primaryColor}
                                    onMouseLeave={(e) => e.target.style.color = ''}
                                  >
                                    {walkthrough.title}
                                  </h3>
                                  <p className="text-sm text-slate-600 line-clamp-2">
                                    {walkthrough.description || 'No description'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {walkthrough.steps?.length || 0} steps
                                  </Badge>
                                  {walkthrough.privacy === 'password' && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      Locked
                                    </Badge>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-slate-600">Try adjusting your search or filters</p>
              </div>
            )
          ) : (
            // Show flat list when category is selected
            filteredWalkthroughs.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWalkthroughs.map((walkthrough, index) => (
                  <motion.div
                    key={walkthrough.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={`/portal/${slug}/${walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`}>
                      <div className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all h-full border border-slate-200/50 hover:border-primary/30 group">
                        <div className="flex items-start gap-4 mb-4">
                          {walkthrough.icon_url ? (
                            <img
                              src={walkthrough.icon_url}
                              alt={walkthrough.title}
                              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-200 group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                              <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-heading font-semibold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                              {walkthrough.title}
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {walkthrough.description || 'No description'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {walkthrough.steps?.length || 0} steps
                            </Badge>
                            {walkthrough.privacy === 'password' && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-slate-600">Try adjusting your search or filters</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* Footer - Hide in iframe mode */}
      {!inIframe && (
      <footer className="bg-slate-900 text-slate-300 py-8 px-6 mt-20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">Powered by InterGuide</p>
        </div>
      </footer>
      )}
    </div>
  );
};

export default PortalPage;
