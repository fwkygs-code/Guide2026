export const PROCEDURE_ROUTES = {
  editor: {
    configure: '/workspace/:workspaceSlug/knowledge/procedure/configure',
    list: '/workspace/:workspaceSlug/knowledge/procedure',
    create: '/workspace/:workspaceSlug/knowledge/procedure/new',
    edit: '/workspace/:workspaceSlug/knowledge/procedure/:itemId/edit'
  },
  portal: {
    view: '/portal/:slug/knowledge/procedures'
  }
} as const;

export { ProcedureEditorRoot as ProcedureEditor } from './EditorRoot';
export { ProcedurePortalRoot as ProcedurePortal } from './PortalRoot';