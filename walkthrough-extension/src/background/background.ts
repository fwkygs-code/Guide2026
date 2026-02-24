import { MessageRouter } from './message-router';
import { StorageManager } from './storage-manager';
import { ErrorLogger } from './error-logger';
import { MESSAGE_TYPES } from '../constants';

export class Background {
  private messageRouter: MessageRouter;
  private storageManager: StorageManager;
  private errorLogger: ErrorLogger;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      this.storageManager = new StorageManager();
      this.errorLogger = new ErrorLogger(this.storageManager);
      this.messageRouter = new MessageRouter(this.storageManager, this.errorLogger);
      
      this.setupEventListeners();
      this.setupMessageHandlers();
      
      console.log('Walkthrough Extension background script initialized');
    } catch (error) {
      console.error('Failed to initialize background script:', error);
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { phase: 'initialization' },
        severity: 'critical',
        recoverable: false
      });
    }
  }
  
  private setupEventListeners(): void {
    // Extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });
    
    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });
    
    // Tab events
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
    
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });
    
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });
    
    // Storage events
    chrome.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChange(changes, areaName);
    });
    
    // Message events (handled by MessageRouter)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.messageRouter.handleMessage(message, sender, sendResponse);
    });
  }
  
  private setupMessageHandlers(): void {
    // Register message handlers with the router
    this.messageRouter.registerHandler(MESSAGE_TYPES.WALKTHROUGH_INIT, this.handleWalkthroughInit.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.PROGRESS_UPDATE, this.handleProgressUpdate.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.ERROR_OCCURRED, this.handleErrorOccurred.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.STATE_PERSIST, this.handleStatePersist.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.STATE_RESTORE, this.handleStateRestore.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.DEBUG_INFO, this.handleDebugInfo.bind(this));
    this.messageRouter.registerHandler(MESSAGE_TYPES.PING, this.handlePing.bind(this));
  }
  
  private async handleInstallation(details: chrome.runtime.InstalledDetails): Promise<void> {
    try {
      if (details.reason === 'install') {
        console.log('Walkthrough Extension installed');
        await this.storageManager.setInstallationTime(Date.now());
        await this.storageManager.setVersion(chrome.runtime.getManifest().version);
      } else if (details.reason === 'update') {
        console.log('Walkthrough Extension updated');
        await this.storageManager.setVersion(chrome.runtime.getManifest().version);
        await this.handleVersionUpdate(details.previousVersion);
      }
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { phase: 'installation', reason: details.reason },
        severity: 'medium',
        recoverable: true
      });
    }
  }
  
  private async handleStartup(): Promise<void> {
    try {
      console.log('Walkthrough Extension started');
      await this.cleanupOldData();
      await this.initializeDefaultSettings();
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { phase: 'startup' },
        severity: 'medium',
        recoverable: true
      });
    }
  }
  
  private async handleTabUpdate(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    try {
      if (changeInfo.status === 'complete' && tab.url) {
        // Notify content scripts of page load completion
        await this.sendMessageToTab(tabId, {
          type: MESSAGE_TYPES.SYSTEM_READY,
          payload: { url: tab.url, timestamp: Date.now() }
        });
      }
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { tabId, changeInfo, tab },
        severity: 'low',
        recoverable: true
      });
    }
  }
  
  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        // Track active tab for analytics/debugging
        await this.storageManager.setActiveTab(activeInfo.tabId, tab.url);
      }
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { activeInfo },
        severity: 'low',
        recoverable: true
      });
    }
  }
  
  private async handleTabRemoved(tabId: number): Promise<void> {
    try {
      // Clean up tab-specific data
      await this.storageManager.cleanupTabData(tabId);
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { tabId },
        severity: 'low',
        recoverable: true
      });
    }
  }
  
  private async handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): Promise<void> {
    try {
      // Handle storage changes for synchronization
      if (areaName === 'local') {
        // Notify content scripts of relevant changes
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            await this.sendMessageToTab(tab.id, {
              type: MESSAGE_TYPES.STATE_SYNC,
              payload: { changes, areaName }
            });
          }
        }
      }
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { changes, areaName },
        severity: 'low',
        recoverable: true
      });
    }
  }
  
  // Message Handlers
  private async handleWalkthroughInit(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { walkthroughId, definition, startStep, configuration } = message.payload;
      
      // Validate walkthrough definition
      const validation = this.validateWalkthroughDefinition(definition);
      if (!validation.valid) {
        throw new Error(`Invalid walkthrough definition: ${validation.errors.join(', ')}`);
      }
      
      // Store walkthrough definition
      await this.storageManager.setWalkthroughDefinition(walkthroughId, definition);
      
      // Initialize session
      const sessionId = this.generateSessionId();
      await this.storageManager.createSession(sessionId, walkthroughId, startStep || 0);
      
      return {
        success: true,
        data: { sessionId }
      };
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { message, sender },
        severity: 'high',
        recoverable: false
      });
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  private async handleProgressUpdate(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { sessionId, currentStep, totalSteps, completedSteps, status } = message.payload;
      
      // Update session progress
      await this.storageManager.updateSessionProgress(sessionId, {
        currentStep,
        totalSteps,
        completedSteps,
        status,
        lastActivity: Date.now()
      });
      
      return { success: true };
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { message, sender },
        severity: 'medium',
        recoverable: true
      });
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  private async handleErrorOccurred(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { component, error, context, severity, recoverable } = message.payload;
      
      // Log error
      this.errorLogger.logError({
        component,
        error: new Error(error.message),
        context: {
          ...context,
          sender: {
            id: sender.id,
            url: sender.url,
            tab: sender.tab?.id
          }
        },
        severity,
        recoverable
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to log error:', error);
      return { success: false };
    }
  }
  
  private async handleStatePersist(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { sessionId, state } = message.payload;
      
      await this.storageManager.setSessionState(sessionId, state);
      
      return { success: true };
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { message, sender },
        severity: 'medium',
        recoverable: true
      });
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  private async handleStateRestore(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const { sessionId } = message.payload;
      
      const state = await this.storageManager.getSessionState(sessionId);
      
      return {
        success: true,
        data: { state }
      };
    } catch (error) {
      this.errorLogger.logError({
        component: 'Background',
        error: error as Error,
        context: { message, sender },
        severity: 'medium',
        recoverable: true
      });
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  private async handleDebugInfo(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    try {
      const debugInfo = await this.storageManager.getDebugInfo();
      
      return {
        success: true,
        data: { debugInfo }
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  private async handlePing(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    return {
      success: true,
      data: { 
        timestamp: Date.now(),
        version: chrome.runtime.getManifest().version
      }
    };
  }
  
  // Utility Methods
  private async sendMessageToTab(tabId: number, message: any): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      // Content script might not be loaded, which is expected in some cases
      console.debug(`Failed to send message to tab ${tabId}:`, error);
    }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private validateWalkthroughDefinition(definition: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!definition.id) errors.push('Missing walkthrough ID');
    if (!definition.name) errors.push('Missing walkthrough name');
    if (!definition.steps || !Array.isArray(definition.steps)) errors.push('Missing or invalid steps array');
    if (!definition.configuration) errors.push('Missing configuration');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private async handleVersionUpdate(previousVersion?: string): Promise<void> {
    // Handle version-specific migrations
    if (previousVersion) {
      console.log(`Updating from version ${previousVersion}`);
      // Add migration logic here if needed
    }
  }
  
  private async cleanupOldData(): Promise<void> {
    // Clean up old session data, error logs, etc.
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    await this.storageManager.cleanupOldData(cutoffTime);
  }
  
  private async initializeDefaultSettings(): Promise<void> {
    // Set default settings if not already present
    const defaultSettings = {
      debugMode: false,
      enableAnalytics: false,
      autoStart: false,
      showProgress: true
    };
    
    await this.storageManager.initializeDefaultSettings(defaultSettings);
  }
}
