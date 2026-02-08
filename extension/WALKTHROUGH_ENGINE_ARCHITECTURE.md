# Walkthrough Engine Production Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKGROUND SCRIPT                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ State Machine   │  │ URL Enforcer    │  │ Telemetry       │               │
│  │ - Single source │  │ - Tab listener  │  │ - Event log     │               │
│  │   of truth      │  │ - Polling       │  │ - Analytics     │               │
│  │ - Step flow     │  │ - Force redirect│  │ - Debug export  │               │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘               │
│           │                   │                   │                        │
│           └───────────────────┼───────────────────┘                        │
│                               ▼                                            │
│                    ┌─────────────────┐                                   │
│                    │ Message Router  │                                   │
│                    │ ACK handling    │                                   │
│                    │ Command reject  │                                   │
│                    └────────┬────────┘                                   │
└─────────────────────────────┼──────────────────────────────────────────────┘
                              │ chrome.runtime.sendMessage
                              ▼
┌─────────────────────────────┼──────────────────────────────────────────────┐
│                         CONTENT SCRIPT                                     │
│                    ┌────────┴────────┐                                      │
│                    │ Core Controller │                                      │
│                    └────────┬────────┘                                      │
│           ┌─────────────────┼─────────────────┐                           │
│           ▼                 ▼                 ▼                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │
│  │ Selector Engine │ │ Interaction     │ │ Navigation      │             │
│  │ - Layered strat │ │ Blocker         │ │ Blocker         │             │
│  │ - Stability     │ │ - Event capture │ │ - History patch │             │
│  │ - DOM mutations │ │ - Key filter    │ │ - Link block    │             │
│  │ - Retry logic   │ │ - Target only   │ │ - URL check     │             │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘             │
│           │                   │                   │                      │
│           └───────────────────┼───────────────────┘                      │
│                               ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │ Overlay Manager   │                                  │
│                    │ - Single instance │                                  │
│                    │ - Hole positioning│                                  │
│                    │ - Cleanup         │                                  │
│                    └─────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           POPUP UI                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Progress View   │  │ Debug Panel     │  │ Admin Controls  │          │
│  │ - Step counter  │  │ (admin only)    │  │ - Force abort   │          │
│  │ - Progress bar  │  │ - Event log     │  │ - Telemetry     │          │
│  │ - Current step  │  │ - Target visual │  │ - Walkthroughs  │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Message Flow

### Step Activation Flow
```
Background                    Content Script
     │                              │
     ├─ ACTIVATE_OVERLAY ──────────>│
     │  {step, session, _ackId}     │
     │                              ├─ Find target element
     │                              ├─ Install interaction blockers
     │                              ├─ Position overlay hole
     │                              │
     │<──────── ACK ────────────────┤
     │  {ackId, success: true}      │
     │                              │
     ├─ STEP_ADVANCE ─────────────>│ (subsequent steps)
     │                              │
```

### Validation Flow
```
User Action   Content Script       Background
     │              │                  │
     ├─ click ─────>│                  │
     │              ├─ Check on target  │
     │              ├─ Capture event    │
     │              │                  │
     │              ├─ VALIDATION_REQ ─>│
     │              │  {eventData, _ackId}
     │              │                  ├─ Acquire lock
     │              │                  ├─ Validate rules
     │              │                  ├─ Mark complete
     │              │                  │
     │              │<─ VALIDATION_RES─┤
     │              │  {valid, stepId}  │
     │              │                  │
     │              ├─ Update UI       │
     │              ├─ Next step ready │
```

### SPA Navigation Detection
```
SPA Router    Content Script       Background
     │              │                  │
     ├─ pushState ─>│                  │
     │              ├─ Intercept        │
     │              ├─ Check allowed    │
     │              ├─ SPA_NAV_ATTEMPT ─>│
     │              │                  ├─ Check URL scope
     │              │                  ├─ If invalid:
     │              │                  │   ├─ FORCE_REDIRECT ─>│
     │              │                  │   │                  ├─ Navigate
     │              │                  │   │                  │
     │              │<─────────────────┘   │                  │
     │              │   Block or allow     │                  │
```

## Event Sequencing

### Normal Step Completion
```
1. User lands on step URL
2. Background: _enterStep()
3. Background: _sendWithAck(STEP_ADVANCE)
4. Content: activateStep()
5. Content: findTargetElement() [with retry]
6. Content: installInteractionBlockers()
7. Content: positionOverlayHole()
8. Content: send ACK
9. User performs action on target
10. Content: captureEvent()
11. Background: validateStep()
12. Background: _markStepCompleted()
13. Background: _enterStep(n+1)
```

### Step Failure & Retry
```
1. Step validation fails
2. Background: currentStepState = FAILED
3. Background: _releaseValidationLock()
4. Background: VALIDATION_RESULT {valid: false}
5. Content: showValidationFailure()
6. Content: Highlight target again
7. User retries action
8. Goto validation flow step 9
```

### Navigation Escape Attempt
```
1. User clicks external link
2. Content: click handler intercepts
3. Content: isUrlInScope() = false
4. Content: event.preventDefault()
5. Content: showNavigationBlockedModal()
6. Content: reportBlockedNavigation()
7. Background: Logs blocked attempt
8. User sees: "Please complete the current step first"
9. Overlay remains, step continues
```

## Failure & Recovery Branches

### Tab Reload During Step
```
1. Tab reloads
2. Content script re-injects
3. Content: Check session storage
4. Content: Request state recovery
5. Background: _loadPersistedSession()
6. Background: Re-enter current step
7. Content: Restore overlay at step
```

### Selector Not Found
```
1. activateStep() called
2. findTargetElement() with primary selector
3. primary: null (not found)
4. Try fallback selectors
5. Try text-based match
6. All fail:
   a. Content: showStepFailure('Element not found')
   b. Content: Start DOM mutation observer
   c. Retry every 500ms (max 10 attempts)
   d. Still fail: Notify background
7. Background: Mark step failed
8. Background: Offer admin retry/abort
```

### Content Script Disconnect
```
1. Port.onDisconnect fires
2. Background: contentScriptPorts.delete(tabId)
3. Background: Check if walkthrough active
4. If active: Start recovery timer (5s)
5. If no reconnection: auto-pause walkthrough
6. User can resume when content script reloads
```

### Auto-Timeout Abort
```
1. _startStepTimeout() starts 5min timer
2. No user activity for 5min
3. _safeForceAbort() triggered
4. Background: Log timeout abort telemetry
5. Background: Notify content script
6. Content: Remove overlay
7. Content: Show timeout message
8. Background: Clear session
```

## Data Flow Summary

| Component | Input | Output | Storage |
|-----------|-------|--------|---------|
| Background | Tab events, Content messages, Popup commands | Step commands, Redirects, ACKs | Session state, Telemetry, Admin mode |
| Content | Background commands, User events, DOM changes | Validation requests, Event captures, ACKs | Step state (transient) |
| Popup | User actions, Background status | Commands, Debug queries | None (ephemeral) |

## Security Boundaries

```
┌─────────────────────────────────────────┐
│           USERLAND (untrusted)          │
│  - Web page content                     │
│  - SPA router                           │
│  - User interactions                    │
└─────────────────────────────────────────┘
                    │
                    ▼ Blocked by overlay
┌─────────────────────────────────────────┐
│         CONTENT SCRIPT (trusted)        │
│  - Event interception                   │
│  - DOM querying                         │
│  - Visual overlay                       │
└─────────────────────────────────────────┘
                    │
                    ▼ chrome.runtime
┌─────────────────────────────────────────┐
│         BACKGROUND (authoritative)      │
│  - State machine                        │
│  - URL enforcement                      │
│  - Telemetry                            │
│  - Admin validation                     │
└─────────────────────────────────────────┘
```

## Performance Guarantees

| Operation | Guarantee | Implementation |
|-----------|-----------|----------------|
| Event blocking | <1ms overhead | Capture phase listeners |
| Selector resolution | <100ms or retry | DOM query + mutation observer |
| Overlay positioning | <50ms | CSS transforms, no layout thrashing |
| Message roundtrip | <10ms | chrome.runtime (local) |
| Memory per step | <1MB | Single overlay, cleanup after step |
| CPU (no activity) | 0% | No polling unless selector missing |

## Cleanup Checklist

### After Each Step
- [ ] Remove event listeners (except persistent navigation blockers)
- [ ] Clear mutation observer
- [ ] Reset target element reference
- [ ] Hide overlay (keep DOM element for reuse)

### After Walkthrough Complete/Abort
- [ ] Remove all event listeners
- [ ] Remove overlay from DOM
- [ ] Clear mutation observer
- [ ] Restore history.pushState/replaceState
- [ ] Clear session storage
- [ ] Clear telemetry (or archive)
- [ ] Remove URL enforcement listeners
- [ ] Clear all timers/timeouts
