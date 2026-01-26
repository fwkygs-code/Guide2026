# Hebrew Mode Verification - Translation Fixes

## Status: IN PROGRESS

This document tracks all untranslated UI elements found during Hebrew mode acceptance testing.

---

## ✅ COMPLETED FIXES

### 1. Block Names in Builder (8 blocks)
**Issue:** Block names showing English when clicking + button in builder
**Files Modified:** `BuilderV2Page.js`
**Fix:** Removed hardcoded English fallback in `getBlockDisplayName` function
**Blocks Fixed:**
- Checklist → רשימת משימות
- Annotated Image → תמונה עם הערות
- Callout → קריאה
- Section → קטע
- External Link → קישור חיצוני
- Embed → הטמעה
- Confirmation → אישור
- Code/Command → קוד/פקודה

### 2. Publish Button in Builder
**Issue:** "Publish" button not translated
**Files Modified:** `BuilderV2Page.js`
**Fix:** Changed `Publish` to `{t('walkthrough.publish')}`
**Translation:** פרסם

### 3. Basic Information Card in Settings
**Issue:** Content clipped by card borders
**Files Modified:** `SettingsPage.js`
**Fix:** Removed duplicate nested `<div className="space-y-6">` wrapper

### 4. Settings Section Titles
**Issue:** 6 section titles not translated
**Files Modified:** `SettingsPage.js`, `en.json`, `he.json`
**Sections Fixed:**
- Portal Branding → מיתוג פורטל
- Portal External Links → קישורים חיצוניים לפורטל
- Plan Management → ניהול תוכנית
- Danger Zone → אזור סכנה
- Text Size → גודל טקסט
- Workspace Sharing → שיתוף אזור עבודה
- Public Portal → פורטל ציבורי

### 5. Walkthroughs Page
**Issue:** "Steps:", "Edit", "Settings" buttons not translated
**Files Modified:** `WalkthroughsPage.js`, `en.json`, `he.json`
**Fixes:**
- "Steps:" → `{t('walkthrough.steps')}:` (שלבים:)
- "Settings" → `{t('common.settings')}` (הגדרות)
- "Edit" → `{t('common.edit')}` (ערוך)

### 6. Walkthrough Settings Dialog
**Issue:** Dialog labels not translated
**Files Modified:** `WalkthroughsPage.js`, `en.json`, `he.json`
**Labels Fixed:**
- "Edit Walkthrough Settings" → ערוך הגדרות מדריך
- "Walkthrough Name" → שם מדריך
- "URL Name (Optional)" → שם URL (אופציונלי)
- "Description" → תיאור
- "Icon/Photo" → אייקון/תמונה (אופציונלי)

### 7. Archive Page
**Issue:** "Delete Forever" button not translated
**Files Modified:** `ArchivePage.js`, `en.json`, `he.json`
**Fix:** Changed to `{t('walkthrough.deleteForever')}` (מחק לנצח)

### 8. Categories Page
**Issue:** "Add Sub-category", "Edit", "Delete" buttons not translated
**Files Modified:** `CategoriesPage.js`, `en.json`, `he.json`
**Fixes:**
- "Add Sub-category" → `{t('categories.addSubCategory')}` (הוסף תת-קטגוריה)
- "Edit" → `{t('common.edit')}` (ערוך)
- "Delete" → `{t('common.delete')}` (מחק)
- Dialog labels: "Name" → שם, "Description" → תיאור

---

## 🔄 REMAINING ISSUES TO FIX

### 9. Category Edit Dialog - UI Visibility
**Issue:** White text on white background when editing category/sub-category
**Location:** `CategoriesPage.js` - Edit dialog
**Action Needed:** Add proper theme-aware text colors to dialog

### 10. Portal Menu Link
**Issue:** "Portal" link in upper menu not translated
**Location:** Navigation/Header component
**Action Needed:** Find navigation component and translate "Portal" text

### 11. Notifications UI
**Issue:** Notifications tab has bright text on bright background
**Location:** Notifications component
**Action Needed:** Fix theme/color contrast in notifications panel

### 12. Analytics - Walkthrough Performance Bubble
**Issue:** Content clipped by bubble borders
**Location:** `AnalyticsPage.js`
**Action Needed:** Fix card/bubble layout similar to Settings fix

### 13. Knowledge Systems - Untranslated
**Issue:** "Knowledge Systems" button and all internal content not translated
**Location:** Knowledge Systems pages/components
**Sections Needing Translation:**
- "Knowledge Systems" button
- "Policies" section
- "Procedures" section
- "Documentations" section
- "FAQs" section
- "Decision Trees" section
- "Create first" / "Open editor" buttons
- All editor content inside each system

---

## Translation Keys Added

### English (en.json)
```json
"walkthrough": {
  "editSettings": "Edit Walkthrough Settings",
  "editSettingsDescription": "Update walkthrough name, description, icon, and categories",
  "name": "Walkthrough Name",
  "urlName": "URL Name (Optional)",
  "iconPhoto": "Icon/Photo (Optional)",
  "deleteForever": "Delete Forever"
},
"categories": {
  "addSubCategory": "Add Sub-category"
},
"settings": {
  "portalExternalLinks": "Portal External Links",
  "planManagement": "Plan Management",
  "textSize": "Text Size",
  "workspaceSharing": "Workspace Sharing",
  "publicPortal": "Public Portal"
}
```

### Hebrew (he.json)
```json
"walkthrough": {
  "editSettings": "ערוך הגדרות מדריך",
  "editSettingsDescription": "עדכן שם מדריך, תיאור, אייקון וקטגוריות",
  "name": "שם מדריך",
  "urlName": "שם URL (אופציונלי)",
  "iconPhoto": "אייקון/תמונה (אופציונלי)",
  "deleteForever": "מחק לנצח"
},
"categories": {
  "addSubCategory": "הוסף תת-קטגוריה"
},
"settings": {
  "portalExternalLinks": "קישורים חיצוניים לפורטל",
  "planManagement": "ניהול תוכנית",
  "textSize": "גודל טקסט",
  "workspaceSharing": "שיתוף אזור עבודה",
  "publicPortal": "פורטל ציבורי"
}
```

---

## Files Modified Summary

1. ✅ `frontend/src/pages/BuilderV2Page.js` - Block names, Publish button
2. ✅ `frontend/src/pages/SettingsPage.js` - Section titles, Basic Info card fix
3. ✅ `frontend/src/pages/WalkthroughsPage.js` - Steps, Edit, Settings, dialog labels
4. ✅ `frontend/src/pages/ArchivePage.js` - Delete Forever button
5. ✅ `frontend/src/pages/CategoriesPage.js` - Add Sub-category, Edit, Delete buttons
6. ✅ `frontend/src/i18n/locales/en.json` - Added ~15 new translation keys
7. ✅ `frontend/src/i18n/locales/he.json` - Added ~15 Hebrew translations

---

## Next Steps

1. Fix category edit dialog UI visibility (white on white)
2. Translate Portal menu link
3. Fix notifications UI visibility
4. Fix analytics bubble content clipping
5. Translate all Knowledge Systems content
6. Final Hebrew mode verification pass

---

## Notes

- **Duplicate key warnings:** Pre-existing in translation files, don't affect functionality
- **i18next behavior:** Uses last occurrence of duplicate keys
- **Testing:** Each fix should be verified in Hebrew mode after completion
