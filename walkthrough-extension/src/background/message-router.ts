import { MessageEnvelope, MessageHandler, MessageResponse } from '../types';
import { MESSAGE_TYPES, MESSAGE_TIMEOUTS } from '../constants';

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private pendingMessages: Map<string, {
    resolve: (response: MessageResponse) => void;
    reject: (error: Error) => void;
    timeout: number;
  }> = new Map();
  
  constructor(
    private storageManager: any,
    private errorLogger: any
  ) {
    this.setupCleanupInterval();
  }
  
  registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }
  
  unregisterHandler(messageType: string): void {
    this.handlers.delete(messageType);
  }
  
  async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    try {
      const envelope = this.createMessageEnvelope(message, sender);
      
      // Validate message
      if (!this.validateMessage(envelope)) {
        const error = new Error(`Invalid message: ${JSON.stringify(message)}`);
        this.errorLogger.logError({
          component: 'MessageRouter',
          error,
          context: { message, sender },
          severity: 'medium',
          recoverable: true
        });
        
        sendResponse({
          success: false,
          error: error.message,
          code: 'INVALID_MESSAGE'
        });
        
        return true; // Return true to indicate we handled the message
      }
      
      // Handle message
      const response = await this.processMessage(envelope);
      sendResponse(response);
      
      return true;
    } catch (error) {
      this.errorLogger.logError({
        component: 'MessageRouter',
        error: error as Error,
        context: { message, sender },
        severity: 'high',
        recoverable: true
      });
      
      sendResponse({
        success: false,
        error: (error as Error).message,
        code: 'MESSAGE_PROCESSING_ERROR'
      });
      
      return true;
    }
  }
  
  private createMessageEnvelope(message: any, sender: chrome.runtime.MessageSender): MessageEnvelope {
    return {
      version: '1.0.0',
      type: message.type,
      payload: message.payload,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
      source: this.determineSource(sender),
      destination: message.destination
    };
  }
  
  private validateMessage(envelope: MessageEnvelope): boolean {
    // Basic validation
    if (!envelope.type || !envelope.payload) {
      return false;
    }
    
    // Check if message type is supported
    if (!Object.values(MESSAGE_TYPES).includes(envelope.type as any)) {
      return false;
    }
    
    // Version compatibility check
    if (!this.isVersionCompatible(envelope.version)) {
      return false;
    }
    
    return true;
  }
  
  private async processMessage(envelope: MessageEnvelope): Promise<MessageResponse> {
    const handler = this.handlers.get(envelope.type);
    
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for message type: ${envelope.type}`,
        code: 'NO_HANDLER'
      };
    }
    
    try {
      const response = await handler(envelope);
      return response;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'HANDLER_ERROR'
      };
    }
  }
  
  private determineSource(sender: chrome.runtime.MessageSender): string {
    if (sender.id === chrome.runtime.id) {
      return 'background';
    }
    
    if (sender.tab) {
      return 'content';
    }
    
    return 'unknown';
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private isVersionCompatible(version: string): boolean {
    // Simple version compatibility check
    const supportedVersions = ['1.0.0'];
    return supportedVersions.includes(version);
  }
  
  private setupCleanupInterval(): void {
    // Clean up old pending messages every minute
    setInterval(() => {
      this.cleanupPendingMessages();
    }, 60000);
  }
  
  private cleanupPendingMessages(): void {
    const now = Date.now();
    
    this.pendingMessages.forEach((pending, messageId) => {
      if (now - pending.timeout > MESSAGE_TIMEOUTS.LONG) {
        pending.reject(new Error(`Message timeout: ${messageId}`));
        this.pendingMessages.delete(messageId);
      }
    });
  }
  
  // Public API for sending messages
  async sendMessage(
    type: string,
    payload: any,
    destination?: string,
    timeout: number = MESSAGE_TIMEOUTS.DEFAULT
  ): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      const envelope: MessageEnvelope = {
        version: '1.0.0',
        type,
        payload,
        timestamp: Date.now(),
        messageId: this.generateMessageId(),
        source: 'background',
        destination
      };
      
      // Store pending message
      this.pendingMessages.set(envelope.messageId, {
        resolve,
        reject,
        timeout: Date.now() + timeout
      });
      
      // Send message
      if (destination === 'content') {
        // Send to all content scripts
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, envelope).catch(() => {
                // Ignore errors for tabs without content scripts
              });
            }
          });
        });
      } else {
        // Send to runtime
        chrome.runtime.sendMessage(envelope).catch(reject);
      }
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingMessages.has(envelope.messageId)) {
          this.pendingMessages.delete(envelope.messageId);
          reject(new Error(`Message timeout: ${envelope.messageId}`));
        }
      }, timeout);
    });
  }
  
  // Broadcast message to all tabs
  async broadcast(type: string, payload: any): Promise<void> {
    const envelope: MessageEnvelope = {
      version: '1.0.0',
      type,
      payload,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
      source: 'background'
    };
    
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, envelope);
        } catch (error) {
          // Ignore tabs without content scripts
        }
      }
    }
  }
  
  // Get router statistics
  getStats(): {
    registeredHandlers: number;
    pendingMessages: number;
    supportedMessageTypes: string[];
  } {
    return {
      registeredHandlers: this.handlers.size,
      pendingMessages: this.pendingMessages.size,
      supportedMessageTypes: Object.values(MESSAGE_TYPES)
    };
  }
}
