# Translation Escape Hatches - Comprehensive Audit

## Executive Summary

Identified all sources of untranslated user-facing text across the application. These escape hatches prevent full localization and must be systematically eliminated.

## Categories of Untranslated Text

### 1. Browser Native Dialogs (Critical)

**window.confirm() calls - 15 instances found:**

1. `WalkthroughViewerPage.js:897` - "Are you sure you want to end this walkthrough?"
2. `WalkthroughViewerPage.js:909` - "Restart walkthrough from the beginning?"
3. `WalkthroughsPage.js:159` - Uses t() ✅ (already translated)
4. `WalkthroughsPage.js:630` - "Are you sure you want to move \"{title}\" to archive?..."
5. `CategoriesPage.js:213` - "Delete \"{name}\" and all its sub-categories?..."
6. `BuilderV2Page.js:1022` - "Delete step {number}?"
7. `BuilderV2Page.js:1371` - "Delete this block?"
8. `BuilderV2Page.js:3305` - Uses t() ✅ (already translated)
9. `BuilderV2Page.js:3557` - "Remove slide {number}?"
10. `ArchivePage.js:80` - Uses t() ✅ (already translated)
11. `AnalyticsPage.js:98` - Uses t() ✅ (already translated)
12. `AdminDashboardPage.js:825` - "Cancel subscription for {email}?"
13. `AdminDashboardPage.js:842` - "Force downgrade {email} to Free plan?"
14. `AdminDashboardPage.js:868` - "Disable {email}? They will not be able to log in."
15. `AdminDashboardPage.js:924` - "Soft delete {email}?..."
16. `AdminDashboardPage.js:948-957` - Multi-line permanent delete confirmation

**window.alert() calls - 1 instance:**
1. `WalkthroughViewerPage.js:938` - "Support contact information not configured..."

**window.prompt() calls - 1 instance:**
1. `AdminDashboardPage.js:960` - Email confirmation prompt

**confirm() calls (without window.) - 1 instance:**
1. `SettingsPage.js:229` - "Are you sure you want to cancel this invitation?" / "Are you sure you want to remove this member?"
2. `PolicyListPage.tsx:42` - "Are you sure you want to delete this policy?"

### 2. Dynamic Default Text

**Step auto-naming:**
- `BuilderV2Page.js:1015` - `Step ${index + 1}` (hardcoded English)
- Should use: `t('builder.stepDefault', { number: index + 1 })`

**Hardcoded button labels:**
- `WalkthroughsPage.js:639` - "Archive Walkthrough"
- `WalkthroughsPage.js:648` - "Cancel"
- `CategoriesPage.js` - Various hardcoded success/error messages

### 3. Toast Messages with Hardcoded Text

**Success/Error messages:**
- `CategoriesPage.js:182` - "Category name is required"
- `CategoriesPage.js:200` - "Category updated!"
- `CategoriesPage.js:218` - "Category deleted. Walkthroughs are now uncategorized."
- `SettingsPage.js:213` - "Invitation sent to {email}"
- `SettingsPage.js:232` - "Invitation cancelled" / "Member removed"
- `SettingsPage.js:244` - "Workspace deleted successfully"
- `AdminDashboardPage.js:966` - "Email did not match. Deletion cancelled."

### 4. Block Names (Already Fixed)

✅ Block display names now use translation keys via `getBlockLabelKey()`

### 5. Admin Dashboard Dropdown Labels

**Hardcoded action labels:**
- "Cancel Subscription"
- "Downgrade to Free"
- "Upgrade to Pro"
- "Disable User"
- "Enable User"
- "Set Grace Period"
- "Set Custom Quotas"
- "Soft Delete User"
- "Restore User"
- "PERMANENT DELETE"

## Implementation Plan

### Phase 1: Add Missing Translation Keys

Add to `en.json` and `he.json`:

```json
{
  "dialogs": {
    "confirm": {
      "endWalkthrough": "Are you sure you want to end this walkthrough?",
      "restartWalkthrough": "Restart walkthrough from the beginning?",
      "archiveWalkthrough": "Are you sure you want to move \"{{title}}\" to archive? You can restore it later from the Archive page.",
      "deleteCategory": "Delete \"{{name}}\"? Walkthroughs will become uncategorized.",
      "deleteCategoryWithChildren": "Delete \"{{name}}\" and all its sub-categories? Walkthroughs will become uncategorized.",
      "deleteStep": "Delete step {{number}}?",
      "deleteBlock": "Delete this block?",
      "removeSlide": "Remove slide {{number}}?",
      "cancelInvitation": "Are you sure you want to cancel this invitation?",
      "removeMember": "Are you sure you want to remove this member?",
      "deletePolicy": "Are you sure you want to delete this policy?",
      "cancelSubscription": "Cancel subscription for {{email}}?",
      "downgradeUser": "Force downgrade {{email}} to Free plan?",
      "disableUser": "Disable {{email}}? They will not be able to log in.",
      "softDeleteUser": "Soft delete {{email}}? This will mark the user as deleted but preserve their data.",
      "permanentDeleteUser": "PERMANENT DELETE: {{email}}\n\nThis will PERMANENTLY delete:\n- User account\n- All workspaces owned by user\n- All walkthroughs and categories\n- All uploaded files\n- All subscriptions and data\n\nThis action CANNOT be undone!\n\nType the user's email to confirm deletion.",
      "confirmEmail": "Type \"{{email}}\" to confirm permanent deletion:"
    },
    "alert": {
      "noSupportContact": "Support contact information not configured. Please contact the walkthrough creator."
    }
  },
  "builder": {
    "stepDefault": "Step {{number}}",
    "labels": {
      "archiveWalkthrough": "Archive Walkthrough",
      "cancel": "Cancel"
    }
  },
  "categories": {
    "nameRequired": "Category name is required",
    "updated": "Category updated!",
    "deleted": "Category deleted. Walkthroughs are now uncategorized."
  },
  "settings": {
    "invitationSent": "Invitation sent to {{email}}",
    "invitationCancelled": "Invitation cancelled",
    "memberRemoved": "Member removed",
    "workspaceDeleted": "Workspace deleted successfully"
  },
  "admin": {
    "actions": {
      "cancelSubscription": "Cancel Subscription",
      "downgradeToFree": "Downgrade to Free",
      "upgradeToPro": "Upgrade to Pro",
      "disableUser": "Disable User",
      "enableUser": "Enable User",
      "setGracePeriod": "Set Grace Period",
      "setCustomQuotas": "Set Custom Quotas",
      "softDeleteUser": "Soft Delete User",
      "restoreUser": "Restore User",
      "permanentDelete": "PERMANENT DELETE"
    },
    "emailMismatch": "Email did not match. Deletion cancelled."
  }
}
```

### Phase 2: Create Custom Confirmation Dialog Component

Replace all `window.confirm()` with a translated custom dialog component.

### Phase 3: Replace All Hardcoded Strings

Systematically replace every hardcoded string with `t()` calls.

### Phase 4: Verification

Test in Hebrew mode - ensure zero English strings appear.

## Files Requiring Changes

1. `WalkthroughViewerPage.js` - 3 dialogs
2. `WalkthroughsPage.js` - 1 dialog + button labels
3. `CategoriesPage.js` - 1 dialog + 3 toast messages
4. `BuilderV2Page.js` - 4 dialogs + step naming
5. `ArchivePage.js` - Already uses t() ✅
6. `AnalyticsPage.js` - Already uses t() ✅
7. `AdminDashboardPage.js` - 6 dialogs + action labels
8. `SettingsPage.js` - 2 dialogs + 4 toast messages
9. `PolicyListPage.tsx` - 1 dialog + 1 alert
10. `i18n/locales/en.json` - Add new keys
11. `i18n/locales/he.json` - Add Hebrew translations

## Next Steps

1. Add all missing translation keys to both language files
2. Create reusable ConfirmDialog component
3. Replace all window.confirm/alert/prompt calls
4. Replace all hardcoded toast messages
5. Fix dynamic default text (Step naming)
6. Test thoroughly in Hebrew mode
