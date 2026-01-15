import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, FolderOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API = `${API_BASE.replace(/\/$/, '')}/api`;

const PortalPage = () => {
  const { slug } = useParams();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

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

  const filteredWalkthroughs = portal?.walkthroughs?.filter(wt => {
    const matchesSearch = wt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         wt.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || wt.category_ids?.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-slate-900 mb-2">Portal Not Found</h1>
          <p className="text-slate-600">The portal you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const workspace = portal.workspace;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: workspace.brand_color }}
          >
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-slate-900">{workspace.name}</h1>
            <p className="text-sm text-slate-600">Knowledge Base</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-4">
              How can we help you?
            </h1>
            <p className="text-lg text-slate-600 mb-8">Search our knowledge base or browse categories</p>
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for guides..."
                className="pl-12 h-14 text-lg rounded-xl"
                data-testid="portal-search-input"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      {portal.categories?.length > 0 && (
        <section className="py-8 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex gap-3 flex-wrap justify-center">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2"
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
              >
                All
              </Badge>
              {portal.categories.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Walkthroughs Grid */}
      <section className="py-8 px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {filteredWalkthroughs.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWalkthroughs.map((walkthrough, index) => (
                <motion.div
                  key={walkthrough.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/portal/${slug}/${walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`}>
                    <div className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all h-full">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                            {walkthrough.title}
                          </h3>
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {walkthrough.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {walkthrough.steps?.length || 0} steps
                        </Badge>
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
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">Powered by InterGuide</p>
        </div>
      </footer>
    </div>
  );
};

export default PortalPage;