# New Editor Blocks Implementation Plan

**Date:** 2026-01-21  
**Status:** PRE-IMPLEMENTATION AUDIT  
**Approach:** Additive only, zero refactoring

---

## 📋 EXECUTIVE SUMMARY

This document outlines the implementation of 8 new block types for the walkthrough editor with strict stability requirements.

**Files to Modify (Only 3):**
1. `frontend/src/utils/blockUtils.js` - Add block type definitions
2. `frontend/src/components/canvas-builder/BlockComponent.js` - Add rendering logic
3. `frontend/src/components/canvas-builder/LiveCanvas.js` - Add to block picker

**Files to NOT Touch:**
- ❌ `frontend/src/pages/BuilderV2Page.js` (autosave logic)
- ❌ `frontend/src/pages/CanvasBuilderPage.js` (autosave logic)
- ❌ Any auth/CSRF/CORS/networking files
- ❌ Any i18n configuration files

---

## 🎯 NEW BLOCK TYPES

### 1. Checklist Block
**Type:** `checklist`  
**Purpose:** Structured list of checkbox items  
**Data Schema:**
```javascript
{
  items: [
    { id: string, text: string, checked: boolean }
  ]
}
```
**RTL Considerations:**
- Checkbox position flips (left ↔ right)
- Text direction follows step RTL
- Visual layout mirrors correctly

**Editor UI:**
- Add/remove items
- Reorder items (drag handle)
- Inline text editing
- Local state only (no API calls)

### 2. Callout Block
**Type:** `callout`  
**Purpose:** Highlighted information with icon  
**Data Schema:**
```javascript
{
  variant: 'tip' | 'warning' | 'important' | 'info',
  content: string // Rich text
}
```
**RTL Considerations:**
- Icon position flips
- Border direction flips
- Content direction follows RTL

**Variants:**
- **Tip**: 💡 Blue background
- **Warning**: ⚠️ Yellow background
- **Important**: ❗ Red background
- **Info**: ℹ️ Gray background

### 3. Annotated Image Block
**Type:** `annotated_image`  
**Purpose:** Image with clickable markers  
**Data Schema:**
```javascript
{
  url: string,
  alt: string,
  markers: [
    {
      id: string,
      x: number, // 0-100 percentage
      y: number, // 0-100 percentage
      text: string
    }
  ]
}
```
**RTL Considerations:**
- Marker positions are absolute (NOT flipped)
- Marker text direction follows RTL
- Marker tooltip position adjusts for RTL

**Editor UI:**
- Upload/paste image (reuse existing upload logic)
- Click image to add marker
- Drag markers to reposition
- Click marker to edit text
- Delete marker button

### 4. Embed Block
**Type:** `embed`  
**Purpose:** Embedded external content  
**Data Schema:**
```javascript
{
  provider: 'youtube' | 'vimeo' | 'loom' | 'figma' | 'google_docs' | 'notebooklm' | 'gemini',
  url: string,
  aspectRatio: '16:9' | '4:3' | '1:1',
  title: string // Optional
}
```
**RTL Considerations:**
- Iframe container layout mirrors
- Title direction follows RTL

**Provider Whitelist:**
```javascript
const ALLOWED_PROVIDERS = {
  youtube: ['youtube.com', 'youtu.be'],
  vimeo: ['vimeo.com', 'player.vimeo.com'],
  loom: ['loom.com'],
  figma: ['figma.com'],
  google_docs: ['docs.google.com', 'drive.google.com'],
  notebooklm: ['notebooklm.google.com'],
  gemini: ['gemini.google.com']
};
```

**Editor UI:**
- URL input with auto-detection
- Provider selector (if ambiguous)
- Aspect ratio selector
- Preview with lazy loading

### 5. Section / Sub-step Block
**Type:** `section`  
**Purpose:** Group multiple blocks with optional collapse  
**Data Schema:**
```javascript
{
  title: string,
  collapsible: boolean,
  defaultCollapsed: boolean,
  blocks: [] // Nested blocks array
}
```
**RTL Considerations:**
- Collapse icon position flips
- Nested content direction follows RTL

**Editor UI:**
- Title input
- Toggle collapsible option
- Nested block editor (reuse existing BlockComponent)
- Add block button inside section

### 6. Confirmation Block
**Type:** `confirmation`  
**Purpose:** Explicit acknowledgment  
**Data Schema:**
```javascript
{
  message: string,
  buttonText: string,
  style: 'checkbox' | 'button'
}
```
**RTL Considerations:**
- Checkbox/button position mirrors
- Text direction follows RTL

**Editor UI:**
- Message input
- Button text input
- Style selector (checkbox vs button)
- Preview of confirmation state

### 7. External Link Block
**Type:** `external_link`  
**Purpose:** CTA-style link  
**Data Schema:**
```javascript
{
  text: string,
  url: string,
  openInNewTab: boolean,
  style: 'default' | 'primary' | 'secondary'
}
```
**RTL Considerations:**
- External link icon position flips
- Text direction follows RTL

**Editor UI:**
- Text input
- URL input
- New tab toggle
- Style selector
- Preview button

### 8. Code / Command Block
**Type:** `code`  
**Purpose:** Monospace code/command with copy button  
**Data Schema:**
```javascript
{
  code: string,
  language: string, // e.g., 'bash', 'javascript', 'python'
  showLineNumbers: boolean
}
```
**RTL Considerations:**
- **Code content is ALWAYS LTR** (no flipping)
- Copy button position flips
- Label/caption direction follows RTL

**Editor UI:**
- Textarea with monospace font
- Language selector
- Line numbers toggle
- Copy button
- Syntax highlighting (optional, basic)

---

## 🏗️ IMPLEMENTATION STRATEGY

### Phase 1: Block Type Definitions (blockUtils.js)

**Add to `BLOCK_TYPES` object:**
```javascript
export const BLOCK_TYPES = {
  // ... existing ...
  CHECKLIST: 'checklist',
  CALLOUT: 'callout',
  ANNOTATED_IMAGE: 'annotated_image',
  EMBED: 'embed',
  SECTION: 'section',
  CONFIRMATION: 'confirmation',
  EXTERNAL_LINK: 'external_link',
  CODE: 'code'
};
```

**Add to `createBlock()` defaults:**
```javascript
[BLOCK_TYPES.CHECKLIST]: {
  items: []
},
[BLOCK_TYPES.CALLOUT]: {
  variant: 'tip',
  content: ''
},
// ... etc
```

**Add to `getBlockIcon()` and `getBlockLabel()`:**
```javascript
const icons = {
  // ... existing ...
  checklist: '☑️',
  callout: '💬',
  annotated_image: '🖼️📌',
  embed: '📺',
  section: '📂',
  confirmation: '✅',
  external_link: '🔗',
  code: '💻'
};

const labels = {
  // ... existing ...
  checklist: 'Checklist',
  callout: 'Callout',
  annotated_image: 'Annotated Image',
  embed: 'Embed',
  section: 'Section',
  confirmation: 'Confirmation',
  external_link: 'External Link',
  code: 'Code/Command'
};
```

### Phase 2: Block Rendering (BlockComponent.js)

**Add 8 new `case` statements in `renderBlock()` switch:**

Each case will:
1. Render editor UI (inputs, selectors, etc.)
2. Handle local state changes via `onUpdate()`
3. Apply RTL classes conditionally
4. Use existing UI components (Input, Select, Button, etc.)
5. NO API calls
6. NO network requests

### Phase 3: Block Picker (LiveCanvas.js)

**Add to `blockTypes` array (lines 110-120):**
```javascript
const blockTypes = [
  // ... existing 9 types ...
  { type: BLOCK_TYPES.CHECKLIST, label: getBlockLabel(BLOCK_TYPES.CHECKLIST), icon: getBlockIcon(BLOCK_TYPES.CHECKLIST) },
  { type: BLOCK_TYPES.CALLOUT, label: getBlockLabel(BLOCK_TYPES.CALLOUT), icon: getBlockIcon(BLOCK_TYPES.CALLOUT) },
  { type: BLOCK_TYPES.ANNOTATED_IMAGE, label: getBlockLabel(BLOCK_TYPES.ANNOTATED_IMAGE), icon: getBlockIcon(BLOCK_TYPES.ANNOTATED_IMAGE) },
  { type: BLOCK_TYPES.EMBED, label: getBlockLabel(BLOCK_TYPES.EMBED), icon: getBlockIcon(BLOCK_TYPES.EMBED) },
  { type: BLOCK_TYPES.SECTION, label: getBlockLabel(BLOCK_TYPES.SECTION), icon: getBlockIcon(BLOCK_TYPES.SECTION) },
  { type: BLOCK_TYPES.CONFIRMATION, label: getBlockLabel(BLOCK_TYPES.CONFIRMATION), icon: getBlockIcon(BLOCK_TYPES.CONFIRMATION) },
  { type: BLOCK_TYPES.EXTERNAL_LINK, label: getBlockLabel(BLOCK_TYPES.EXTERNAL_LINK), icon: getBlockIcon(BLOCK_TYPES.EXTERNAL_LINK) },
  { type: BLOCK_TYPES.CODE, label: getBlockLabel(BLOCK_TYPES.CODE), icon: getBlockIcon(BLOCK_TYPES.CODE) }
];
```

**Block picker UI considerations:**
- Currently: 9 blocks in 2-column grid
- After: 17 blocks total
- Grid will scroll if needed (PopoverContent has built-in scroll)
- No changes to picker logic needed

---

## 🎨 RTL IMPLEMENTATION PATTERN

### Universal Pattern for All Blocks:

```javascript
case BLOCK_TYPES.EXAMPLE:
  return (
    <div className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Content that should flip */}
      <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <Icon className={isRTL ? 'ml-2' : 'mr-2'} />
        <span>{block.data.text}</span>
      </div>
    </div>
  );
```

### RTL Utilities (Add to blockUtils.js):

```javascript
export const getRTLClass = (isRTL, ltrClass, rtlClass) => {
  return isRTL ? rtlClass : ltrClass;
};

export const getMarginClass = (isRTL, side) => {
  const map = {
    left: isRTL ? 'mr' : 'ml',
    right: isRTL ? 'ml' : 'mr'
  };
  return map[side] || side;
};
```

---

## ⚠️ STABILITY GUARANTEES

### What Will NOT Change:
1. ✅ No changes to autosave timing or logic
2. ✅ No changes to existing block rendering
3. ✅ No changes to drag-and-drop behavior
4. ✅ No changes to authentication or authorization
5. ✅ No changes to file upload mechanism
6. ✅ No changes to i18n configuration
7. ✅ No editor re-initialization on block add

### How Stability is Ensured:
1. **Additive Only**: All new code is appended, never inserted
2. **Isolated Cases**: Each block type is a self-contained switch case
3. **Reuse Existing Patterns**: All new blocks follow existing block structure
4. **No Duplicate Extension Names**: All block types have unique names
5. **No Network Calls**: All blocks use local state or existing upload handlers
6. **No Breaking Changes**: Existing blocks continue to work identically

### Testing Protocol:
After implementation, verify:
- [ ] All existing blocks still render correctly
- [ ] All new blocks appear in picker
- [ ] Block picker is scrollable (17 blocks total)
- [ ] Drag-and-drop still works
- [ ] Autosave still works
- [ ] Language switch (EN ↔ HE) doesn't break editor
- [ ] RTL layout flips correctly for all new blocks
- [ ] No console errors
- [ ] No duplicate block type names
- [ ] All blocks save and load from localStorage draft

---

## 🔍 RISK ASSESSMENT

### Low Risk (Safe):
- ✅ Adding new BLOCK_TYPES constants
- ✅ Adding new cases to switch statement
- ✅ Adding new items to blockTypes array
- ✅ Using existing UI components
- ✅ Reusing existing upload handlers

### Medium Risk (Requires Care):
- ⚠️ Section block with nested blocks (complexity)
- ⚠️ Annotated image with marker positioning (math)
- ⚠️ Embed block with iframe security

### Mitigation:
- Section block: Reuse existing BlockComponent recursively
- Annotated image: Use percentage-based positioning (not pixel-based)
- Embed block: Use provider whitelist, no arbitrary iframes

### Zero Risk (Will Not Touch):
- ✅ Autosave mechanism
- ✅ Network layer
- ✅ Authentication
- ✅ File upload API
- ✅ Existing block logic

---

## 📦 COMPONENT DEPENDENCIES

All new blocks will use ONLY existing dependencies:
- ✅ `@/components/ui/button`
- ✅ `@/components/ui/input`
- ✅ `@/components/ui/label`
- ✅ `@/components/ui/select`
- ✅ `@/components/ui/textarea`
- ✅ `lucide-react` (icons)
- ✅ `sonner` (toast notifications)

NO new dependencies will be added.

---

## 🚀 DELIVERABLES

### 1. Code Changes:
- `frontend/src/utils/blockUtils.js` (updated)
- `frontend/src/components/canvas-builder/BlockComponent.js` (updated)
- `frontend/src/components/canvas-builder/LiveCanvas.js` (updated)

### 2. Documentation:
- This implementation plan
- Block schemas documented
- RTL behavior documented

### 3. Verification:
- All 17 blocks appear in picker
- All blocks render correctly
- All blocks support RTL
- No regressions in existing functionality

---

## ✅ PRE-IMPLEMENTATION CHECKLIST

Before coding:
- [x] Understand existing block architecture
- [x] Identify autosave mechanism (do NOT touch)
- [x] Map RTL support pattern
- [x] Document all block schemas
- [x] Identify which files to modify
- [x] Confirm no breaking changes
- [x] Plan isolated, additive implementation

**STATUS: READY FOR IMPLEMENTATION**

All requirements can be met safely without touching autosave, auth, or networking.

---

## 🎯 IMPLEMENTATION ORDER

1. **Step 1**: Update `blockUtils.js` (5 minutes)
   - Add 8 new BLOCK_TYPES
   - Add 8 new defaults to createBlock()
   - Add 8 new icons and labels

2. **Step 2**: Update `LiveCanvas.js` (2 minutes)
   - Add 8 new items to blockTypes array

3. **Step 3**: Update `BlockComponent.js` (30 minutes)
   - Add 8 new cases to renderBlock() switch
   - Implement editor UI for each block
   - Add RTL support for each block

4. **Step 4**: Testing (10 minutes)
   - Verify all blocks appear in picker
   - Test adding each block type
   - Test RTL switching
   - Verify no regressions

**Total Time Estimate: 45-50 minutes**

---

**END OF IMPLEMENTATION PLAN**
