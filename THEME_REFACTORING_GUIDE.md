# Theme Refactoring Guide

## Automated Replacement Patterns

### Text Colors

| Old Pattern | New Pattern | Context |
|-------------|-------------|---------|
| `text-white` | `text-foreground` | Primary text on dark backgrounds |
| `text-slate-50` | `text-foreground` | Primary text |
| `text-slate-100` | `text-foreground` | Primary text |
| `text-slate-200` | `text-foreground` | Primary text |
| `text-slate-300` | `text-muted-foreground` | Secondary text |
| `text-slate-400` | `text-muted-foreground` | Muted text |
| `text-slate-500` | `text-muted-foreground` | Muted text |
| `text-slate-600` | `text-muted-foreground` | Muted text (dark on light - now muted on dark) |
| `text-slate-700` | `text-foreground` | Was dark on light - now primary on dark |
| `text-slate-800` | `text-foreground` | Was very dark on light - now primary on dark |
| `text-slate-900` | `text-foreground` | Was very dark on light - now primary on dark |
| `text-gray-*` | Same as slate mapping | Gray is equivalent to slate |

### Background Colors

| Old Pattern | New Pattern | Context |
|-------------|-------------|---------|
| `bg-white` | `bg-card` | Elevated surfaces |
| `bg-slate-50` | `bg-card` | Light surfaces |
| `bg-slate-100` | `bg-card` | Light surfaces |
| `bg-slate-700` | `bg-secondary` | Medium dark surfaces |
| `bg-slate-800` | `bg-card` | Dark elevated surfaces |
| `bg-slate-900` | `bg-background` | Base background |
| `bg-gray-*` | Same as slate mapping | Gray is equivalent to slate |

### Border Colors

| Old Pattern | New Pattern |
|-------------|-------------|
| `border-slate-200` | `border-border` |
| `border-slate-300` | `border-border` |
| `border-slate-600` | `border-border` |
| `border-slate-700` | `border-border` |
| `border-white/10` | `border-border` |
| `border-white/20` | `border-border` |

### Glass Morphism

| Old Pattern | New Pattern |
|-------------|-------------|
| `bg-slate-900/80` | `bg-card/80` |
| `bg-slate-800/90` | `bg-card/90` |
| `border-slate-700/50` | `border-border/50` |
| `text-white/90` | `text-foreground/90` |

### Button Text Colors (Remove - handled by variant)

| Old Pattern | New Pattern |
|-------------|-------------|
| `className="text-slate-200 hover:text-white"` on Button | Remove - ghost variant handles this |
| `className="text-white"` on Button | Remove - variant handles this |

## Manual Review Required

### Inline Styles
All inline `style={{ color: '...', backgroundColor: '...' }}` must be converted to className.

### Content-Type Specific Colors
Preserve these - they're intentional:
- `text-amber-*` for policies
- `text-cyan-*` for procedures  
- `text-purple-*` for documentation
- `text-emerald-*` for FAQs
- `text-indigo-*` for decision trees

### Status Colors
Preserve these - they're semantic:
- `text-green-*` for success/active
- `text-red-*` for errors/destructive
- `text-yellow-*` for warnings

## Files Completed

- ✅ index.css
- ✅ ThemeProvider.jsx
- ✅ tailwind.config.js
- ✅ designTokens.js
- ✅ components/ui/design-system/Button.jsx
- ✅ components/ui/label.jsx
- ✅ DashboardLayout.js

## High Priority Remaining

1. PortalPage.js - 44 text colors, 16 inline styles
2. BuilderV2Page.js - 100 text colors, 38 backgrounds
3. AdminDashboardPage.js - 143 text colors
4. SettingsPage.js - 76 text colors
5. WalkthroughViewerPage.js - 64 text colors

## Verification Steps

After refactoring each file:
1. Check no hard-coded slate/gray/white text colors remain
2. Verify all backgrounds use semantic tokens
3. Ensure no inline color styles
4. Test component renders correctly
5. Verify text is readable (contrast)
