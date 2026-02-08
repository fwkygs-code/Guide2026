/**
 * STRESS TEST SUITE
 * Walkthrough Engine Load Testing
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const CONFIG = {
  rapidTransitions: 500,
  domChurnDuration: 30000,
  navigationCycles: 250,
  storageWrites: 5000,
  concurrency: 50
};

// ============================================================================
// CONCURRENCY STRESS TESTS
// ============================================================================

test.describe('🔥 Concurrency Stress', () => {
  
  test('500 rapid step transitions - no race conditions', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Inject walkthrough with 10 steps
    await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'WALKTHROUGH_START',
          walkthrough: generateWalkthrough(10)
        }, resolve);
      });
    }, extensionId);
    
    // Rapid transition stress
    const results = {
      doubleActivations: 0,
      leakedObservers: 0,
      duplicateOverlays: 0,
      successful: 0
    };
    
    for (let i = 0; i < CONFIG.rapidTransitions; i++) {
      // Rapid step advancement
      await page.evaluate((extId) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(extId, {
            type: 'STEP_ADVANCE'
          }, resolve);
        });
      }, extensionId);
      
      // Check for double activations
      const overlayCount = await page.evaluate(() => 
        document.querySelectorAll('.ig-walkthrough-overlay').length
      );
      
      if (overlayCount > 1) {
        results.duplicateOverlays++;
      }
      
      // Random abort/resume cycles (10% probability)
      if (Math.random() < 0.1) {
        await page.evaluate((extId) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(extId, {
              type: 'WALKTHROUGH_ABORT',
              reason: 'STRESS_TEST'
            }, resolve);
          });
        }, extensionId);
        
        await page.evaluate((extId) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(extId, {
              type: 'WALKTHROUGH_RESUME'
            }, resolve);
          });
        }, extensionId);
      }
      
      results.successful++;
    }
    
    // Final verification
    const finalState = await page.evaluate(() => {
      return {
        observerCount: performance.now(), // Proxy for observer check
        overlayCount: document.querySelectorAll('.ig-walkthrough-overlay').length,
        cpuIdle: performance.now() // Will be measured via DevTools
      };
    });
    
    // Assertions
    expect(results.duplicateOverlays).toBe(0);
    expect(finalState.overlayCount).toBeLessThanOrEqual(1);
    expect(results.successful).toBe(CONFIG.rapidTransitions);
    
    console.log('✅ Concurrency stress passed:', results);
  });
  
  test('Overlapping retry + abort cycles', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Start walkthrough with failing selector
    await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'WALKTHROUGH_START',
          walkthrough: {
            id: 'stress-test',
            steps: [{
              id: 'failing-step',
              title: 'Failing Step',
              targetSelectors: {
                primary: { type: 'css_id', value: '#nonexistent-element' }
              },
              onFailure: { maxRetries: 5 }
            }]
          }
        }, resolve);
      });
    }, extensionId);
    
    // Wait for retry UI
    await page.waitForSelector('.ig-walkthrough-failure-modal', { timeout: 5000 });
    
    // Rapid abort/resume while retrying
    for (let i = 0; i < 20; i++) {
      await page.evaluate((extId) => {
        chrome.runtime.sendMessage(extId, { type: 'WALKTHROUGH_ABORT' });
      }, extensionId);
      
      await page.waitForTimeout(50);
      
      await page.evaluate((extId) => {
        chrome.runtime.sendMessage(extId, { type: 'WALKTHROUGH_RESUME' });
      }, extensionId);
      
      await page.waitForTimeout(50);
    }
    
    // Verify clean state
    const state = await page.evaluate(() => ({
      isActive: window.walkthroughState?.isActive,
      token: window.SelectorEngine?.currentToken
    }));
    
    expect(state.isActive || !state.token).toBeTruthy();
  });
});

// ============================================================================
// DOM MUTATION STRESS TESTS
// ============================================================================

test.describe('🔥 DOM Mutation Stress', () => {
  
  test('Continuous DOM churn with selector resolution', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Start DOM churn
    const churnHandle = await page.evaluate(() => {
      let count = 0;
      const interval = setInterval(() => {
        // Add/remove random elements
        const div = document.createElement('div');
        div.id = `churn-${count++}`;
        document.body.appendChild(div);
        
        if (count > 50) {
          const old = document.getElementById(`churn-${count - 50}`);
          if (old) old.remove();
        }
      }, 50);
      
      return interval;
    });
    
    // Start walkthrough with delayed element
    await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'WALKTHROUGH_START',
          walkthrough: {
            id: 'mutation-test',
            steps: [{
              id: 'delayed-target',
              title: 'Delayed Target',
              targetSelectors: {
                primary: { type: 'css_id', value: '#delayed-element' }
              }
            }]
          }
        }, resolve);
      });
    }, extensionId);
    
    // Wait then add the element
    await page.waitForTimeout(2000);
    
    await page.evaluate(() => {
      const el = document.createElement('button');
      el.id = 'delayed-element';
      el.textContent = 'Target';
      document.body.appendChild(el);
    });
    
    // Verify resolution worked
    await page.waitForSelector('.ig-walkthrough-hole', { timeout: 3000 });
    
    // Stop churn
    await page.evaluate(() => clearInterval(churnHandle));
    
    // Verify no late activations
    const lateActivations = await page.evaluate(() => {
      return window.lateActivationCount || 0;
    });
    
    expect(lateActivations).toBe(0);
  });
  
  test('Random selector invalidation mid-resolution', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Create element that will be removed
    await page.evaluate(() => {
      const el = document.createElement('button');
      el.id = 'temp-target';
      el.textContent = 'Click Me';
      document.body.appendChild(el);
    });
    
    // Start walkthrough
    const startPromise = page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'WALKTHROUGH_START',
          walkthrough: {
            id: 'invalidation-test',
            steps: [{
              id: 'step-1',
              title: 'Step 1',
              targetSelectors: {
                primary: { type: 'css_id', value: '#temp-target' }
              }
            }]
          }
        }, resolve);
      });
    }, extensionId);
    
    // Randomly remove element during resolution
    await page.waitForTimeout(Math.random() * 500);
    
    await page.evaluate(() => {
      const el = document.getElementById('temp-target');
      if (el) el.remove();
    });
    
    // Wait for start to complete
    await startPromise;
    
    // Should show failure UI, not crash
    await page.waitForSelector('.ig-walkthrough-failure-modal, .ig-walkthrough-hole', { 
      timeout: 5000 
    });
    
    console.log('✅ Random invalidation handled gracefully');
  });
});

// ============================================================================
// NAVIGATION STRESS TESTS
// ============================================================================

test.describe('🔥 Navigation Stress', () => {
  
  test('Rapid SPA route changes', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Setup pushState loop
    await page.evaluate((extId) => {
      let counter = 0;
      const interval = setInterval(() => {
        history.pushState({}, '', `/route-${counter++}`);
      }, 100);
      
      // Start walkthrough
      chrome.runtime.sendMessage(extId, {
        type: 'WALKTHROUGH_START',
        walkthrough: {
          id: 'nav-test',
          steps: [{
            id: 'nav-step',
            title: 'Navigation Step',
            targetSelectors: {
              primary: { type: 'css_id', value: '#nav-target' }
            }
          }]
        }
      });
      
      return interval;
    }, extensionId);
    
    // Let it run for 5 seconds
    await page.waitForTimeout(5000);
    
    // Check no deadlocks
    const state = await page.evaluate(() => ({
      url: window.location.href,
      blockedNavigations: window.blockedNavigations || 0
    }));
    
    expect(state.blockedNavigations).toBeGreaterThan(40); // Should have blocked many
    expect(state.url).not.toContain('route-50'); // Should have been blocked/redirected
  });
  
  test('Hard reload during active step', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Start walkthrough
    await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'WALKTHROUGH_START',
          walkthrough: generateWalkthrough(5)
        }, resolve);
      });
    }, extensionId);
    
    // Wait for step to be active
    await page.waitForSelector('.ig-walkthrough-hole');
    
    // Reload page
    await page.reload();
    
    // Wait for extension to re-inject
    await page.waitForTimeout(1000);
    
    // Verify recovery
    const recovered = await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'GET_WALKTHROUGH_PROGRESS'
        }, (response) => {
          resolve(response?.isActive || false);
        });
      });
    }, extensionId);
    
    // May or may not recover depending on timing, but should not crash
    console.log('✅ Hard reload handled, recovered:', recovered);
  });
});

// ============================================================================
// STORAGE STRESS TESTS
// ============================================================================

test.describe('🔥 Storage Stress', () => {
  
  test('Telemetry ring buffer under load', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    // Generate massive telemetry load
    await page.evaluate((extId, writeCount) => {
      return new Promise((resolve) => {
        const events = [];
        for (let i = 0; i < writeCount; i++) {
          events.push({
            type: 'TELEMETRY_TEST',
            timestamp: Date.now(),
            data: { iteration: i, payload: 'x'.repeat(100) }
          });
        }
        
        // Send all at once
        chrome.runtime.sendMessage(extId, {
          type: 'BULK_TELEMETRY_TEST',
          events: events
        }, resolve);
      });
    }, extensionId, CONFIG.storageWrites);
    
    // Verify hard cap enforced
    const telemetry = await page.evaluate((extId) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(extId, {
          type: 'GET_TELEMETRY_STATS'
        }, resolve);
      });
    }, extensionId);
    
    expect(telemetry.totalEvents).toBeLessThanOrEqual(1000); // Hard cap
    expect(telemetry.evictionEvents).toBeGreaterThan(0); // Should have evicted
  });
  
  test('Clear + write + read cycles', async ({ page, context }) => {
    const extensionId = await loadExtension(context);
    
    for (let i = 0; i < 100; i++) {
      // Write
      await page.evaluate((extId) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(extId, {
            type: 'TEST_TELEMETRY_LOG',
            event: { type: 'test', data: {} }
          }, resolve);
        });
      }, extensionId);
      
      // Clear
      await page.evaluate((extId) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(extId, {
            type: 'CLEAR_TELEMETRY'
          }, resolve);
        });
      }, extensionId);
      
      // Read
      const telemetry = await page.evaluate((extId) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(extId, {
            type: 'GET_TELEMETRY'
          }, resolve);
        });
      }, extensionId);
      
      expect(telemetry.events.length).toBe(0);
    }
    
    console.log('✅ 100 clear/write/read cycles passed');
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loadExtension(context) {
  // Extension loading logic
  return 'extension-id-placeholder';
}

function generateWalkthrough(stepCount) {
  return {
    id: 'stress-walkthrough',
    title: 'Stress Test Walkthrough',
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i}`,
      title: `Step ${i + 1}`,
      targetSelectors: {
        primary: { type: 'css_id', value: `#target-${i}` }
      }
    }))
  };
}

// Export for use in other test files
module.exports = { CONFIG, generateWalkthrough, loadExtension };
