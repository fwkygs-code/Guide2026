# Theme and Translation Completeness Audit

## Status: IN PROGRESS

### Part 1: Theme Completeness (Hard-coded Colors)

#### ✅ COMPLETED Components
1. **PortalPage.js** - All colors replaced with semantic tokens
2. **AdminDashboardPage.js** - All colors replaced with semantic tokens
3. **BuilderV2Page.js** - All colors replaced with semantic tokens
4. **SettingsPage.js** - All colors replaced with semantic tokens
5. **WalkthroughViewerPage.js** - All colors replaced with semantic tokens
6. **BuildingTips.jsx** - All colors replaced with semantic tokens
7. **UpgradePrompt.jsx** - All colors replaced with semantic tokens (32 replacements)
8. **PlanSelectionModal.jsx** - All colors replaced with semantic tokens (28 replacements)
9. **BillingInfo.jsx** - All colors replaced with semantic tokens (26 replacements)
10. **QuotaDisplay.jsx** - All colors replaced with semantic tokens (21 replacements)
11. **InlineRichEditor.js** - All colors replaced with semantic tokens (22 replacements)

#### 🔄 REMAINING Components with Hard-coded Colors
Based on grep results, the following components still need fixes:

1. **RichTextEditor.js** - 9 matches
2. **NotificationsMenu.jsx** - 8 matches
3. **DocumentationRichTextEditor.js** - 8 matches
4. **PolicyRichTextEditor.js** - 7 matches
5. **FAQRichTextEditor.js** - 6 matches
6. **ProcedureRichTextEditor.js** - 6 matches
7. **LanguageSwitcher.jsx** - 4 matches
8. **context-menu.jsx** - 4 matches
9. **menubar.jsx** - 4 matches
10. **PayPalSubscription.jsx** - 3 matches
11. **button.jsx** - 3 matches (design system - may be intentional)
12. **dropdown-menu.jsx** - 3 matches
13. **sonner.jsx** - 3 matches
14. **DarkModeToggle.jsx** - 2 matches
15. **WorkspaceLockModal.jsx** - 2 matches
16. **command.jsx** - 2 matches
17. **ConfigPanel.jsx** - 2 matches
18. **navigation-menu.jsx** - 2 matches
19. **resizable.jsx** - 2 matches
20. **select.jsx** - 2 matches
21. **tabs.jsx** - 2 matches
22. **alert.jsx** - 1 match
23. **Badge.jsx** - 1 match (design system)
24. **Card.jsx** - 1 match (design system)
25. **PageHeader.jsx** - 1 match (design system)
26. **dialog.jsx** - 1 match
27. **hover-card.jsx** - 1 match
28. **popover.jsx** - 1 match

### Part 2: Translation Completeness

#### Translation Audit Needed
- Scan all components for untranslated user-facing strings
- Identify strings not wrapped in `t()` function
- Check for missing Hebrew translations in translation files
- Verify language switching works across all UI

#### Known Untranslated Strings (from completed components)
Many hard-coded English strings found in:
- UpgradePrompt.jsx: "Cancel subscription?", "Processing...", "Manage via PayPal", etc.
- PlanSelectionModal.jsx: "Choose Your Plan", "Change Plan", etc.
- BillingInfo.jsx: "Billing & Subscription", "Plan", "Subscription Status", etc.
- QuotaDisplay.jsx: Warning messages, status text
- BuildingTips.jsx: Block names and descriptions

### Next Steps

1. **Priority 1**: Fix remaining RichTextEditor components (similar patterns to InlineRichEditor)
2. **Priority 2**: Fix UI component library files (context-menu, dropdown-menu, etc.)
3. **Priority 3**: Add translation wrappers to all hard-coded strings
4. **Priority 4**: Add missing Hebrew translations to translation files
5. **Priority 5**: Test language switching

### Notes
- Design system components (Badge.jsx, Card.jsx, Button.jsx) may have intentional color usage
- UI library components (shadcn/ui) may need careful review to avoid breaking functionality
- Translation keys should follow existing patterns in the codebase
