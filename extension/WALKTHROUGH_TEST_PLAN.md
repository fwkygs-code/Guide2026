# Walkthrough Engine QA & Test Plan

## Test Matrix

### Category A: Core Functionality

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| A1 | Basic step progression | 1. Start walkthrough<br>2. Complete step 1<br>3. Verify step 2 activates | Step 2 overlay appears, step 1 marked complete | P0 |
| A2 | Step validation - click | 1. Activate click step<br>2. Click target<br>3. Verify validation | Step completes, advances to next | P0 |
| A3 | Step validation - input | 1. Activate input step<br>2. Type in target<br>3. Verify validation | Validation passes on input matching rule | P0 |
| A4 | Step validation - navigation | 1. Activate navigation step<br>2. Navigate to expected URL<br>3. Verify step completes | Step completes, walkthrough continues | P0 |
| A5 | Completion flow | 1. Complete all steps<br>2. Verify completion state<br>3. Check cleanup | Overlay removed, session marked complete | P0 |

### Category B: Interaction Blocking

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| B1 | Click outside target | 1. Activate step<br>2. Click non-target element<br>3. Observe behavior | Click blocked, visual feedback shown | P0 |
| B2 | Keyboard shortcuts blocked | 1. Activate step<br>2. Press Ctrl+T (new tab)<br>3. Press Ctrl+S (save) | Shortcuts blocked while on step | P0 |
| B3 | Allowed keys on target | 1. Activate input step<br>2. Type allowed characters<br>3. Verify input works | Typing works when target is input | P0 |
| B4 | Link navigation blocked | 1. Activate step<br>2. Click external link<br>3. Observe behavior | Navigation blocked, modal shown | P0 |
| B5 | Form submission blocked | 1. Activate non-submit step<br>2. Try to submit form<br>3. Observe behavior | Submission blocked if not target | P0 |

### Category C: URL Enforcement

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| C1 | Manual URL change | 1. Activate step on /page-a<br>2. Type /page-b in address bar<br>3. Navigate | Redirect back to /page-a | P0 |
| C2 | Link to external site | 1. Activate step<br>2. Click link to external.com<br>3. Observe behavior | Navigation blocked or redirected | P0 |
| C3 | SPA router navigation | 1. Activate step on /dashboard<br>2. Trigger SPA navigation to /settings<br>3. Observe behavior | pushState blocked or redirected | P0 |
| C4 | Allowed SPA navigation | 1. Activate step expecting /step-2<br>2. Trigger navigation to /step-2<br>3. Observe behavior | Navigation allowed, step completes | P0 |
| C5 | URL scope regex | 1. Configure regex scope<br>2. Test matching URLs<br>3. Test non-matching URLs | Only matching URLs allow step | P1 |

### Category D: Selector Robustness

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| D1 | Primary selector found | 1. Create step with ID selector<br>2. Start walkthrough<br>3. Verify target found | Target highlighted immediately | P0 |
| D2 | Fallback selector used | 1. Create step with broken primary, working fallback<br>2. Start walkthrough | Fallback selector finds target | P0 |
| D3 | DOM mutation retry | 1. Start step before element exists<br>2. Element added via JS<br>3. Verify step activates | Step activates when element appears | P1 |
| D4 | Text match fallback | 1. Create step with text match<br>2. Remove primary selector target<br>3. Verify text match works | Text match finds alternative | P1 |
| D5 | All selectors fail | 1. Create step with all broken selectors<br>2. Start walkthrough<br>3. Observe behavior | Graceful failure with retry UI | P0 |
| D6 | Selector stability scoring | 1. Test ID selector (score 1.0)<br>2. Test hashed class (score <0.5)<br>3. Verify warnings | Appropriate stability scores assigned | P2 |

### Category E: Failure Handling

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| E1 | Step validation fail | 1. Activate step<br>2. Perform wrong action<br>3. Observe retry flow | Retry allowed, guidance shown | P0 |
| E2 | Max retries exceeded | 1. Fail step 3 times<br>2. Observe max retry behavior | Failure dialog with options | P0 |
| E3 | Element not found | 1. Delete target element<br>2. Start step<br>3. Observe behavior | "Looking for element" UI shown | P0 |
| E4 | Step abort | 1. Activate step<br>2. Click abort<br>3. Confirm | Walkthrough ends, overlay removed | P0 |
| E5 | Timeout auto-abort | 1. Activate step<br>2. Wait 5+ minutes<br>3. No interaction | Auto-abort triggered | P1 |

### Category F: Recovery & Persistence

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| F1 | Tab reload mid-step | 1. Activate step<br>2. Reload tab<br>3. Verify recovery | Step restored at same position | P0 |
| F2 | Browser restart | 1. Start walkthrough<br>2. Close browser<br>3. Reopen, restore session | Walkthrough state recovered | P1 |
| F3 | Content script crash | 1. Activate step<br>2. Trigger content script error<br>3. Observe recovery | Graceful degradation, recovery attempt | P1 |
| F4 | Session storage full | 1. Fill storage<br>2. Start walkthrough<br>3. Observe behavior | Graceful handling, telemetry dropped | P2 |

### Category G: Iframe Handling

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| G1 | Same-origin iframe | 1. Create step targeting iframe element<br>2. Start walkthrough | Element found, step proceeds | P1 |
| G2 | Cross-origin iframe detection | 1. Page with cross-origin iframe<br>2. Step requiring iframe access<br>3. Start walkthrough | Early failure with clear message | P0 |
| G3 | Cross-origin without requirement | 1. Page with cross-origin iframe<br>2. Step NOT requiring iframe<br>3. Start walkthrough | Walkthrough proceeds normally | P1 |
| G4 | Iframe element target | 1. Create step with iframeSelector<br>2. Target element inside<br>3. Verify activation | Target inside iframe highlighted | P1 |

### Category H: Admin & Debug Features

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| H1 | Admin mode activation | 1. Enable admin mode in storage<br>2. Open popup<br>3. Verify debug panel | Debug panel visible | P1 |
| H2 | Force abort (admin) | 1. Start walkthrough as user<br>2. Admin opens popup<br>3. Click force abort | Walkthrough aborts immediately | P0 |
| H3 | Exit button hidden (user) | 1. Ensure non-admin mode<br>2. Start walkthrough<br>3. Open popup | Exit button not visible | P0 |
| H4 | Telemetry viewer | 1. Complete walkthrough<br>2. Open admin telemetry<br>3. Verify events logged | All events visible with timestamps | P1 |
| H5 | Debug overlay | 1. Enable admin mode<br>2. Start walkthrough<br>3. Verify debug widget | Floating debug widget visible | P2 |
| H6 | Export telemetry | 1. Open admin panel<br>2. Click export<br>3. Verify download | JSON file downloads with telemetry | P2 |

### Category I: Performance & Cleanup

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| I1 | Memory leak check | 1. Start 10 walkthroughs sequentially<br>2. Check memory usage | Memory returns to baseline | P1 |
| I2 | Event listener cleanup | 1. Complete walkthrough<br>2. Check for orphaned listeners | No walkthrough listeners remain | P0 |
| I3 | Overlay singleton | 1. Rapidly start/stop walkthroughs<br>2. Check DOM | Only one overlay element ever exists | P0 |
| I4 | No polling when idle | 1. Complete step<br>2. Check for setInterval/setTimeout | No active timers except safety timeout | P1 |
| I5 | Selector resolution performance | 1. Test selector resolution time<br>2. Verify <100ms | Resolution completes quickly | P1 |

### Category J: Security

| Test ID | Test Case | Steps | Expected Result | Priority |
|---------|-----------|-------|-------------------|----------|
| J1 | chrome:// blocking | 1. Try to start on chrome://extensions<br>2. Observe behavior | Walkthrough blocked, error shown | P0 |
| J2 | Privilege escalation attempt | 1. Try to access background via content script<br>2. Verify isolation | No unauthorized access possible | P0 |
| J3 | Data sanitization | 1. Check telemetry for PII<br>2. Verify no user data | No personal information in telemetry | P0 |
| J4 | Admin validation | 1. Try to call forceAbort without admin mode<br>2. Verify rejection | Operation rejected | P0 |

## Automated Test Scripts

### Script 1: Core Flow Test (Puppeteer/Playwright)
```javascript
// tests/core-flow.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Walkthrough Core Flow', () => {
  test('complete basic walkthrough', async ({ page, context }) => {
    // Load extension
    const extensionId = await loadExtension(context);
    
    // Create simple test page
    await page.goto(`file://${__dirname}/fixtures/test-page.html`);
    
    // Inject walkthrough via background
    await page.evaluate((extId) => {
      chrome.runtime.sendMessage(extId, {
        type: 'WALKTHROUGH_START',
        walkthrough: {
          id: 'test-walkthrough',
          steps: [
            {
              id: 'step-1',
              title: 'Click Button',
              targetSelectors: {
                primary: { type: 'css_id', value: '#test-btn' }
              },
              validation: { rule: 'clicked' }
            }
          ]
        }
      });
    }, extensionId);
    
    // Verify overlay appears
    const overlay = await page.locator('.ig-walkthrough-overlay');
    await expect(overlay).toBeVisible();
    
    // Click target
    await page.click('#test-btn');
    
    // Verify step completes
    await expect(page.locator('.ig-walkthrough-tooltip')).toContainText('Complete');
  });
});
```

### Script 2: Interaction Blocking Test
```javascript
// tests/interaction-blocking.spec.js
test.describe('Interaction Blocking', () => {
  test('blocks clicks outside target', async ({ page }) => {
    // Setup walkthrough
    await startWalkthrough(page, singleStepConfig);
    
    // Verify overlay blocks external clicks
    let blocked = false;
    page.on('console', msg => {
      if (msg.text().includes('blocked')) blocked = true;
    });
    
    await page.click('#external-link');
    
    // Verify link navigation was blocked
    expect(blocked).toBe(true);
    expect(page.url()).not.toContain('external.com');
  });
  
  test('blocks keyboard shortcuts', async ({ page }) => {
    await startWalkthrough(page, singleStepConfig);
    
    // Try Ctrl+T (new tab)
    await page.keyboard.down('Control');
    await page.keyboard.down('t');
    await page.keyboard.up('t');
    await page.keyboard.up('Control');
    
    // Verify new tab was not opened
    const pages = context.pages();
    expect(pages.length).toBe(1);
  });
});
```

### Script 3: URL Enforcement Test
```javascript
// tests/url-enforcement.spec.js
test.describe('URL Enforcement', () => {
  test('redirects when leaving step scope', async ({ page }) => {
    // Start walkthrough on /dashboard
    await page.goto('http://localhost:3000/dashboard');
    await startWalkthrough(page, dashboardStepConfig);
    
    // Try to navigate to /settings
    await page.goto('http://localhost:3000/settings');
    
    // Verify redirected back to dashboard
    await page.waitForURL('http://localhost:3000/dashboard');
  });
  
  test('blocks SPA router navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await startWalkthrough(page, dashboardStepConfig);
    
    // Try SPA navigation
    await page.evaluate(() => {
      history.pushState({}, '', '/settings');
    });
    
    // Verify URL unchanged or redirected
    expect(page.url()).toContain('/dashboard');
  });
});
```

### Script 4: Selector Robustness Test
```javascript
// tests/selector-robustness.spec.js
test.describe('Selector Robustness', () => {
  test('uses fallback when primary fails', async ({ page }) => {
    const stepConfig = {
      targetSelectors: {
        primary: { type: 'css_id', value: '#nonexistent' },
        fallbacks: [
          { type: 'css_class', value: '.target-btn' }
        ]
      }
    };
    
    await startWalkthrough(page, stepConfig);
    
    // Wait for fallback to resolve
    await page.waitForSelector('.ig-walkthrough-hole', { timeout: 1000 });
    
    // Verify target was found via fallback
    const hole = await page.locator('.ig-walkthrough-hole');
    await expect(hole).toBeVisible();
  });
  
  test('waits for DOM mutations', async ({ page }) => {
    // Start step before element exists
    await page.goto('http://localhost:3000/');
    
    const stepConfig = {
      targetSelectors: {
        primary: { type: 'css_id', value: '#delayed-element' }
      }
    };
    
    await startWalkthrough(page, stepConfig);
    
    // Element not found yet
    await expect(page.locator('.ig-walkthrough-tooltip')).toContainText('Looking');
    
    // Add element via script
    await page.evaluate(() => {
      setTimeout(() => {
        const btn = document.createElement('button');
        btn.id = 'delayed-element';
        btn.textContent = 'Click Me';
        document.body.appendChild(btn);
      }, 500);
    });
    
    // Verify step activates when element appears
    await page.waitForSelector('.ig-walkthrough-hole', { timeout: 2000 });
  });
});
```

## Manual QA Checklist

### Pre-Release QA
- [ ] Test on Chrome, Firefox, Edge (Chromium)
- [ ] Test on Windows, macOS, Linux
- [ ] Test on 1080p, 1440p, 4K displays
- [ ] Test on mobile viewport (emulated)
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Test with high contrast mode
- [ ] Test with reduced motion preference
- [ ] Test on slow 3G throttling
- [ ] Test with 200ms latency

### Security Audit
- [ ] Verify no eval() or new Function() usage
- [ ] Check all message handlers sanitize input
- [ ] Verify CSP compliance
- [ ] Test XSS resistance on tooltip content
- [ ] Verify no sensitive data in telemetry

### Accessibility Audit
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces all state changes
- [ ] Focus trap works in tooltip
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Touch targets are 44x44px minimum

## Continuous Integration

### Pre-commit Hooks
```yaml
# .github/workflows/test.yml
name: Walkthrough Engine Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Unit Tests
        run: npm run test:unit
      
      - name: E2E Tests
        run: npm run test:e2e
        env:
          CI: true
      
      - name: Security Audit
        run: npm audit --audit-level moderate
      
      - name: Coverage Report
        uses: codecov/codecov-action@v3
```

## Performance Benchmarks

| Metric | Target | Test |
|--------|--------|------|
| Overlay activation | <100ms | Measure from message to hole visible |
| Selector resolution | <50ms | Measure DOM query time |
| Event blocking latency | <1ms | Measure capture handler time |
| Step transition | <300ms | Measure old step hide to new step show |
| Memory per walkthrough | <5MB | Heap snapshot comparison |
| CPU idle overhead | 0% | No active timers when idle |
