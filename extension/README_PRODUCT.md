# InterGuide Walkthrough Engine - Product Documentation
## v1.0.0 - Complete Product Layer

**Version:** 1.0.0  
**Status:** Product Complete  
**Engine:** v1.0.0 (Locked)  
**Date:** 2026-02-08

---

## 🎯 Product Overview

The InterGuide Walkthrough Engine is now a **complete product** with:

1. **Locked v1.0.0 Execution Engine** - Race-proof, secure, production-hardened
2. **Admin Authoring System** - Visual walkthrough creation
3. **Publishing Pipeline** - Draft → Published → Archived lifecycle
4. **User Onboarding** - Automatic walkthrough detection and launch
5. **Progress Tracking** - Per-user completion persistence
6. **Role-Based UI** - Clear visual separation of admin vs user modes

---

## 📁 File Structure

```
extension/
├── authoring/                    # Admin authoring system
│   ├── authoring-controller.js   # Main authoring logic
│   └── admin-test-mode.js        # QA/testing interface
├── storage/                      # Data persistence
│   └── walkthrough-repository.js # Walkthrough CRUD + states
├── ui/                          # Visual components
│   ├── admin-toolbar.js         # Floating admin toolbar
│   ├── step-editor.js           # Step configuration UI
│   ├── onboarding-launcher.js   # User entry point
│   └── visual-indicators.js     # Role badges & counters
├── background.js                # Service worker (locked v1.0.0)
├── walkthrough-overlay.js       # Execution engine (locked v1.0.0)
├── walkthrough-state-machine.js # State management (locked v1.0.0)
├── popup.html                   # Extension popup
├── popup.js                     # Popup logic + authoring hooks
└── manifest.json                # v1.0.0 MV3 manifest
```

---

## 🚀 Quick Start

### For Admins

1. **Enable Admin Mode**
   ```javascript
   chrome.storage.local.set({ ig_walkthrough_admin_mode: true })
   ```

2. **Create a Walkthrough**
   - Click extension icon → "Enter Authoring Mode"
   - Click "Create Walkthrough" in toolbar
   - Enter name and starting URL
   - Click "Add Step" → Pick element on page
   - Configure instruction, action type, validation
   - Save & add more steps
   - Click "Finish & Publish"

3. **Manage Walkthroughs**
   - Extension popup → "Manage Walkthroughs"
   - Edit drafts, publish, test, or archive

4. **Test Before Publishing**
   - Click "Test" on any walkthrough
   - Use control panel to step forward/back
   - View diagnostics for each step
   - Force validation pass/fail

### For Users

1. **Install Extension**
   - Extension auto-detects applicable walkthroughs
   - Shows launcher when walkthrough available

2. **Start Onboarding**
   - Click "Start Tour" in launcher
   - Or walkthrough auto-starts (if configured)

3. **Follow Guide**
   - Progress indicator shows step count
   - Complete each step as instructed
   - Walkthrough advances automatically

4. **Completion**
   - Success screen shows on completion
   - Progress saved, won't repeat

---

## 📊 Data Model

### Walkthrough
```javascript
{
  walkthroughId: "uuid",
  name: "New User Setup",
  description: "...",
  startUrl: "https://app.example.com/dashboard",
  targetUrls: ["https://app.example.com/*"],
  steps: [Step],
  status: "draft" | "published" | "archived",
  createdAt: timestamp,
  publishedAt: timestamp,
  version: 1,
  settings: {
    autoStart: false,
    showProgressBar: true,
    allowSkip: false
  }
}
```

### Step
```javascript
{
  id: "uuid",
  order: 0,
  urlScope: { type: "url_pattern", value: "/dashboard" },
  targetSelectors: {
    primary: { type: "css_id", value: "#save-btn" },
    fallbacks: [...]
  },
  instruction: "Click the Save button",
  actionType: "click" | "input" | "select" | "check",
  validation: { rule: "clicked" },
  ui: {
    tooltipPosition: "bottom",
    allowSkip: false,
    highlightPadding: 8
  },
  isOptional: false
}
```

### User Progress
```javascript
{
  userId: "uuid",
  walkthroughId: "uuid",
  currentStep: 2,
  completedSteps: ["step-1", "step-2"],
  completed: false,
  startedAt: timestamp,
  completedAt: timestamp
}
```

---

## 🔐 Security Model

| Layer | Protection |
|-------|-----------|
| **Engine** | Locked v1.0.0 - no modifications |
| **Admin** | `ig_walkthrough_admin_mode` flag required |
| **Publishing** | Validation gate - all steps must pass checks |
| **Progress** | Per-user isolation, no cross-user leakage |
| **Storage** | chrome.storage.local, extension-only access |

---

## 🎨 Visual System

### Admin Mode Indicators
- **Admin Badge** - Top-left orange "ADMIN MODE" badge
- **Authoring Toolbar** - Floating right-side toolbar
- **Step Counter** - Shows current step number
- **Mode Indicator** - "Authoring Mode" footer

### User Mode Indicators  
- **Launcher** - Bottom-right card with "Start Tour"
- **Progress Bar** - Top-center step progress
- **Completion Badge** - Green success notification

### Role Separation
| Feature | Admin | User |
|---------|-------|------|
| Create Walkthroughs | ✅ | ❌ |
| Publish | ✅ | ❌ |
| Test Mode | ✅ | ❌ |
| View Telemetry | ✅ | ❌ |
| Experience Walkthroughs | ✅ | ✅ |
| Skip Steps | ✅ (with flag) | ❌ |

---

## 🧪 Testing

### Test Mode Features
- Step forward/back navigation
- Force validation pass/fail
- Real-time diagnostics per step
- Selector stability scoring
- URL scope validation
- Export test reports

### Running Tests
```javascript
// Content script console
window.adminTestMode.startTest('walkthrough-id')
```

---

## 📈 Telemetry

### Tracked Events
- `session_start` - Walkthrough initiated
- `session_complete` - All steps completed
- `session_abort` - User exited early
- `step_failure` - Validation failed
- `step_success` - Step completed
- `target_resolved` - Element found

### Admin Telemetry Viewer
- Extension popup → "View Telemetry" (admin only)
- Shows sessions, completions, aborts
- Lists recent events
- Export to JSON

---

## 🔄 Publishing Lifecycle

```
┌─────────┐    Create    ┌─────────┐    Edit    ┌─────────┐
│  START  │ ────────────→│  DRAFT  │ ←─────────│  DRAFT  │
└─────────┘              └────┬────┘           └─────────┘
                              │
                           Validate
                              │
                              ▼
                         ┌─────────┐
                    ┌────│ PUBLISH │────┐
                    │    └────┬────┘    │
                    │         │         │
                    ▼         ▼         ▼
              ┌────────┐  ┌────────┐  ┌────────┐
              │ LIVE   │  │ARCHIVED│  │VERSION │
              │(active)│  │(hidden)│  │  (2.0) │
              └────────┘  └────────┘  └────────┘
```

---

## 🛠️ API Reference

### AuthoringController
```javascript
// Enter authoring mode
window.authoringController.enterAuthoringMode()

// Create new walkthrough
window.authoringController.createNewWalkthrough(name, startUrl)

// Start element picking
window.authoringController.startElementPicking()

// Save step
window.authoringController.saveStep(stepConfig)

// Publish
window.authoringController.publishWalkthrough()
```

### WalkthroughRepository
```javascript
// CRUD operations
window.walkthroughRepository.createDraft(data)
window.walkthroughRepository.saveDraft(walkthrough)
window.walkthroughRepository.publish(walkthroughId)
window.walkthroughRepository.archive(walkthroughId)

// Queries
window.walkthroughRepository.getAllDrafts()
window.walkthroughRepository.getAllPublished()
window.walkthroughRepository.findWalkthroughsForUrl(url)

// User progress
window.walkthroughRepository.saveUserProgress(userId, walkthroughId, progress)
window.walkthroughRepository.markCompleted(userId, walkthroughId)
window.walkthroughRepository.hasUserCompleted(userId, walkthroughId)
```

### OnboardingLauncher
```javascript
// Auto-detect and offer walkthroughs
window.onboardingLauncher.init()

// Show completion UI
window.onboardingLauncher.showCompletionUI()
```

### AdminTestMode
```javascript
// Start test session
window.adminTestMode.startTest(walkthroughId)

// Navigate
window.adminTestMode.nextStep()
window.adminTestMode.previousStep()

// Force validation
window.adminTestMode.forceValidation(true) // pass
window.adminTestMode.forceValidation(false) // fail

// Export results
window.adminTestMode.exportResults()
```

---

## 📋 Checklist: Product Completeness

- [x] Admin can create walkthrough without writing code
- [x] Visual element picker with selector generation
- [x] Step configuration (instruction, action, validation)
- [x] Save draft incrementally
- [x] Publish with validation gate
- [x] Draft/Published/Archived states
- [x] User onboarding launcher (auto-detect)
- [x] Manual "Start Tour" option
- [x] Progress tracking per user
- [x] Completion persistence
- [x] Admin test mode with diagnostics
- [x] Role-based UI separation
- [x] Visual mode indicators
- [x] Extension popup management

**Status:** ✅ ALL REQUIREMENTS MET

---

## 🚫 What v1.0.0 Does NOT Include

(Planned for v1.1 or v2.0)

- Screen reader ARIA enhancements
- Reduced motion support
- Cross-origin iframe targeting
- Walkthrough analytics dashboard
- Multi-language support
- Conditional step branching
- User segmentation/roles

---

## 📞 Support

**Engine Issues:** Security/stability → Escalate to Engineering  
**Product Issues:** Authoring/onboarding → Escalate to Product  
**User Issues:** Completion/progress → Escalate to Support

---

## 📄 License

Internal Use Only - InterGuide Platform

---

**End of Documentation**

**Version:** 1.0.0  
**Last Updated:** 2026-02-08
