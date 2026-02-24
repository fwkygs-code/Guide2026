import { DEFAULT_STORAGE_KEYS } from '../constants';

export class StorageManager {
  private readonly storagePrefix = 'walkthrough_';
  
  constructor() {
    this.initializeStorage();
  }
  
  private async initializeStorage(): Promise<void> {
    try {
      // Ensure storage is available and initialized
      const keys = await this.getAllKeys();
      if (keys.length === 0) {
        await this.setInitialData();
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }
  
  // Basic storage operations
  async get(key: string): Promise<any> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await chrome.storage.local.get(fullKey);
      return result[fullKey];
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error);
      throw error;
    }
  }
  
  async set(key: string, value: any): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await chrome.storage.local.set({ [fullKey]: value });
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error);
      throw error;
    }
  }
  
  async remove(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await chrome.storage.local.remove(fullKey);
    } catch (error) {
      console.error(`Failed to remove storage key ${key}:`, error);
      throw error;
    }
  }
  
  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      const fullKeys = keys.map(key => this.getFullKey(key));
      await chrome.storage.local.remove(fullKeys);
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }
  
  async getAllKeys(): Promise<string[]> {
    try {
      const items = await chrome.storage.local.get();
      return Object.keys(items)
        .filter(key => key.startsWith(this.storagePrefix))
        .map(key => key.substring(this.storagePrefix.length));
    } catch (error) {
      console.error('Failed to get all storage keys:', error);
      throw error;
    }
  }
  
  // Walkthrough-specific operations
  async setWalkthroughDefinition(walkthroughId: string, definition: any): Promise<void> {
    await this.set(`walkthrough_${walkthroughId}`, definition);
  }
  
  async getWalkthroughDefinition(walkthroughId: string): Promise<any> {
    return await this.get(`walkthrough_${walkthroughId}`);
  }
  
  async createSession(sessionId: string, walkthroughId: string, startStep: number): Promise<void> {
    const session = {
      id: sessionId,
      walkthroughId,
      currentStep: startStep,
      completedSteps: [],
      status: 'active',
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    await this.set(`session_${sessionId}`, session);
  }
  
  async updateSessionProgress(sessionId: string, progress: any): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const updatedSession = {
        ...session,
        ...progress,
        lastActivity: Date.now()
      };
      await this.set(`session_${sessionId}`, updatedSession);
    }
  }
  
  async getSession(sessionId: string): Promise<any> {
    return await this.get(`session_${sessionId}`);
  }
  
  async setSessionState(sessionId: string, state: any): Promise<void> {
    await this.set(`state_${sessionId}`, state);
  }
  
  async getSessionState(sessionId: string): Promise<any> {
    return await this.get(`state_${sessionId}`);
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.remove(`session_${sessionId}`),
      this.remove(`state_${sessionId}`)
    ]);
  }
  
  // Settings operations
  async getSettings(): Promise<any> {
    return await this.get('settings') || {};
  }
  
  async setSettings(settings: any): Promise<void> {
    await this.set('settings', settings);
  }
  
  async initializeDefaultSettings(defaultSettings: any): Promise<void> {
    const existingSettings = await this.getSettings();
    const mergedSettings = { ...defaultSettings, ...existingSettings };
    await this.setSettings(mergedSettings);
  }
  
  // Error logging operations
  async logError(errorEntry: any): Promise<void> {
    const logs = await this.getErrorLogs();
    logs.push(errorEntry);
    
    // Keep only last 1000 error logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await this.set('error_logs', logs);
  }
  
  async getErrorLogs(): Promise<any[]> {
    return await this.get('error_logs') || [];
  }
  
  async clearErrorLogs(): Promise<void> {
    await this.remove('error_logs');
  }
  
  // Debug operations
  async getDebugInfo(): Promise<any> {
    const [settings, sessions, errorLogs] = await Promise.all([
      this.getSettings(),
      this.getAllSessions(),
      this.getErrorLogs()
    ]);
    
    return {
      settings,
      sessions,
      errorLogs,
      storageKeys: await this.getAllKeys(),
      timestamp: Date.now()
    };
  }
  
  async getAllSessions(): Promise<any[]> {
    const keys = await this.getAllKeys();
    const sessionKeys = keys.filter(key => key.startsWith('session_'));
    
    const sessions = await Promise.all(
      sessionKeys.map(key => this.get(key))
    );
    
    return sessions.filter(session => session !== null);
  }
  
  // Utility operations
  async setInstallationTime(timestamp: number): Promise<void> {
    await this.set('installation_time', timestamp);
  }
  
  async getInstallationTime(): Promise<number> {
    return await this.get('installation_time') || Date.now();
  }
  
  async setVersion(version: string): Promise<void> {
    await this.set('version', version);
  }
  
  async getVersion(): Promise<string> {
    return await this.get('version') || '1.0.0';
  }
  
  async setActiveTab(tabId: number, url: string): Promise<void> {
    const activeTab = { tabId, url, timestamp: Date.now() };
    await this.set('active_tab', activeTab);
  }
  
  async getActiveTab(): Promise<any> {
    return await this.get('active_tab');
  }
  
  async cleanupTabData(tabId: number): Promise<void> {
    // Clean up any tab-specific data
    const keys = await this.getAllKeys();
    const tabKeys = keys.filter(key => key.includes(`tab_${tabId}`));
    
    for (const key of tabKeys) {
      await this.remove(key);
    }
  }
  
  async cleanupOldData(cutoffTime: number): Promise<void> {
    const sessions = await this.getAllSessions();
    
    for (const session of sessions) {
      if (session.lastActivity < cutoffTime) {
        await this.deleteSession(session.id);
      }
    }
    
    // Clean up old error logs
    const errorLogs = await this.getErrorLogs();
    const recentLogs = errorLogs.filter(log => log.timestamp > cutoffTime);
    await this.set('error_logs', recentLogs);
  }
  
  // Storage statistics
  async getStorageStats(): Promise<{
    totalKeys: number;
    totalSize: number;
    breakdown: Record<string, number>;
  }> {
    const items = await chrome.storage.local.get();
    const walkthroughItems = Object.keys(items)
      .filter(key => key.startsWith(this.storagePrefix));
    
    let totalSize = 0;
    const breakdown: Record<string, number> = {};
    
    for (const key of walkthroughItems) {
      const size = JSON.stringify(items[key]).length;
      totalSize += size;
      
      const category = key.split('_')[1];
      breakdown[category] = (breakdown[category] || 0) + size;
    }
    
    return {
      totalKeys: walkthroughItems.length,
      totalSize,
      breakdown
    };
  }
  
  // Private helper methods
  private getFullKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }
  
  private async setInitialData(): Promise<void> {
    const initialData = {
      settings: {
        debugMode: false,
        enableAnalytics: false,
        autoStart: false,
        showProgress: true
      },
      version: '1.0.0',
      installation_time: Date.now(),
      error_logs: []
    };
    
    for (const [key, value] of Object.entries(initialData)) {
      await this.set(key, value);
    }
  }
}
