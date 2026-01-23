export const DOCUMENTATION_ROUTES = {
  editor: {
    configure: '/workspace/:workspaceSlug/knowledge/documentation/configure',
    list: '/workspace/:workspaceSlug/knowledge/documentation',
    create: '/workspace/:workspaceSlug/knowledge/documentation/new',
    edit: '/workspace/:workspaceSlug/knowledge/documentation/:itemId/edit'
  },
  portal: {
    view: '/portal/:slug/knowledge/documentation'
  }
} as const;

export { DocumentationEditorRoot as DocumentationEditor } from './EditorRoot';
export { DocumentationPortalRoot as DocumentationPortal } from './PortalRoot';