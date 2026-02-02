import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, MessageCircle, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppShell } from './ui/design-system';
import { apiClient, getBackendUrl } from '../lib/api';
import { normalizeImageUrl } from '../lib/utils';
import LanguageSwitcher from './LanguageSwitcher';
import WorkspaceLoader from './WorkspaceLoader';
import { PortalProvider } from '../contexts/PortalContext';
import { KnowledgeRouteProvider } from '../knowledge-systems/KnowledgeRouteContext';
import { useAuth } from '../contexts/AuthContext';

const PortalLayout = ({ isEmbedded = false }) => {
  const { t, ready } = useTranslation(['portal', 'common']);
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const { user, isBlocked } = useAuth();
  const workspace = portal?.workspace || null;

  console.log('[PORTAL STATE]', {
    user: !!user,
    loading,
    ready,
    isBlocked,
    workspacesCount: workspace ? 1 : 0,
    activeWorkspace: workspace?.id || null,
  });

  const isEmbedParam = useMemo(() => new URLSearchParams(location.search).get('embed') === '1', [location.search]);
  const inIframe = useMemo(() => {
    if (typeof window === 'undefined') return isEmbedded || isEmbedParam;
    return isEmbedded || isEmbedParam || window.self !== window.top;
  }, [isEmbedded, isEmbedParam]);

  useEffect(() => {
    if (!slug) {
      setPortal(null);
      setLoading(false);
      return;
    }
    const fetchPortal = async () => {
      try {
        const response = await apiClient.get(`/portal/${slug}`);
        setPortal(response.data);
      } catch (error) {
        setPortal(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPortal();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me', {
          validateStatus: (status) => status < 500
        });
        setIsLoggedIn(response.status === 200);
      } catch (error) {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, [slug]);

  useEffect(() => {
    if (!portal?.workspace?.name || !slug) return undefined;
    const workspace = portal.workspace;
    const workspaceName = workspace.name;
    const logoUrl = workspace.logo ? normalizeImageUrl(workspace.logo) : null;

    document.title = `InterGuide – ${workspaceName}`;

    if (logoUrl) {
      let favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.setAttribute('rel', 'icon');
        document.head.appendChild(favicon);
      }
      favicon.setAttribute('href', logoUrl);
      favicon.setAttribute('type', logoUrl.includes('.svg') ? 'image/svg+xml' : 'image/png');

      let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.setAttribute('rel', 'apple-touch-icon');
        document.head.appendChild(appleIcon);
      }
      appleIcon.setAttribute('href', logoUrl);
    }

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

    const portalUrl = `${getBackendUrl()}/portal/${slug}`;
    const ogImageUrl = logoUrl || `${window.location.origin}/og-image.png`;

    updateMetaTag('og:title', `InterGuide – ${workspaceName}`);
    updateMetaTag('og:description', `InterGuide – ${workspaceName}`);
    updateMetaTag('og:image', ogImageUrl);
    updateMetaTag('og:image:secure_url', ogImageUrl);
    updateMetaTag('og:url', portalUrl);

    updateMetaTag('twitter:title', `InterGuide – ${workspaceName}`);
    updateMetaTag('twitter:description', `InterGuide – ${workspaceName}`);
    updateMetaTag('twitter:image', ogImageUrl);

    updateMetaTag('title', `InterGuide – ${workspaceName}`);
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', `InterGuide – ${workspaceName}`);
    }

    return () => {
      document.title = 'InterGuide';
    };
  }, [portal, slug]);

  if (!slug) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Portal Not Found</h1>
            <p className="text-muted-foreground">The portal you're looking for doesn't exist.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!ready || loading) {
    return (
      <div style={{ color: 'red', padding: 20 }}>
        BLOCKED: loading={String(loading)} ready={String(ready)}
      </div>
    );
  }

  if (!portal) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Portal Not Found</h1>
            <p className="text-muted-foreground">The portal you're looking for doesn't exist.</p>
          </div>
        </div>
      </AppShell>
    );
  }

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
      title: t('portal:headers.admin.title'),
      description: t('portal:headers.admin.description'),
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
      title: t('portal:headers.tenant.title'),
      description: t('portal:headers.tenant.description'),
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
      title: t('portal:headers.knowledge.title'),
      description: t('portal:headers.knowledge.description'),
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
      title: t('portal:headers.integrations.title'),
      description: t('portal:headers.integrations.description'),
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
  const portalPalette = workspace.portal_palette || {};
  const primaryColor = portalPalette.primary || workspace.brand_color || '#4f46e5';
  const secondaryColor = portalPalette.secondary || '#8b5cf6';
  const accentColor = portalPalette.accent || '#10b981';
  const backgroundStyle = workspace.portal_background_url
    ? { backgroundImage: `url(${normalizeImageUrl(workspace.portal_background_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : {};

  const embedScrollStyle = inIframe
    ? {
        height: '100%',
        minHeight: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }
    : {};

  const isKnowledgeRoute = location.pathname.includes(`/portal/${slug}/knowledge`);

  return (
    <PortalProvider value={{
      portal,
      workspace,
      slug,
      portalIdNormalized,
      portalDetails,
      primaryColor,
      secondaryColor,
      accentColor,
      inIframe,
      isEmbedded
    }}>
      <KnowledgeRouteProvider value={{ slug, context: 'portal' }}>
        <div
          className={`${inIframe ? 'bg-background' : 'min-h-screen bg-background'} ${inIframe ? 'iframe-mode' : ''}`}
          style={{ ...backgroundStyle, ...embedScrollStyle }}
        >
          {workspace.portal_background_url && (
            <div className="fixed inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 -z-10" />
          )}

          {!inIframe && (
            <header className="glass border-b border-border sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-3 sm:gap-6 mb-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
                    {isKnowledgeRoute && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/portal/${slug}`)}
                        className="text-xs sm:text-sm"
                      >
                        {t('portal:backToPortal')}
                      </Button>
                    )}
                    {workspace.logo ? (
                      <img
                        src={normalizeImageUrl(workspace.logo)}
                        alt={workspace.name}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          console.error('Failed to load workspace logo:', workspace.logo);
                          e.target.style.display = 'none';
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
                    <LanguageSwitcher />

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

                {(workspace.portal_phone || workspace.portal_working_hours || workspace.portal_whatsapp) && (
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs sm:text-sm text-muted-foreground border-t border-border pt-3">
                    {workspace.portal_phone && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: primaryColor }} />
                        <a href={`tel:${workspace.portal_phone.replace(/\\s/g, '')}`} className="hover:text-foreground transition-colors truncate">
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
                          {t('portal:whatsapp')}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </header>
          )}

          <Outlet />

          <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('portal:adminDialog.title')}</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <p className="text-sm text-slate-300">
                  {t('portal:adminDialog.message')}
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setAdminDialogOpen(false)}
                  >
                    {t('portal:adminDialog.stayInPortal')}
                  </Button>
                  <Button
                    onClick={() => {
                      setAdminDialogOpen(false);
                      navigate('/dashboard');
                    }}
                  >
                    {t('portal:adminDialog.goToDashboard')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </KnowledgeRouteProvider>
    </PortalProvider>
  );
};

export default PortalLayout;
