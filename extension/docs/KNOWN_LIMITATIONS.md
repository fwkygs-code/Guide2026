# Known Limitations & Documented Behaviors
## Walkthrough Engine v1.0.0

**Version:** 1.0.0  
**Last Updated:** 2026-02-08  
**Status:** Production Release

---

## 1. Known Limitations

### 1.1 Cross-Origin Iframe Targeting

**Limitation:** Walkthrough steps cannot target elements inside cross-origin iframes.

**Details:**
- Same-origin iframes: ✅ Supported
- Cross-origin iframes: ❌ Not supported

**Why:**
Browser security model (Same-Origin Policy) prevents JavaScript access to cross-origin iframe content. This is a fundamental web security feature that cannot be bypassed.

**Impact:**
- High: Walkthroughs on sites with embedded cross-origin widgets may fail
- Detection: System detects iframes and fails gracefully with clear error message

**Workarounds:**
1. Target elements outside the iframe
2. Use URL scope to skip iframe-heavy pages
3. Mark step as optional if iframe content is non-critical

**Future:**
v2.0 may introduce iframe proxy mechanisms for supported scenarios.

---

### 1.2 Screen Reader Support

**Limitation:** ARIA labels and live regions are partially implemented.

**Details:**
- Basic ARIA attributes: ✅ Present
- Live regions for step changes: ⚠️ Partial
- Screen reader optimized instructions: ❌ Missing

**Impact:**
- Medium: Visually impaired users may have reduced experience
- Core functionality still accessible via keyboard

**Planned Fix:**
v1.1 will add:
- Complete ARIA labeling
- Live region announcements
- Screen reader-only helper text

---

### 1.3 Browser-Level Shortcuts

**Limitation:** Cannot block browser-level keyboard shortcuts (Ctrl+T, F5, Alt+Left).

**Details:**
Content scripts cannot intercept browser chrome shortcuts. These are handled by the browser before reaching page JavaScript.

**Shortcuts That CAN Be Blocked:**
- Page-level shortcuts (Ctrl+S on page)
- Form submissions
- Link clicks

**Shortcuts That CANNOT Be Blocked:**
- Ctrl+T (new tab)
- Ctrl+W (close tab)
- F5 / Ctrl+R (reload)
- Alt+Left/Right (history navigation)
- Ctrl+L (focus address bar)

**Mitigation:**
- URL enforcement catches navigation attempts after shortcut use
- Session persistence allows recovery after reload
- Telemetry logs shortcut-triggered aborts

---

### 1.4 Reduced Motion Support

**Limitation:** `prefers-reduced-motion` is partially implemented.

**Details:**
```css
/* Current - partial */
@media (prefers-reduced-motion: reduce) {
  .ig-walkthrough-highlight {
    animation: none;
  }
}

/* Missing - hole transitions still animate */
```

**Impact:**
- Low: Users with motion sensitivity may experience some animations
- No flashing or strobing effects present

**Planned Fix:**
v1.1 will add complete reduced motion support including:
- Instant hole positioning (no transition)
- No pulse animations
- No ripple effects

---

### 1.5 Very Large DOM Performance

**Limitation:** Selector resolution may be slower on pages with >10,000 DOM nodes.

**Details:**
- Standard DOM (< 1,000 nodes): < 50ms resolution
- Large DOM (1,000 - 10,000 nodes): < 200ms resolution
- Very large DOM (> 10,000 nodes): 200-500ms resolution

**Impact:**
- Low: Most web pages have < 5,000 nodes
- UI remains responsive (async operations)

**Mitigation:**
- Selector engine uses efficient querySelector (not recursive walk)
- Mutation observer scope limited
- Cancellation tokens prevent indefinite waiting

**Future:**
v1.1 may add:
- IntersectionObserver for viewport-only targeting
- Selector caching for repeated resolutions

---

### 1.6 Dynamic Class Name Stability

**Limitation:** CSS-in-JS generated class names (e.g., CSS Modules, Styled Components) may change between builds.

**Details:**
Frameworks like React, Vue, Angular often generate hashed class names:
```html
<!-- React with CSS Modules -->
<button class="Button_hash_3x7k2">Save</button>
```

**Impact:**
- Medium: Walkthroughs targeting these classes may break after site redeploy

**Mitigation:**
- Stability scoring warns about hashed classes
- Fallback selectors recommended
- Text match fallback can help
- Use `data-testid` or `data-walkthrough-target` attributes instead

**Recommendation:**
Authors should use stable selectors:
```javascript
// ❌ Fragile
{ type: 'css_class', value: '.Button_hash_3x7k2' }

// ✅ Stable
{ type: 'test_id', value: 'save-button' }
{ type: 'css_id', value: '#save-btn' }
```

---

### 1.7 Shadow DOM Targeting

**Limitation:** Shadow DOM elements require special selector handling.

**Details:**
Standard selectors cannot pierce Shadow DOM boundaries:
```javascript
// This won't find the button inside shadow DOM
document.querySelector('my-component button');
```

**Impact:**
- Medium: Web components with Shadow DOM may not be targetable

**Workaround:**
Use `::shadow` piercing selector (deprecated in Chrome) or target the host element.

**Future:**
v1.1 may add:
- Shadow DOM piercing selector support
- Web component host targeting

---

## 2. Documented Behaviors

### 2.1 Normal Operation Behaviors

| Behavior | Expected | User Communication |
|----------|----------|-------------------|
| Overlay blocks page | Yes | Visual dimming + "Guided Walkthrough" header |
| Keyboard shortcuts blocked | Most | Noted in user manual |
| Escape key aborts | Yes | Immediate or confirmation dialog |
| Auto-timeout after 5min | Yes | "Walkthrough timed out" message |
| Step retry on failure | 3 attempts | "Please try again" guidance |

### 2.2 Failure Mode Behaviors

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Element not found | Shows "Looking for element..." | Waits 5s for DOM mutation |
| Selector resolution timeout | Shows "Element not found" | User can retry/abort |
| Validation fails (max retries) | Shows options | Retry/Skip(if admin)/Abort |
| URL scope violation | Redirects back | Automatic after 100ms |
| SPA navigation blocked | Shows modal | User can continue walkthrough |
| Iframe blocked | Shows "Cannot continue" | Skip (if optional) or Abort |
| Tab reload | Session recovery | Resumes at last step |

### 2.3 Edge Case Behaviors

| Scenario | Behavior |
|----------|----------|
| Multiple walkthroughs attempted | Rejects with "WALKTHROUGH_ALREADY_ACTIVE" |
| Rapid step advancement | Rate-limited, one step at a time |
| Popup closed during walkthrough | Walkthrough continues normally |
| Browser back button | URL enforcement catches, may abort |
| DevTools open | No special behavior, works normally |
| Incognito mode | Works normally, storage isolated |
| Multiple monitors | Overlay spans active monitor only |
| High DPI displays | Scales correctly (CSS pixel-based) |
| Zoomed page (Ctrl++/Ctrl+-) | Overlay and hole scale correctly |

---

## 3. Security Boundaries

### 3.1 What is Protected

| Protection | Mechanism |
|------------|-----------|
| Non-admin skip | Content script + background validation |
| Force abort | Admin mode check in background |
| URL escape | URL scope enforcement + SPA interceptor |
| Data exfiltration | Telemetry contains no DOM/PII |
| Storage overflow | Ring buffer with hard cap |

### 3.2 What is NOT Protected (Out of Scope)

| Scenario | Reason |
|----------|--------|
| Physical device compromise | Out of scope |
| Browser vulnerability | Chrome security team's responsibility |
| Malicious extension co-installed | Extension isolation is Chrome's responsibility |
| User social engineering | Training/UX issue |
| Network MITM | HTTPS prevents, extension doesn't add risk |

---

## 4. Performance Characteristics

### 4.1 Typical Performance

| Metric | Typical | Worst Case | Unit |
|--------|---------|------------|------|
| Step activation | 10-50 | 5000 | ms |
| Selector resolution | 5-20 | 5000 | ms |
| Event blocking latency | <1 | <5 | ms |
| Overlay positioning | 16 | 50 | ms |
| Memory per walkthrough | 2-5 | 10 | MB |
| CPU when idle | 0 | <1 | % |

### 4.2 Resource Limits

| Resource | Limit | Behavior at Limit |
|----------|-------|-------------------|
| Telemetry events | 1000 | Oldest evicted |
| Mutation wait time | 5000ms | Failure UI shown |
| Selector attempts | 10 | Fallback strategies exhausted |
| Step timeout | 300000ms | Auto-abort triggered |
| Concurrent walkthroughs | 1 | Second rejected |

---

## 5. Version History

| Version | Date | Changes | Limitations Addressed |
|---------|------|---------|----------------------|
| 1.0.0 | 2026-02-08 | Initial release | N/A |
| 1.1.0 (planned) | 2026-03 | ARIA, reduced motion | #2, #4 |
| 2.0.0 (planned) | 2026-06 | Iframe proxy, signing | #1, #6, #7 |

---

## 6. Support Escalation Matrix

| Issue | First Response | Escalation |
|-------|---------------|------------|
| Element not found | Check selector stability | Engineering if selectors are stable |
| Walkthrough won't start | Check URL scope | Engineering if scope correct |
| Skip button missing | Verify admin mode | By design - explain policy |
| Iframe error | Explain limitation | Feature request for v2.0 |
| Performance slow | Check DOM size | Engineering if < 1000 nodes |
| Screen reader issues | Document limitation | Priority fix for v1.1 |

---

## 7. Documentation References

- [Architecture](./WALKTHROUGH_ENGINE_ARCHITECTURE.md)
- [Security Model](./STRIDE_THREAT_MODEL.md)
- [Compliance Checklist](./COMPLIANCE_CHECKLIST.md)
- [Security Findings](./SECURITY_FINDINGS.md)
- [Hardening Report](./WALKTHROUGH_HARDENING_REPORT.md)

---

**End of Document**

**Questions?** Contact: security@interguide.app
