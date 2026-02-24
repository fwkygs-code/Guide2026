import { ErrorLogEntry, ErrorLogFilter } from '../types';

export class ErrorLogger {
  constructor(private storageManager: any) {
    this.setupGlobalErrorHandling();
  }
  
  async logError(error: {
    component: string;
    error: Error;
    context?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
  }): Promise<void> {
    const errorEntry: ErrorLogEntry = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      severity: error.severity,
      component: error.component,
      code: this.extractErrorCode(error.error),
      message: error.error.message,
      context: error.context,
      stack: error.error.stack,
      userAgent: navigator.userAgent,
      url: window.location?.href || 'background',
      sessionId: error.context?.sessionId,
      stepIndex: error.context?.stepIndex,
      recoveryAttempts: 0,
      resolved: false
    };
    
    try {
      await this.storageManager.logError(errorEntry);
      
      // Log to console for development
      this.logToConsole(errorEntry);
      
      // Send to external service if configured
      await this.sendToExternalService(errorEntry);
      
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
      // Fallback to console only
      console.error('Original error:', error);
    }
  }
  
  async getErrors(filter?: ErrorLogFilter): Promise<ErrorLogEntry[]> {
    try {
      const allErrors = await this.storageManager.getErrorLogs();
      
      if (!filter) {
        return allErrors;
      }
      
      return allErrors.filter(error => {
        if (filter.severity && error.severity !== filter.severity) {
          return false;
        }
        
        if (filter.component && error.component !== filter.component) {
          return false;
        }
        
        if (filter.resolved !== undefined && error.resolved !== filter.resolved) {
          return false;
        }
        
        if (filter.timeRange) {
          const timestamp = error.timestamp;
          if (timestamp < filter.timeRange.start || timestamp > filter.timeRange.end) {
            return false;
          }
        }
        
        return true;
      });
    } catch (error) {
      console.error('Failed to get errors:', error);
      return [];
    }
  }
  
  async updateErrorStatus(errorId: string, resolved: boolean, recoveryAttempts?: number): Promise<void> {
    try {
      const errors = await this.storageManager.getErrorLogs();
      const errorIndex = errors.findIndex(error => error.id === errorId);
      
      if (errorIndex !== -1) {
        errors[errorIndex].resolved = resolved;
        if (recoveryAttempts !== undefined) {
          errors[errorIndex].recoveryAttempts = recoveryAttempts;
        }
        
        await this.storageManager.set('error_logs', errors);
      }
    } catch (error) {
      console.error('Failed to update error status:', error);
    }
  }
  
  async clearErrors(): Promise<void> {
    try {
      await this.storageManager.clearErrorLogs();
    } catch (error) {
      console.error('Failed to clear errors:', error);
    }
  }
  
  async exportErrors(): Promise<string> {
    try {
      const errors = await this.getErrors();
      return JSON.stringify(errors, null, 2);
    } catch (error) {
      console.error('Failed to export errors:', error);
      return '[]';
    }
  }
  
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byComponent: Record<string, number>;
    resolved: number;
    unresolved: number;
  } {
    // This would need to be async to get real data, but for now return empty stats
    return {
      total: 0,
      bySeverity: {},
      byComponent: {},
      resolved: 0,
      unresolved: 0
    };
  }
  
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private extractErrorCode(error: Error): string {
    // Try to extract a meaningful error code from the error
    if (error.name) {
      return error.name.toUpperCase().replace(/\s+/g, '_');
    }
    
    if (error.message) {
      return error.message.substring(0, 50).toUpperCase().replace(/\s+/g, '_');
    }
    
    return 'UNKNOWN_ERROR';
  }
  
  private logToConsole(errorEntry: ErrorLogEntry): void {
    const logMethod = this.getConsoleLogMethod(errorEntry.severity);
    
    logMethod.call(console, `[${errorEntry.severity.toUpperCase()}] ${errorEntry.component}: ${errorEntry.message}`, {
      id: errorEntry.id,
      timestamp: new Date(errorEntry.timestamp).toISOString(),
      context: errorEntry.context,
      stack: errorEntry.stack
    });
  }
  
  private getConsoleLogMethod(severity: string): (...args: any[]) => void {
    switch (severity) {
      case 'critical':
      case 'high':
        return console.error.bind(console);
      case 'medium':
        return console.warn.bind(console);
      case 'low':
      default:
        return console.log.bind(console);
    }
  }
  
  private async sendToExternalService(errorEntry: ErrorLogEntry): Promise<void> {
    // This would integrate with external error tracking services
    // For now, it's a placeholder for future integration
    
    try {
      // Example: Send to Sentry, LogRocket, etc.
      // await this.sendToSentry(errorEntry);
      
      // For development, we'll just log that we would send it
      if (process.env.NODE_ENV === 'development') {
        console.debug('Would send error to external service:', errorEntry);
      }
    } catch (error) {
      console.error('Failed to send error to external service:', error);
    }
  }
  
  private setupGlobalErrorHandling(): void {
    // Setup global error handlers for unhandled errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.logError({
          component: 'Global',
          error: new Error(event.message),
          context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
          },
          severity: 'high',
          recoverable: false
        });
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        this.logError({
          component: 'Global',
          error: new Error(event.reason?.message || 'Unhandled promise rejection'),
          context: {
            reason: event.reason,
            promise: event.promise
          },
          severity: 'high',
          recoverable: false
        });
      });
    }
  }
  
  // Performance monitoring for errors
  async getErrorRate(timeWindow: number = 3600000): Promise<number> {
    // Get error rate in the last timeWindow (default: 1 hour)
    try {
      const now = Date.now();
      const errors = await this.getErrors({
        timeRange: {
          start: now - timeWindow,
          end: now
        }
      });
      
      return errors.length;
    } catch (error) {
      console.error('Failed to get error rate:', error);
      return 0;
    }
  }
  
  async getCriticalErrors(): Promise<ErrorLogEntry[]> {
    return await this.getErrors({
      severity: 'critical',
      resolved: false
    });
  }
  
  async getErrorsByComponent(component: string): Promise<ErrorLogEntry[]> {
    return await this.getErrors({
      component
    });
  }
  
  // Error aggregation and analysis
  async getErrorSummary(): Promise<{
    totalErrors: number;
    criticalErrors: number;
    highErrors: number;
    mediumErrors: number;
    lowErrors: number;
    mostErrorProneComponents: Array<{ component: string; count: number }>;
    recentErrors: ErrorLogEntry[];
    errorTrend: Array<{ timestamp: number; count: number }>;
  }> {
    try {
      const allErrors = await this.getErrors();
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const recentErrors = allErrors.filter(error => error.timestamp > oneDayAgo);
      
      // Count by severity
      const severityCounts = allErrors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Count by component
      const componentCounts = allErrors.reduce((acc, error) => {
        acc[error.component] = (acc[error.component] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostErrorProneComponents = Object.entries(componentCounts)
        .map(([component, count]) => ({ component, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Calculate error trend (last 7 days)
      const errorTrend = this.calculateErrorTrend(allErrors);
      
      return {
        totalErrors: allErrors.length,
        criticalErrors: severityCounts.critical || 0,
        highErrors: severityCounts.high || 0,
        mediumErrors: severityCounts.medium || 0,
        lowErrors: severityCounts.low || 0,
        mostErrorProneComponents,
        recentErrors: recentErrors.slice(-10), // Last 10 recent errors
        errorTrend
      };
    } catch (error) {
      console.error('Failed to get error summary:', error);
      return {
        totalErrors: 0,
        criticalErrors: 0,
        highErrors: 0,
        mediumErrors: 0,
        lowErrors: 0,
        mostErrorProneComponents: [],
        recentErrors: [],
        errorTrend: []
      };
    }
  }
  
  private calculateErrorTrend(errors: ErrorLogEntry[]): Array<{ timestamp: number; count: number }> {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const dayInMs = 24 * 60 * 60 * 1000;
    
    const trend: Array<{ timestamp: number; count: number }> = [];
    
    for (let i = 0; i < 7; i++) {
      const dayStart = sevenDaysAgo + (i * dayInMs);
      const dayEnd = dayStart + dayInMs;
      
      const dayErrors = errors.filter(error => 
        error.timestamp >= dayStart && error.timestamp < dayEnd
      );
      
      trend.push({
        timestamp: dayStart,
        count: dayErrors.length
      });
    }
    
    return trend;
  }
}
