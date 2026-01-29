import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, FolderOpen, Search, Lock, ChevronRight, Phone, Clock, MessageCircle, HelpCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiClient, getBackendUrl } from '../lib/api';
import { normalizeImageUrl } from '../lib/utils';
import LanguageSwitcher from '../components/LanguageSwitcher';
import KnowledgeSystemsNavigationBar from '../knowledge-systems/portal/KnowledgeSystemsNavigationBar';
import { AppShell } from '../components/ui/design-system';
import WorkspaceLoader from '../components/WorkspaceLoader';
import { portalKnowledgeSystemsService } from '../knowledge-systems/api-service';


const PortalPage = ({ isEmbedded = false }) => {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const [selectedCategoryForChat, setSelectedCategoryForChat] = useState(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [knowledgeSystemCounts, setKnowledgeSystemCounts] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const location = useLocation();
  const isEmbedParam = new URLSearchParams(location.search).get('embed') === '1';
  // Detect if we're in an iframe
  const inIframe = isEmbedded || isEmbedParam || window.self !== window.top;

  useEffect(() => {
    fetchPortal();
  }, [slug]);

  useEffect(() => {
    if (!isEmbedParam) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isEmbedParam]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get(`/auth/me`, {
          validateStatus: (status) => status < 500
        });
        setIsLoggedIn(response.status === 200);
      } catch (error) {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  // Update page title, favicon, and meta tags when portal data loads
  useEffect(() => {
    if (portal?.workspace?.name) {
      const workspace = portal.workspace;
      const workspaceName = workspace.name;
      const logoUrl = workspace.logo ? normalizeImageUrl(workspace.logo) : null;
      
      // Update page title
      document.title = `InterGuide – ${workspaceName}`;
      
      // Update favicon to workspace logo (if available)
      if (logoUrl) {
        let favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.setAttribute('rel', 'icon');
          document.head.appendChild(favicon);
        }
        favicon.setAttribute('href', logoUrl);
        favicon.setAttribute('type', logoUrl.includes('.svg') ? 'image/svg+xml' : 'image/png');
        
        // Also update apple-touch-icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (!appleIcon) {
          appleIcon = document.createElement('link');
          appleIcon.setAttribute('rel', 'apple-touch-icon');
          document.head.appendChild(appleIcon);
        }
        appleIcon.setAttribute('href', logoUrl);
      }
      
      // Update meta tags for Open Graph (for social sharing)
      const updateMetaTag = (property, content) => {
        let meta = document.querySelector(`meta[property="${property}"]`) || 
                   document.querySelector(`meta[name="${property}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
          } else {
            meta.setAttribute('name', property);
          }
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };
      
      // Use backend URL for sharing (WhatsApp crawlers need backend route)
      const portalUrl = `${getBackendUrl()}/portal/${slug}`;
      const ogImageUrl = logoUrl || `${window.location.origin}/og-image.png`;
      
      // Update Open Graph tags
      updateMetaTag('og:title', `InterGuide – ${workspaceName}`);
      updateMetaTag('og:description', `InterGuide – ${workspaceName}`);
      updateMetaTag('og:image', ogImageUrl);
      updateMetaTag('og:image:secure_url', ogImageUrl);
      updateMetaTag('og:url', portalUrl);
      
      // Update Twitter tags
      updateMetaTag('twitter:title', `InterGuide – ${workspaceName}`);
      updateMetaTag('twitter:description', `InterGuide – ${workspaceName}`);
      updateMetaTag('twitter:image', ogImageUrl);
      
      // Update standard meta tags
      updateMetaTag('title', `InterGuide – ${workspaceName}`);
      const descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) {
        descMeta.setAttribute('content', `InterGuide – ${workspaceName}`);
      }
    }
    
    // Cleanup: reset title and favicon when component unmounts
    return () => {
      document.title = 'InterGuide';
      // Don't reset favicon on unmount - let it persist or reset on next page load
    };
  }, [portal, slug]);

  const fetchPortal = async () => {
    try {
      const response = await apiClient.get(`/portal/${slug}`);
      setPortal(response.data);
      // Debug: Log workspace logo
      if (response.data?.workspace?.logo) {
        console.log('Workspace logo URL:', response.data.workspace.logo);
        console.log('Normalized logo URL:', normalizeImageUrl(response.data.workspace.logo));
      } else {
        console.log('No workspace logo found in response');
      }
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

  useEffect(() => {
    if (!slug) return;
    
    const loadCounts = async () => {
      try {
        const [policies, procedures, documentation, faqs, decisionTrees] = await Promise.all([
          portalKnowledgeSystemsService.getAllByType(slug, 'policy'),
          portalKnowledgeSystemsService.getAllByType(slug, 'procedure'),
          portalKnowledgeSystemsService.getAllByType(slug, 'documentation'),
          portalKnowledgeSystemsService.getAllByType(slug, 'faq'),
          portalKnowledgeSystemsService.getAllByType(slug, 'decision_tree')
        ]);
        
        setKnowledgeSystemCounts({
          policy: Array.isArray(policies) ? policies.length : 0,
          procedure: Array.isArray(procedures) ? procedures.length : 0,
          documentation: Array.isArray(documentation) ? documentation.length : 0,
          faq: Array.isArray(faqs) ? faqs.length : 0,
          'decision-tree': Array.isArray(decisionTrees) ? decisionTrees.length : 0
        });
      } catch (error) {
        console.error('[PortalPage] Failed to load knowledge system counts:', error);
        setKnowledgeSystemCounts({});
      }
    };
    
    loadCounts();
  }, [slug]);

  const knowledgeSystemsMenu = useMemo(() => {
    if (!slug) return [];
    const systems = [
      { key: 'policy', label: t('portal.knowledgeSystems.labels.policies', { defaultValue: 'Policies' }), path: `/portal/${slug}/knowledge/policies`, count: knowledgeSystemCounts.policy || 0 },
      { key: 'procedure', label: t('portal.knowledgeSystems.labels.procedures', { defaultValue: 'Procedures' }), path: `/portal/${slug}/knowledge/procedures`, count: knowledgeSystemCounts.procedure || 0 },
      { key: 'documentation', label: t('portal.knowledgeSystems.labels.documentation', { defaultValue: 'Documentation' }), path: `/portal/${slug}/knowledge/documentation`, count: knowledgeSystemCounts.documentation || 0 },
      { key: 'faq', label: t('portal.knowledgeSystems.labels.faqs', { defaultValue: 'FAQs' }), path: `/portal/${slug}/knowledge/faqs`, count: knowledgeSystemCounts.faq || 0 },
      { key: 'decision-tree', label: t('portal.knowledgeSystems.labels.decisions', { defaultValue: 'Decision Trees' }), path: `/portal/${slug}/knowledge/decisions`, count: knowledgeSystemCounts['decision-tree'] || 0 }
    ];
    return systems.filter(system => system.count > 0);
  }, [slug, t, knowledgeSystemCounts]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <WorkspaceLoader size={160} />
        </div>
      </AppShell>
    );
  }

  if (!portal) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Portal Not Found</h1>
            <p className="text-muted-foreground">The portal you're looking for doesn't exist.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const workspace = portal.workspace;
  const showByCategory = selectedCategory === null && categoryTree.length > 0;

  const portalIdRaw = new URLSearchParams(location.search).get('portalId')
    || new URLSearchParams(location.search).get('portal')
    || workspace?.portal_id
    || workspace?.portalId
    || 'tenant';
  const portalIdNormalized = portalIdRaw.toLowerCase() === 'integration'
    ? 'integrations'
    : portalIdRaw.toLowerCase();

  const portalConfig = {
    admin: {
      title: t('portal.headers.admin.title'),
      description: t('portal.headers.admin.description'),
      headerImage: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
          <rect width="720" height="420" fill="#0f172a"/>
          <rect x="48" y="48" width="624" height="324" rx="24" fill="#111827" stroke="#334155" stroke-width="2"/>
          <rect x="80" y="92" width="180" height="96" rx="12" fill="#1f2937"/>
          <rect x="280" y="92" width="160" height="140" rx="12" fill="#1f2937"/>
          <rect x="460" y="92" width="200" height="220" rx="12" fill="#1f2937"/>
          <circle cx="170" cy="280" r="40" fill="#0ea5e9"/>
          <circle cx="330" cy="300" r="18" fill="#22c55e"/>
          <circle cx="380" cy="300" r="18" fill="#f97316"/>
          <path d="M170 240 L330 300 L380 300" stroke="#38bdf8" stroke-width="4" fill="none"/>
          <path d="M330 300 L560 200" stroke="#38bdf8" stroke-width="4" fill="none"/>
          <circle cx="560" cy="200" r="24" fill="#38bdf8"/>
        </svg>`
      )}`
    },
    tenant: {
      title: t('portal.headers.tenant.title'),
      description: t('portal.headers.tenant.description'),
      headerImage: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
          <rect width="720" height="420" fill="#0b1324"/>
          <rect x="60" y="60" width="600" height="300" rx="28" fill="#111827"/>
          <rect x="100" y="110" width="520" height="52" rx="12" fill="#1f2937"/>
          <rect x="100" y="182" width="420" height="52" rx="12" fill="#1f2937"/>
          <rect x="100" y="254" width="320" height="52" rx="12" fill="#1f2937"/>
          <circle cx="130" cy="136" r="14" fill="#22c55e"/>
          <circle cx="130" cy="208" r="14" fill="#38bdf8"/>
          <circle cx="130" cy="280" r="14" fill="#f59e0b"/>
          <path d="M160 136 H590" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
          <path d="M160 208 H490" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
          <path d="M160 280 H390" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
        </svg>`
      )}`
    },
    knowledge: {
      title: t('portal.headers.knowledge.title'),
      description: t('portal.headers.knowledge.description'),
      headerImage: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
          <rect width="720" height="420" fill="#0b1120"/>
          <rect x="80" y="84" width="220" height="252" rx="16" fill="#1e293b"/>
          <rect x="250" y="84" width="220" height="252" rx="16" fill="#1f2937"/>
          <rect x="420" y="84" width="220" height="252" rx="16" fill="#111827"/>
          <path d="M110 130 H280" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
          <path d="M110 170 H260" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <path d="M280 130 H450" stroke="#a855f7" stroke-width="6" stroke-linecap="round"/>
          <path d="M280 170 H430" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <path d="M450 130 H620" stroke="#f97316" stroke-width="6" stroke-linecap="round"/>
          <path d="M450 170 H600" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <circle cx="190" cy="260" r="26" fill="#38bdf8"/>
          <circle cx="360" cy="260" r="26" fill="#a855f7"/>
          <circle cx="530" cy="260" r="26" fill="#f97316"/>
        </svg>`
      )}`
    },
    integrations: {
      title: t('portal.headers.integrations.title'),
      description: t('portal.headers.integrations.description'),
      headerImage: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
          <rect width="720" height="420" fill="#0f172a"/>
          <rect x="60" y="60" width="600" height="300" rx="28" fill="#0b1220" stroke="#1f2937" stroke-width="2"/>
          <circle cx="160" cy="210" r="50" fill="#22c55e"/>
          <circle cx="360" cy="140" r="44" fill="#38bdf8"/>
          <circle cx="560" cy="250" r="58" fill="#f97316"/>
          <path d="M210 210 L316 156" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <path d="M404 156 L512 228" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <path d="M220 240 L520 264" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
          <rect x="330" y="250" width="70" height="40" rx="10" fill="#1f2937"/>
          <rect x="320" y="102" width="80" height="36" rx="10" fill="#1f2937"/>
        </svg>`
      )}`
    }
  };

  const portalDetails = portalConfig[portalIdNormalized] || portalConfig.tenant;

  // Get portal styling from workspace
  const portalPalette = workspace.portal_palette || {};
  const primaryColor = portalPalette.primary || workspace.brand_color || '#4f46e5';
  const secondaryColor = portalPalette.secondary || '#8b5cf6';
  const accentColor = portalPalette.accent || '#10b981';
  const backgroundStyle = workspace.portal_background_url 
    ? { backgroundImage: `url(${normalizeImageUrl(workspace.portal_background_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : {};

  return (
      <div className={`min-h-screen bg-background ${inIframe ? 'iframe-mode' : ''}`} style={backgroundStyle}>
      {/* Overlay for background image readability */}
      {workspace.portal_background_url && (
        <div className="fixed inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 -z-10" />
      )}
      
      {/* Header - Hide in iframe mode */}
      {!inIframe && (
      <header className="glass border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          {/* Top Row: Logo, Name, and Action Buttons */}
          <div className="flex items-center justify-between gap-3 sm:gap-6 mb-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
              {workspace.logo ? (
                <img 
                  src={normalizeImageUrl(workspace.logo)} 
                  alt={workspace.name} 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => {
                    console.error('Failed to load workspace logo:', workspace.logo);
                    e.target.style.display = 'none';
                    // Show fallback initial circle
                    const fallback = e.target.nextElementSibling;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              {!workspace.logo && (
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-shrink">
                <h1 className="text-base sm:text-xl font-heading font-bold text-foreground truncate">{workspace.name}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">{portalDetails.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Language Switcher */}
              <LanguageSwitcher />
              
              {/* Portal External Links - Hide on mobile if too many */}
              {workspace.portal_links && workspace.portal_links.length > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  {workspace.portal_links.map((link, index) => (
                    link.label && link.url && (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all hover:scale-105 text-white"
                        style={{
                          backgroundColor: primaryColor,
                          textDecoration: 'none'
                        }}
                      >
                        {link.label}
                      </a>
                    )
                  ))}
                </div>
              )}

              {isLoggedIn && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAdminDialogOpen(true)}
                  data-testid="back-to-dashboard-link"
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">Admin Dashboard</span>
                  <span className="sm:hidden">Admin</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Row: Contact Information - Responsive */}
          {(workspace.portal_phone || workspace.portal_working_hours || workspace.portal_whatsapp) && (
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs sm:text-sm text-muted-foreground border-t border-border pt-3">
              {workspace.portal_phone && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: primaryColor }} />
                  <a href={`tel:${workspace.portal_phone.replace(/\s/g, '')}`} className="hover:text-foreground transition-colors truncate">
                    {workspace.portal_phone}
                  </a>
                </div>
              )}
              {workspace.portal_working_hours && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: primaryColor }} />
                  <span className="truncate">{workspace.portal_working_hours}</span>
                </div>
              )}
              {workspace.portal_whatsapp && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: primaryColor }} />
                  <a 
                    href={workspace.portal_whatsapp} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors truncate"
                  >
                    {t('portal.whatsapp')}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      )}

      {/* Portal-Specific Header */}
      <section className={`${inIframe ? 'py-8' : 'py-16'} px-6 relative`}>
        <div className="max-w-6xl mx-auto">
          {portalIdNormalized === 'admin' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal.headers.admin.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-6">{portalDetails.description}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{t('portal.headers.admin.badgeSystemHealth')}</Badge>
                      <Badge variant="secondary">{t('portal.headers.admin.badgeAuditReady')}</Badge>
                      <Badge variant="secondary">{t('portal.headers.admin.badgeIntegrationControl')}</Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt="Admin control center overview" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'tenant' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt="Guided journey checklist" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal.headers.tenant.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-8">{portalDetails.description}</p>
                    <div className="relative max-w-2xl">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('portal.searchPlaceholder')}
                        className="pl-12 h-14 text-lg rounded-xl glass shadow-lg"
                        data-testid="portal-search-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'knowledge' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal.headers.knowledge.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-8">{portalDetails.description}</p>
                    <div className="relative max-w-2xl">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('portal.searchPlaceholder')}
                        className="pl-12 h-14 text-lg rounded-xl glass shadow-lg"
                        data-testid="portal-search-input"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt="Knowledge maps and layered documents" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'integrations' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt="Connected apps and automation flows" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal.headers.integrations.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-6">{portalDetails.description}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{t('portal.headers.integrations.badgeApiReady')}</Badge>
                      <Badge variant="secondary">{t('portal.headers.integrations.badgeWorkflowAutomation')}</Badge>
                      <Badge variant="secondary">{t('portal.headers.integrations.badgeSyncHealth')}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Categories Filter */}
      {categoryTree.length > 0 && (
        <section className="py-6 px-6 relative">
          <div className="max-w-7xl mx-auto">
            {/* 3D Glass Bubble for Categories */}
            <div className="glass rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="flex gap-3 flex-wrap justify-center">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground transition-all hover:scale-105"
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
                style={selectedCategory === null ? { backgroundColor: primaryColor, borderColor: primaryColor, color: 'white' } : { color: primaryColor }}
              >
                {t('common.all')}
              </Badge>
              {categoryTree.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground transition-all hover:scale-105"
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                  style={selectedCategory === category.id ? { backgroundColor: primaryColor, borderColor: primaryColor, color: 'white' } : { color: primaryColor }}
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
                      <div className="glass rounded-2xl p-4 mb-6 shadow-lg">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <FolderOpen className="w-6 h-6" style={{ color: primaryColor }} />
                            <div>
                              <h2 className="text-2xl font-heading font-bold text-foreground">{category.name}</h2>
                              {category.description && (
                                <p className="text-sm text-muted-foreground font-medium mt-1">{category.description}</p>
                              )}
                            </div>
                          </div>
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
                          <Link to={`/portal/${slug}/${walkthrough.slug || walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`}>
                            <div className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all h-full border border-border hover:border-primary/30 group">
                              <div className="flex items-start gap-4 mb-4">
                                {walkthrough.icon_url ? (
                                  <img
                                    src={normalizeImageUrl(walkthrough.icon_url)}
                                    alt={walkthrough.title}
                                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-border group-hover:scale-105 transition-transform"
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
                                    className="text-lg font-heading font-semibold text-foreground mb-2 transition-colors"
                                    style={{ '--hover-color': primaryColor }}
                                    onMouseEnter={(e) => e.target.style.color = primaryColor}
                                    onMouseLeave={(e) => e.target.style.color = ''}
                                  >
                                    {walkthrough.title}
                                  </h3>
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {walkthrough.description || t('walkthrough.noDescription')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-4 border-t border-border">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs text-foreground border-border">
                                    {walkthrough.steps?.length || 0} steps
                                  </Badge>
                                  {walkthrough.privacy === 'password' && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      Locked
                                    </Badge>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
                <h3 className="text-xl font-heading font-semibold text-white mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-slate-300">Try adjusting your search or filters</p>
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
                      <div className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all h-full border border-border hover:border-primary/30 group">
                        <div className="flex items-start gap-4 mb-4">
                          {walkthrough.icon_url ? (
                            <img
                              src={walkthrough.icon_url}
                              alt={walkthrough.title}
                              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-border group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                              <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-heading font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                              {walkthrough.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {walkthrough.description || t('walkthrough.noDescription')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs text-foreground border-border">
                              {walkthrough.steps?.length || 0} steps
                            </Badge>
                            {walkthrough.privacy === 'password' && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* Knowledge Systems Menu - Hide in iframe mode */}
      {!inIframe && (
        <section className="py-8 px-6 mt-20">
          <div className="max-w-7xl mx-auto">
            <div className="glass rounded-2xl border border-border px-6 py-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">{t('portal.knowledgeSystems.title', { defaultValue: 'Knowledge Systems' })}</h3>
                  <p className="text-sm text-muted-foreground">{t('portal.knowledgeSystems.description', { defaultValue: 'Browse published policies, procedures, docs, FAQs, and decisions.' })}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('portal.knowledgeSystems.available', { defaultValue: '{{count}} available', count: knowledgeSystemsMenu.length })}
                </div>
              </div>
              {knowledgeSystemsMenu.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('portal.knowledgeSystems.none', { defaultValue: 'No knowledge systems published yet.' })}</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {knowledgeSystemsMenu.map(system => (
                    <Link key={system.key} to={system.path}>
                      <Button variant="outline" size="sm">
                        {system.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Floating Help Button */}
      <AnimatePresence>
        {!helpChatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Get categories with NotebookLM URLs
              const categoriesWithChat = portal?.categories?.filter(c => c.notebooklm_url) || [];
              if (categoriesWithChat.length === 0) {
                toast.info('No chat support available for any category.');
                return;
              }
              if (categoriesWithChat.length === 1) {
                // If only one category has chat, open it directly
                const category = categoriesWithChat[0];
                setSelectedCategoryForChat(category);
                setHelpChatOpen(true);
                // Open NotebookLM in a new popup window (not iframe - Google blocks iframes)
                const popup = window.open(
                  category.notebooklm_url,
                  'gemini_chat',
                  'width=800,height=700,resizable=yes,scrollbars=yes,status=yes,location=yes,toolbar=no,menubar=no'
                );
                // Store reference to close it later
                if (popup) {
                  window.chatWindow = popup;
                  // Focus the popup
                  popup.focus();
                } else {
                  toast.error('Popup blocked. Please allow popups for this site and try again.');
                }
              } else {
                // Multiple categories - show selection dialog
                setCategorySelectOpen(true);
              }
            }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full font-medium shadow-2xl hover:shadow-3xl transition-all text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <HelpCircle className="w-5 h-5" />
            <span>{t('portal.needHelp')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Category Selection Dialog */}
      <Dialog open={categorySelectOpen} onOpenChange={setCategorySelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('portal.selectCategory')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {portal?.categories?.filter(c => c.notebooklm_url).map((category) => (
              <Button
                key={category.id}
                variant="secondary"
                className="w-full justify-start h-auto py-3 px-4"
                onClick={() => {
                  setSelectedCategoryForChat(category);
                  setCategorySelectOpen(false);
                  setHelpChatOpen(true);
                  // Open NotebookLM in a new popup window (not iframe - Google blocks iframes)
                  const popup = window.open(
                    category.notebooklm_url,
                    'gemini_chat',
                    'width=800,height=700,resizable=yes,scrollbars=yes,status=yes,location=yes,toolbar=no,menubar=no'
                  );
                  // Store reference to close it later
                  if (popup) {
                    window.chatWindow = popup;
                    // Focus the popup
                    popup.focus();
                  } else {
                    toast.error('Popup blocked. Please allow popups for this site and try again.');
                    setHelpChatOpen(false);
                    setSelectedCategoryForChat(null);
                  }
                }}
              >
                <FolderOpen className="w-4 h-4 mr-3" style={{ color: primaryColor }} />
                <div className="text-left flex-1">
                  <div className="font-medium text-slate-900">{category.name}</div>
                  {category.description && (
                    <div className="text-xs text-slate-600 mt-0.5">{category.description}</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Bubble Indicator - Shows when chat window is open */}
      {helpChatOpen && selectedCategoryForChat && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Chat Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5" />
              <div>
                  <div className="font-semibold">{t('portal.chatOpened')}</div>
                <div className="text-xs opacity-90">{selectedCategoryForChat.name}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/20 text-white"
              onClick={() => {
                setHelpChatOpen(false);
                setSelectedCategoryForChat(null);
                // Try to close the popup window if it's still open
                if (window.chatWindow && !window.chatWindow.closed) {
                  window.chatWindow.close();
                }
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="glass p-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">
              {t('portal.chatWindowInstructions')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (selectedCategoryForChat.notebooklm_url) {
                  window.open(selectedCategoryForChat.notebooklm_url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              {t('portal.openChatTab')}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Knowledge Systems Navigation Bar */}
      {!inIframe && <KnowledgeSystemsNavigationBar workspaceId={portal?.workspace?.id} />}

      {/* Footer - Powered by InterGuide */}
      {!inIframe && (
        <footer className="glass border-t border-border py-6 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {t('portal.poweredBy')}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {t('portal.wantKnowledgeBase')}
            </p>
            <Link to="/signup">
              <Button variant="secondary" size="sm">
                {t('portal.getStarted')}
              </Button>
            </Link>
          </div>
        </footer>
      )}

      {/* Admin Dashboard Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('portal.adminDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-300">
              {t('portal.adminDialog.message')}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setAdminDialogOpen(false)}
              >
                {t('portal.adminDialog.stayInPortal')}
              </Button>
              <Button
                onClick={() => {
                  setAdminDialogOpen(false);
                  navigate('/dashboard');
                }}
              >
                {t('portal.adminDialog.goToDashboard')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalPage;
