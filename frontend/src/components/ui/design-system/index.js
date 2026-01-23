/**
 * Shared Design System Primitives
 *
 * Centralized exports matching Knowledge Systems reference implementation exactly.
 * DO NOT MODIFY - This matches Knowledge Systems visual language.
 */

// Core layout primitives
export { default as AppShell } from './AppShell';
export { default as PageHeader } from './PageHeader';
export { default as PageSurface } from './PageSurface';

// UI primitives
export { default as Surface } from './Surface';
export {
  default as Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from './Card';
export { default as Panel } from './Panel';
export { default as ConfigPanel } from './ConfigPanel';
export { default as Badge } from './Badge';
export { default as Button } from './Button';

// Re-export design tokens for convenience
export * from '../../../utils/designTokens';