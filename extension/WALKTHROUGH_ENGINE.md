# Chrome Extension Walkthrough Engine

## Overview

A **controlled, enforced onboarding engine** that shifts from passive "step ↔ URL association" to an active, step-by-step walkthrough system.

### Core Principles

- **Single Walkthrough**: Only one walkthrough can be active at a time
- **Single Active Step**: Only one step can be active at a time
- **Validation-Required Progression**: Steps advance only after validation succeeds
- **Interaction Blocking**: All non-step interactions are disabled during walkthrough
- **State Persistence**: Session state survives page reloads

---

## Architecture

### Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Popup UI      │────▶│  Background     │◀────│  Content Script │
│  (Progress)     │     │  (State Machine)│     │ (Overlay/Block) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
   GET_WALKTHROUGH_PROGRESS  WALKTHROUGH_*         ACTIVATE_OVERLAY
   (read-only display)       (lifecycle cmds)       (visual blocking)
```

### Single Source of Truth

The **Background Script** owns all walkthrough state:
- Active session
- Current step index
- Step validation state
- Collected user data
- Rejected commands log

---

## Data Models

### Walkthrough Definition

```javascript
{
  id: "uuid",                    // Unique identifier
  title: "Onboarding Flow",      // Display name
  description: "...",
  version: "1.0.0",
  
  // Scope control - where can this walkthrough run?
  scope: {
    type: "url_pattern",         // url_pattern | domain | page_specific | global
    pattern: ".*",               // Regex pattern
    allowedDomains: [],
    blockedDomains: []
  },
  
  // Steps in sequential order
  steps: [WalkthroughStep, ...],
  
  // Behavior flags
  behavior: {
    allowSkip: false,            // NEVER true for enforced mode
    allowBacktrack: false,       // Can revisit completed steps
    blockExternalNav: true,      // Prevent leaving scope
    enforceOrder: true,          // Must complete in sequence
    persistAcrossSessions: true,
    maxRetries: 3
  },
  
  // Visual theming
  theme: {
    overlayColor: "rgba(0, 0, 0, 0.7)",
    highlightColor: "#4f46e5",
    successColor: "#10b981",
    errorColor: "#ef4444"
  }
}
```

### Walkthrough Step

```javascript
{
  id: "uuid",
  stepNumber: 0,
  title: "Click the Login Button",
  description: "Find and click the login button in the header",
  
  // Target specification
  targetSelector: "#login-btn",           // Primary CSS selector
  targetAlternatives: [".login-button"], // Fallback selectors
  targetFrame: null,                    // iframe context if needed
  
  // Required user action
  requiredAction: "click",              // click | input | select | check | submit | hover | scroll | drag | keypress | custom
  actionConfig: {},                     // Action-specific configuration
  
  // Validation rules (ALL must pass)
  validationRules: [
    {
      id: "uuid",
      rule: "clicked",                  // ValidationRule enum
      target: null,                     // Defaults to step target
      value: null,                      // Expected value
      params: {},
      required: true,
      customFn: null,
      errorMessage: "Please click the login button"
    }
  ],
  
  // Blocking behavior
  blocking: {
    blockClicks: true,        // Block clicks outside target
    blockInput: true,         // Block typing outside target
    blockNavigation: true,     // Block URL changes
    blockKeyboard: true,      // Block keyboard shortcuts
    blockScroll: false        // Block scrolling away
  },
  
  // UI configuration
  ui: {
    highlightStyle: "pulse",  // box | pulse | glow | outline
    showTooltip: true,
    tooltipPosition: "auto",  // auto | top | bottom | left | right
    tooltipContent: null,     // Custom HTML
    showProgress: true
  },
  
  // Timing
  timing: {
    minDuration: 0,           // Minimum time on step (ms)
    maxDuration: null,        // Timeout before hint
    autoAdvanceDelay: 0       // Delay after validation (ms)
  },
  
  // Conditions
  conditions: {
    requires: [],             // Step IDs that must be completed first
    skipIf: null,             // Auto-skip condition
    showIf: null              // Show condition
  },
  
  // Event callbacks (serialized functions)
  onEnter: null,
  onValidate: null,
  onComplete: null,
  onFail: null
}
```

### Validation Rules Reference

| Rule | Description | Required Value | Example |
|------|-------------|----------------|---------|
| `clicked` | Element was clicked | - | `{ rule: "clicked" }` |
| `value_equals` | Input equals value | expected string | `{ rule: "value_equals", value: "John" }` |
| `value_contains` | Input contains substring | substring | `{ rule: "value_contains", value: "@" }` |
| `value_regex` | Input matches regex | regex pattern | `{ rule: "value_regex", value: "^\\d{3}-\\d{4}$" }` |
| `navigated` | URL matches pattern | regex pattern | `{ rule: "navigated", value: "/dashboard.*" }` |
| `element_visible` | Element appeared | selector | `{ rule: "element_visible", value: ".success-msg" }` |
| `element_hidden` | Element disappeared | selector | `{ rule: "element_hidden", value: ".loading" }` |
| `form_valid` | Form validation passed | form selector | `{ rule: "form_valid", value: "#signup-form" }` |
| `custom_fn` | Custom validation | function ref | `{ rule: "custom_fn", customFn: "validateEmail" }` |
| `timeout` | Minimum time elapsed | milliseconds | `{ rule: "timeout", value: 5000 }` |

---

## Message Flow

### 1. Walkthrough Lifecycle

#### START
```javascript
// Popup → Background
{
  type: "WALKTHROUGH_START",
  walkthrough: { /* Walkthrough object */ },
  tabId: 123
}

// Background → Content Script (if success)
{
  type: "ACTIVATE_OVERLAY",
  session: { /* Session snapshot */ },
  step: { /* First step */ }
}

// Response (success)
{ success: true, sessionId: "uuid", progress: { current: 1, total: 5, percentage: 0 } }

// Response (rejected - walkthrough already active)
{
  success: false,
  error: "WALKTHROUGH_ALREADY_ACTIVE",
  message: "Only one walkthrough can be active at a time",
  currentProgress: { /* existing walkthrough progress */ }
}
```

#### ABORT
```javascript
// Popup → Background
{ type: "WALKTHROUGH_ABORT", reason: "USER_EXIT_POPUP" }

// Background → Content Script
{
  type: "WALKTHROUGH_ABORT",
  reason: "USER_EXIT_POPUP",
  progress: { current: 2, total: 5, percentage: 40 }
}

// Response
{ success: true }
```

### 2. Step Progression

#### STEP ACTIVATION
```javascript
// Background → Content Script
{
  type: "STEP_ADVANCE",
  step: { /* Step definition */ },
  stepIndex: 0,
  progress: { current: 1, total: 5, percentage: 0, state: "active" }
}
```

#### VALIDATION REQUEST
```javascript
// Content Script → Background (when user performs action on target)
{
  type: "VALIDATION_REQUEST",
  stepId: "uuid",
  eventData: {
    type: "click",
    timestamp: 1234567890,
    target: "BUTTON",
    value: null
  }
}

// Response (success)
{
  success: true,
  valid: true,
  passedRules: ["rule-uuid-1", "rule-uuid-2"]
}

// Response (failure)
{
  success: true,
  valid: false,
  failedRules: [
    { ruleId: "rule-uuid", ruleType: "value_equals", passed: false }
  ],
  message: "Please try again"
}
```

#### AUTO-ADVANCE (after validation)
```javascript
// Background automatically sends:
{
  type: "STEP_ADVANCE",
  step: { /* Next step */ },
  stepIndex: 1,
  progress: { current: 2, total: 5, percentage: 20 }
}
```

### 3. Progress Monitoring

```javascript
// Popup → Background (polling every 1 second while popup open)
{ type: "GET_WALKTHROUGH_PROGRESS" }

// Response
{
  isActive: true,
  progress: {
    current: 2,
    total: 5,
    percentage: 40,
    state: "active",
    stepState: "active",
    stepId: "uuid"
  },
  currentStep: {
    id: "uuid",
    title: "Enter your email",
    description: "..."
  }
}
```

### 4. Command Rejection

During active walkthrough, non-walkthrough commands are rejected:

```javascript
// Attempting non-walkthrough command during active walkthrough
{ type: "CREATE_TARGET", data: {...} }

// Response
{
  rejected: true,
  error: "WALKTHROUGH_ACTIVE",
  message: "This action is not allowed during an active walkthrough",
  currentWalkthrough: {
    id: "session-uuid",
    title: "Onboarding Flow",
    progress: { current: 2, total: 5 }
  }
}
```

---

## Pseudocode: Interaction Blocking

### Event Interception Strategy

```
PSEUDOCODE: Block Non-Step Interactions

ON document EVENT (capture phase):
  IF walkthrough NOT active:
    ALLOW event
    RETURN
  
  IF event.target IS currentStep.targetElement:
    // Allow event on target
    CAPTURE event data for validation
    ALLOW event to propagate
    RETURN
  
  IF event.target IS walkthrough UI element:
    // Allow interactions with walkthrough controls
    ALLOW event
    RETURN
  
  // Block all other interactions
  PREVENT DEFAULT
  STOP PROPAGATION
  STOP IMMEDIATE PROPAGATION
  
  SHOW visual feedback (red pulse at cursor)
  LOG blocked interaction to background
  
  RETURN false
```

### Visual Blocking: Overlay with Hole

```
PSEUDOCODE: Create Overlay with Clickable Hole

FUNCTION createBlockingOverlay():
  
  // 1. Full-screen overlay with semi-transparent background
  overlay = CREATE div
  overlay.style = {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0, 0, 0, 0.75)",
    zIndex: 2147483640,
    pointerEvents: "auto"  // Catch all clicks
  }
  
  // 2. "Hole" cutout at target element position
  hole = CREATE div
  hole.style = {
    position: "absolute",
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + (padding * 2),
    height: targetRect.height + (padding * 2),
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",  // Creates visual cutout
    borderRadius: "8px",
    pointerEvents: "none"  // Clicks pass through to target
  }
  
  // 3. Add to DOM
  APPEND overlay TO document.body
  APPEND hole TO overlay
  
  // 4. Track target element movement
  START observer TO update hole position
```

### Navigation Prevention

```
PSEUDOCODE: Prevent Navigation Outside Scope

// Intercept all navigation attempts

ON BEFOREUNLOAD:
  IF walkthrough.active:
    PREVENT default
    SHOW confirmation dialog
    RETURN "Walkthrough in progress..."

ON CLICK (capture phase):
  element = GET element from event
  
  IF element IS anchor tag:
    href = element.getAttribute("href")
    
    IF href IS within allowed scope:
      ALLOW  // Navigation to allowed URLs
    ELSE:
      PREVENT default
      SHOW navigation blocked modal
      LOG blocked navigation
      
ON HISTORY.PUSHSTATE / HISTORY.REPLACESTATE:
  IF walkthrough.active:
    IF new URL IS NOT in allowed scope:
      PREVENT state change
      LOG blocked navigation
      
ON FORM SUBMIT:
  IF form IS NOT currentStep.target:
    PREVENT default
    SHOW blocked feedback
```

---

## Validation Examples

### Example 1: Simple Click Validation

```javascript
// Step: "Click the Login Button"
{
  title: "Click the Login Button",
  targetSelector: "#login-btn",
  requiredAction: "click",
  validationRules: [
    { rule: "clicked", required: true }
  ],
  blocking: {
    blockClicks: true,
    blockNavigation: true
  }
}
```

### Example 2: Input with Pattern Validation

```javascript
// Step: "Enter Your Email"
{
  title: "Enter Your Email",
  targetSelector: "#email-input",
  requiredAction: "input",
  validationRules: [
    { 
      rule: "value_regex", 
      value: "^[\\w.-]+@[\\w.-]+\\.\\w+$",
      errorMessage: "Please enter a valid email address"
    }
  ],
  blocking: {
    blockClicks: true,
    blockInput: true  // Only allow typing in target
  },
  timing: {
    minDuration: 2000  // At least 2 seconds on this step
  }
}
```

### Example 3: Navigation Validation

```javascript
// Step: "Navigate to Dashboard"
{
  title: "Navigate to Dashboard",
  targetSelector: "a[href='/dashboard']",
  requiredAction: "click",
  validationRules: [
    { rule: "clicked" },
    { 
      rule: "navigated", 
      value: "/dashboard.*",
      required: true  // Must navigate to proceed
    }
  ],
  blocking: {
    blockNavigation: false  // Allow navigation for this step
  }
}
```

### Example 4: Multi-Condition Form Validation

```javascript
// Step: "Complete Registration Form"
{
  title: "Complete Registration Form",
  targetSelector: "#signup-form",
  requiredAction: "submit",
  validationRules: [
    { 
      rule: "element_visible", 
      value: "#signup-form",
      errorMessage: "Form must be visible"
    },
    { 
      rule: "element_hidden", 
      value: ".error-message",
      errorMessage: "Fix form errors before submitting"
    },
    { 
      rule: "form_valid",
      value: "#signup-form",
      errorMessage: "Form validation failed"
    },
    { rule: "submit" }
  ],
  blocking: {
    blockClicks: true,
    blockInput: false,   // Allow form input
    blockNavigation: true,
    blockKeyboard: false // Allow tab navigation
  }
}
```

### Example 5: Custom Function Validation

```javascript
// Step: "Accept Terms (scroll to bottom first)"
{
  title: "Accept Terms and Conditions",
  targetSelector: "#accept-terms-checkbox",
  requiredAction: "check",
  validationRules: [
    { rule: "clicked" },
    { 
      rule: "custom_fn",
      customFn: "hasScrolledTerms",
      params: { minScrollPercent: 90 },
      errorMessage: "Please read the terms by scrolling to the bottom"
    }
  ]
}

// Custom validation function (executed in content script)
function hasScrolledTerms(params) {
  const termsContainer = document.querySelector('#terms-scrollarea');
  if (!termsContainer) return false;
  
  const scrollPercent = 
    (termsContainer.scrollTop + termsContainer.clientHeight) / 
    termsContainer.scrollHeight;
  
  return scrollPercent >= (params.minScrollPercent / 100);
}
```

---

## State Machine Diagram

```
WALKTHROUGH STATE MACHINE

┌─────────┐
│  IDLE   │◀──────────────────────────────────┐
│ (start) │                                    │
└────┬────┘                                    │
     │ WALKTHROUGH_START                       │
     ▼                                         │
┌─────────┐     WALKTHROUGH_COMPLETE          │
│ ACTIVE  │──────────┬───────────────────────▶│
│ (step 0)│          │                        │
└────┬────┘          │                        │
     │               │ WALKTHROUGH_ABORT      │
     │ STEP_ADVANCE  │ (user exit/error)      │
     ▼               │                        │
┌─────────┐          │                        │
│ ACTIVE  │──────────┘                        │
│ (step 1)│                                   │
└────┬────┘                                   │
     │ ...                                     │
     ▼                                         │
┌─────────┐                                   │
│COMPLETED│◀──────────────────────────────────┘
└─────────┘

STEP STATE MACHINE (per step)

┌──────────┐
│ PENDING  │◀── STEP_RETRY (after failure)
└────┬─────┘
     │ STEP_ADVANCE from background
     ▼
┌──────────┐
│  ACTIVE  │
└────┬─────┘
     │ User performs requiredAction
     ▼
┌──────────┐
│VALIDATING│── Validation fails ─▶ FAILED
└────┬─────┘                        │
     │ Validation succeeds           │ STEP_RETRY
     ▼                               │
┌──────────┐◀────────────────────────┘
│COMPLETED │
└────┬─────┘
     │ Background sends STEP_ADVANCE
     ▼
(next step ACTIVE)
```

---

## Implementation Checklist

### Backend Integration

- [ ] Add `type` field to walkthrough schema (passive | active)
- [ ] Add `enforced` flag for active walkthroughs
- [ ] Store validation rules per step
- [ ] Add `blocking` configuration per step
- [ ] API endpoint to start active walkthrough
- [ ] API endpoint to validate step completion

### Extension Files

- [x] `walkthrough-models.js` - Data models and enums
- [x] `walkthrough-state-machine.js` - Background state machine
- [x] `walkthrough-overlay.js` - Content script overlay/blocking
- [x] Background script integration with command rejection
- [x] Popup UI with progress display (read-only)
- [x] Content script message handlers

### Testing Scenarios

1. **Basic Walkthrough Flow**
   - Start walkthrough on valid URL
   - Complete each step with correct action
   - Verify progression is sequential
   - Verify completion notification

2. **Interaction Blocking**
   - Try clicking outside target element
   - Try navigating to external URL
   - Try keyboard shortcuts
   - Verify all are blocked with feedback

3. **Validation Failure**
   - Perform incorrect action on step
   - Verify step doesn't advance
   - Verify error message displays
   - Verify can retry step

4. **State Persistence**
   - Start walkthrough
   - Reload page
   - Verify walkthrough resumes at same step
   - Verify overlay reappears

5. **Command Rejection**
   - Start walkthrough
   - Try to create target from popup
   - Verify command is rejected
   - Verify error message shows walkthrough active

6. **Early Exit**
   - Start walkthrough
   - Click exit button in popup
   - Confirm exit
   - Verify overlay removed
   - Verify state cleared

---

## Usage Example

```javascript
// Start a walkthrough from your application
async function startOnboarding() {
  const walkthrough = {
    id: "onboarding-v1",
    title: "Getting Started",
    scope: {
      type: "url_pattern",
      pattern: "/dashboard.*"
    },
    steps: [
      {
        title: "Create Your First Project",
        targetSelector: "#new-project-btn",
        requiredAction: "click",
        validationRules: [{ rule: "clicked" }]
      },
      {
        title: "Name Your Project",
        targetSelector: "#project-name-input",
        requiredAction: "input",
        validationRules: [
          { rule: "value_contains", value: "", errorMessage: "Project name cannot be empty" }
        ]
      }
    ]
  };
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Start walkthrough
  const result = await chrome.runtime.sendMessage({
    type: "WALKTHROUGH_START",
    walkthrough: walkthrough,
    tabId: tab.id
  });
  
  if (result.success) {
    console.log("Walkthrough started:", result.sessionId);
  } else {
    console.error("Failed to start:", result.error);
  }
}
```
