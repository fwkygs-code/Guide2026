export const DECISION_TREE_ROUTES = {
  editor: {
    configure: '/workspace/:workspaceSlug/knowledge/decision-tree/configure',
    list: '/workspace/:workspaceSlug/knowledge/decision-tree',
    create: '/workspace/:workspaceSlug/knowledge/decision-tree/new',
    edit: '/workspace/:workspaceSlug/knowledge/decision-tree/:itemId/edit'
  },
  portal: {
    view: '/portal/:slug/knowledge/decisions'
  }
} as const;

export { DecisionTreeEditorRoot as DecisionTreeEditor } from './EditorRoot';
export { DecisionTreePortalRoot as DecisionTreePortal } from './PortalRoot';