export const POLICY_ROUTES = {
  editor: '/workspace/:workspaceSlug/knowledge/policy/:itemId/edit',
  portal: '/portal/:slug/knowledge/policies/:id'
} as const;

export { PolicyEditorRoot as PolicyEditor } from './EditorRoot';
export { PolicyPortalRoot as PolicyPortal } from './PortalRoot';