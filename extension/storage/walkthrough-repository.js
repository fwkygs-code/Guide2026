/**
 * WALKTHROUGH REPOSITORY
 * Persistence layer for walkthroughs with draft/published/archived states
 */

const STORAGE_KEYS = {
  PUBLISHED: 'ig_published_walkthroughs',
  DRAFT_PREFIX: 'ig_draft_walkthrough_',
  PROGRESS_PREFIX: 'ig_user_progress_',
  COMPLETED: 'ig_completed_walkthroughs'
};

/**
 * Repository for walkthrough CRUD operations
 */
class WalkthroughRepository {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Create new draft walkthrough
   */
  async createDraft(walkthroughData) {
    const walkthrough = {
      walkthroughId: crypto.randomUUID(),
      name: walkthroughData.name,
      description: walkthroughData.description || '',
      startUrl: walkthroughData.startUrl,
      targetUrls: walkthroughData.targetUrls || [walkthroughData.startUrl],
      steps: [],
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: walkthroughData.createdBy || 'unknown',
      version: 1,
      settings: {
        autoStart: walkthroughData.autoStart || false,
        showProgressBar: walkthroughData.showProgressBar !== false,
        allowSkip: walkthroughData.allowSkip || false,
        requireCompletion: walkthroughData.requireCompletion !== false
      }
    };

    await this.saveDraft(walkthrough);
    return walkthrough;
  }

  /**
   * Save draft walkthrough
   */
  async saveDraft(walkthrough) {
    walkthrough.updatedAt = Date.now();
    walkthrough.status = 'draft';
    
    await chrome.storage.local.set({
      [`${STORAGE_KEYS.DRAFT_PREFIX}${walkthrough.walkthroughId}`]: walkthrough
    });
    
    this.cache.set(walkthrough.walkthroughId, walkthrough);
    return walkthrough;
  }

  /**
   * Get draft by ID
   */
  async getDraft(walkthroughId) {
    // Check cache first
    const cached = this.cache.get(walkthroughId);
    if (cached && cached.status === 'draft') {
      return cached;
    }

    const stored = await chrome.storage.local.get([
      `${STORAGE_KEYS.DRAFT_PREFIX}${walkthroughId}`
    ]);
    
    return stored[`${STORAGE_KEYS.DRAFT_PREFIX}${walkthroughId}`] || null;
  }

  /**
   * Get all drafts
   */
  async getAllDrafts() {
    const all = await chrome.storage.local.get(null);
    const drafts = [];
    
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(STORAGE_KEYS.DRAFT_PREFIX)) {
        drafts.push(value);
      }
    }
    
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Publish walkthrough
   * Moves from draft to published, creates immutable version
   */
  async publish(walkthroughId) {
    const draft = await this.getDraft(walkthroughId);
    if (!draft) {
      throw new Error('Walkthrough not found');
    }

    if (draft.steps.length === 0) {
      throw new Error('Cannot publish walkthrough with no steps');
    }

    // Validate before publish
    const validation = await this.validateForPublish(draft);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Create published version
    const published = {
      ...draft,
      status: 'published',
      publishedAt: Date.now(),
      publishedBy: draft.createdBy,
      version: draft.version,
      isImmutable: true
    };

    // Get existing published walkthroughs
    const stored = await chrome.storage.local.get([STORAGE_KEYS.PUBLISHED]);
    const publishedMap = stored[STORAGE_KEYS.PUBLISHED] || {};

    // Add to published
    publishedMap[walkthroughId] = published;

    // Save
    await chrome.storage.local.set({
      [STORAGE_KEYS.PUBLISHED]: publishedMap
    });

    // Delete draft
    await this.deleteDraft(walkthroughId);

    // Update cache
    this.cache.set(walkthroughId, published);

    console.log('[IG Repository] Published walkthrough:', walkthroughId);
    return published;
  }

  /**
   * Get published walkthrough by ID
   */
  async getPublished(walkthroughId) {
    // Check cache
    const cached = this.cache.get(walkthroughId);
    if (cached && cached.status === 'published') {
      return cached;
    }

    const stored = await chrome.storage.local.get([STORAGE_KEYS.PUBLISHED]);
    const publishedMap = stored[STORAGE_KEYS.PUBLISHED] || {};
    
    const walkthrough = publishedMap[walkthroughId] || null;
    if (walkthrough) {
      this.cache.set(walkthroughId, walkthrough);
    }
    
    return walkthrough;
  }

  /**
   * Get all published walkthroughs
   */
  async getAllPublished() {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.PUBLISHED]);
    const publishedMap = stored[STORAGE_KEYS.PUBLISHED] || {};
    
    return Object.values(publishedMap).filter(w => w.status === 'published');
  }

  /**
   * Archive walkthrough (soft delete)
   */
  async archive(walkthroughId) {
    const walkthrough = await this.getPublished(walkthroughId);
    if (!walkthrough) {
      throw new Error('Walkthrough not found');
    }

    // Update status
    walkthrough.status = 'archived';
    walkthrough.archivedAt = Date.now();

    // Get published map
    const stored = await chrome.storage.local.get([STORAGE_KEYS.PUBLISHED]);
    const publishedMap = stored[STORAGE_KEYS.PUBLISHED] || {};

    // Remove from published (but keep archived separately if needed)
    delete publishedMap[walkthroughId];

    // Save archived version
    const archivedStored = await chrome.storage.local.get(['ig_archived_walkthroughs']);
    const archivedMap = archivedStored.ig_archived_walkthroughs || {};
    archivedMap[walkthroughId] = walkthrough;

    await chrome.storage.local.set({
      [STORAGE_KEYS.PUBLISHED]: publishedMap,
      ig_archived_walkthroughs: archivedMap
    });

    this.cache.delete(walkthroughId);

    console.log('[IG Repository] Archived walkthrough:', walkthroughId);
    return walkthrough;
  }

  /**
   * Delete draft permanently
   */
  async deleteDraft(walkthroughId) {
    await chrome.storage.local.remove([
      `${STORAGE_KEYS.DRAFT_PREFIX}${walkthroughId}`
    ]);
    
    this.cache.delete(walkthroughId);
    console.log('[IG Repository] Deleted draft:', walkthroughId);
  }

  /**
   * Create new version (for updates to published walkthroughs)
   */
  async createNewVersion(walkthroughId) {
    const published = await this.getPublished(walkthroughId);
    if (!published) {
      throw new Error('Published walkthrough not found');
    }

    // Create draft copy with incremented version
    const newVersion = {
      ...published,
      walkthroughId: crypto.randomUUID(), // New ID for new version
      originalId: walkthroughId,
      status: 'draft',
      version: published.version + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publishedAt: null,
      isImmutable: false
    };

    await this.saveDraft(newVersion);
    
    console.log('[IG Repository] Created version', newVersion.version, 'from', walkthroughId);
    return newVersion;
  }

  /**
   * Validate walkthrough before publishing
   */
  async validateForPublish(walkthrough) {
    const errors = [];
    const warnings = [];

    // Check name
    if (!walkthrough.name || walkthrough.name.length < 3) {
      errors.push('Name must be at least 3 characters');
    }

    // Check start URL
    if (!walkthrough.startUrl) {
      errors.push('Start URL is required');
    }

    // Check steps
    if (walkthrough.steps.length === 0) {
      errors.push('At least one step is required');
    }

    // Validate each step
    for (let i = 0; i < walkthrough.steps.length; i++) {
      const step = walkthrough.steps[i];

      // Check instruction
      if (!step.instruction || step.instruction.length < 5) {
        errors.push(`Step ${i + 1}: Instruction too short`);
      }

      // Check selector
      if (!step.targetSelectors || !step.targetSelectors.primary) {
        errors.push(`Step ${i + 1}: No target selector defined`);
      }

      // Check stability
      if (step.targetSelectors?.primary) {
        const stability = this.calculateStability(step.targetSelectors.primary);
        if (stability < 0.3) {
          errors.push(`Step ${i + 1}: Selector too fragile (stability: ${stability})`);
        } else if (stability < 0.6) {
          warnings.push(`Step ${i + 1}: Low selector stability (${stability})`);
        }
      }

      // Check URL scope
      if (!step.urlScope || !step.urlScope.value) {
        warnings.push(`Step ${i + 1}: No URL scope defined`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canPublish: errors.length === 0
    };
  }

  /**
   * Calculate selector stability score
   */
  calculateStability(selector) {
    const scores = {
      'css_id': 1.0,
      'test_id': 1.0,
      'aria_label': 0.95,
      'css_class': 0.5,
      'css_path': 0.3,
      'xpath': 0.3,
      'text_match': 0.4
    };

    let score = scores[selector.type] || 0.5;

    // Penalize hashed class names
    if (selector.type === 'css_class') {
      const isHashed = /[a-f0-9]{5,}/i.test(selector.raw);
      if (isHashed) score *= 0.5;
    }

    // Penalize long paths
    if (selector.type === 'css_path') {
      const depth = (selector.value.match(/>/g) || []).length + 1;
      if (depth > 3) score *= 0.5;
    }

    return Math.round(score * 100) / 100;
  }

  /**
   * Find walkthroughs matching current URL
   */
  async findWalkthroughsForUrl(url) {
    const published = await this.getAllPublished();
    
    return published.filter(w => {
      // Check if URL matches any target URL pattern
      return w.targetUrls.some(targetUrl => {
        if (targetUrl.includes('*')) {
          // Glob pattern
          const pattern = targetUrl.replace(/\*/g, '.*');
          return new RegExp(pattern).test(url);
        }
        return url.includes(targetUrl) || targetUrl.includes(url);
      });
    });
  }

  /**
   * Check if user has completed walkthrough
   */
  async hasUserCompleted(userId, walkthroughId) {
    const stored = await chrome.storage.local.get([
      `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`
    ]);
    
    const progress = stored[`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`] || {};
    const walkthroughProgress = progress[walkthroughId];
    
    return walkthroughProgress?.completed === true;
  }

  /**
   * Save user progress
   */
  async saveUserProgress(userId, walkthroughId, progress) {
    const stored = await chrome.storage.local.get([
      `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`
    ]);
    
    const userProgress = stored[`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`] || {};
    
    userProgress[walkthroughId] = {
      ...progress,
      walkthroughId,
      userId,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({
      [`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`]: userProgress
    });

    return userProgress[walkthroughId];
  }

  /**
   * Get user progress for walkthrough
   */
  async getUserProgress(userId, walkthroughId) {
    const stored = await chrome.storage.local.get([
      `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`
    ]);
    
    const progress = stored[`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`] || {};
    return progress[walkthroughId] || null;
  }

  /**
   * Get all progress for user
   */
  async getAllUserProgress(userId) {
    const stored = await chrome.storage.local.get([
      `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`
    ]);
    
    return stored[`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`] || {};
  }

  /**
   * Mark walkthrough as completed for user
   */
  async markCompleted(userId, walkthroughId) {
    const progress = await this.getUserProgress(userId, walkthroughId) || {};
    
    progress.completed = true;
    progress.completedAt = Date.now();
    progress.currentStep = -1; // Reset current step
    
    await this.saveUserProgress(userId, walkthroughId, progress);
    
    console.log('[IG Repository] Marked completed:', walkthroughId, 'for user:', userId);
    return progress;
  }

  /**
   * Clear all data (for testing)
   */
  async clearAll() {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(key =>
      key.startsWith('ig_draft_') ||
      key.startsWith('ig_published') ||
      key.startsWith('ig_archived') ||
      key.startsWith('ig_user_progress') ||
      key.startsWith('ig_completed')
    );
    
    await chrome.storage.local.remove(keysToRemove);
    this.cache.clear();
    
    console.log('[IG Repository] Cleared all walkthrough data');
  }
}

// Global instance
window.walkthroughRepository = new WalkthroughRepository();
