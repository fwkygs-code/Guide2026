export const FAQ_ROUTES = {
  editor: {
    configure: '/workspace/:workspaceSlug/knowledge/faq/configure',
    list: '/workspace/:workspaceSlug/knowledge/faq',
    create: '/workspace/:workspaceSlug/knowledge/faq/new',
    edit: '/workspace/:workspaceSlug/knowledge/faq/:itemId/edit'
  },
  portal: {
    view: '/portal/:slug/knowledge/faqs'
  }
} as const;

export { FAQEditorRoot as FAQEditor } from './EditorRoot';
export { FAQPortalRoot as FAQPortal } from './PortalRoot';