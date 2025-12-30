import { getApiBase } from '../getApiBase';

/**
 * Frontend Unified Logging System
 * Aligns with backend centralized logging architecture
 * Forwards logs to backend /api/logs endpoint while preserving local visibility
 */

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  context: Record<string, any>;
  correlation_id?: string;
  user_id?: string;
  session_id?: string;
  url: string;
  environment: string;
  user_agent: string;
}

interface LoggerConfig {
  environment: 'development' | 'production';
  component: string;
  batchInterval?: number;
  maxBatchSize?: number;
}

class ClientLogger {
  private config: LoggerConfig;
  private logQueue: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private correlationId: string | null = null;
  private sessionId: string | null = null;

  constructor(config: LoggerConfig) {
    this.config = {
      batchInterval: 5000, // 5 seconds
      maxBatchSize: 50,
      ...config
    };
    this.initializeSession();
    this.setupGlobalErrorHandling();
  }

  private initializeSession(): void {
    // Generate session ID if not exists
    this.sessionId = sessionStorage.getItem('zurabase_session_id') || this.generateUUID();
    sessionStorage.setItem('zurabase_session_id', this.sessionId);

    // Set correlation ID from URL params or generate new
    const urlParams = new URLSearchParams(window.location.search);
    this.correlationId = urlParams.get('correlation_id') || this.generateUUID();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private setupGlobalErrorHandling(): void {
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });

    // Capture global errors
    window.addEventListener('error', (event) => {
      this.error('Global Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString()
      });
    });
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context: Record<string, any> = {}
  ): LogEntry {
    const userId = this.getCurrentUserId();
    
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.config.component,
      message,
      context,
      correlation_id: this.correlationId || undefined,
      user_id: userId || undefined,
      session_id: this.sessionId || undefined,
      url: window.location.href,
      environment: this.config.environment,
      user_agent: navigator.userAgent
    };
  }

  private getCurrentUserId(): string | null {
    // Extract user ID from auth context or localStorage
    try {
      const authData = localStorage.getItem('zurabase_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.userId || parsed.user_id || null;
      }
    } catch (error) {
      // Silent fail - user ID is optional
    }
    return null;
  }

  private logToConsole(entry: LogEntry): void {
    if (this.config.environment === 'development') {
      const { level, message, context, component, timestamp } = entry;
      const styles = {
        debug: 'color: #666; background: #f0f0f0; padding: 2px 4px; border-radius: 3px;',
        info: 'color: #007bff; background: #e3f2fd; padding: 2px 4px; border-radius: 3px;',
        warn: 'color: #ff9800; background: #fff3e0; padding: 2px 4px; border-radius: 3px;',
        error: 'color: #d32f2f; background: #ffebee; padding: 2px 4px; border-radius: 3px;'
      };

      const style = styles[level] || styles.info;
      console[level](
        `%c[${component}] ${timestamp}`,
        style,
        message,
        Object.keys(context).length > 0 ? context : ''
      );
    }
  }

  private async sendToBackend(entries: LogEntry[]): Promise<void> {
    if (this.config.environment !== 'production') {
      return; // Only send to backend in production
    }

    try {
      const logsEndpoint = `${getApiBase()}/logs`;
      const response = await fetch(logsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': this.correlationId || ''
        },
        body: JSON.stringify({ logs: entries }),
        // Don't block on log sending
        keepalive: true
      });

      if (!response.ok) {
        console.warn('Failed to send logs to backend:', response.status);
      }
    } catch (error) {
      console.warn('Error sending logs to backend:', error);
    }
  }

  private queueLogEntry(entry: LogEntry): void {
    this.logQueue.push(entry);
    this.logToConsole(entry);

    // Send immediately in development for debugging
    if (this.config.environment === 'development') {
      return;
    }

    // Batch logs in production
    if (this.logQueue.length >= this.config.maxBatchSize!) {
      this.flushLogs();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushLogs(), this.config.batchInterval);
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.logQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    await this.sendToBackend(logsToSend);
  }

  // Public API methods
  debug(message: string, context: Record<string, any> = {}): void {
    const entry = this.createLogEntry('debug', message, context);
    this.queueLogEntry(entry);
  }

  info(message: string, context: Record<string, any> = {}): void {
    const entry = this.createLogEntry('info', message, context);
    this.queueLogEntry(entry);
  }

  warn(message: string, context: Record<string, any> = {}): void {
    const entry = this.createLogEntry('warn', message, context);
    this.queueLogEntry(entry);
  }

  error(message: string, context: Record<string, any> = {}): void {
    const entry = this.createLogEntry('error', message, context);
    this.queueLogEntry(entry);
  }

  // API-specific logging methods
  apiRequest(module: string, method: string, url: string, data?: any): void {
    this.info(`${method} ${url}`, {
      component: module,
      method,
      url,
      data: data || null,
      type: 'api_request'
    });
  }

  apiResponse(module: string, method: string, url: string, status: number, data?: any): void {
    const level = status >= 400 ? 'warn' : 'info';
    this[level](`${method} ${url} → ${status}`, {
      component: module,
      method,
      url,
      status,
      data: data || null,
      type: 'api_response'
    });
  }

  apiError(module: string, method: string, url: string, error: Error): void {
    this.error(`${method} ${url} → ERROR`, {
      component: module,
      method,
      url,
      error: error.message,
      stack: error.stack,
      type: 'api_error'
    });
  }

  // Get correlation ID for network requests
  getCorrelationId(): string {
    return this.correlationId || this.generateUUID();
  }

  // Force flush any pending logs
  async flush(): Promise<void> {
    await this.flushLogs();
  }

  // Update correlation ID (useful for navigation)
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
}

// Create default logger instance
let isDevelopment = false;
try {
  isDevelopment = import.meta.env.MODE === 'development';
} catch (e) {
  // In CommonJS/Jest environment, import.meta is not available
  // Check if we're in a test environment or if global.import.meta is defined
  isDevelopment = (globalThis as any).import?.meta?.env?.MODE === 'development' || false;
}

const defaultLogger = new ClientLogger({
  environment: isDevelopment ? 'development' : 'production',
  component: 'FrontendApp'
});

// Export the logger instance
export default defaultLogger;

// Export the class for custom logger creation
export { ClientLogger };

// Legacy compatibility exports
export const log = {
  info: (message: string, context?: Record<string, any>) => defaultLogger.info(message, context),
  warn: (message: string, context?: Record<string, any>) => defaultLogger.warn(message, context),
  error: (message: string, context?: Record<string, any>) => defaultLogger.error(message, context),
  debug: (message: string, context?: Record<string, any>) => defaultLogger.debug(message, context),
  apiRequest: (module: string, method: string, url: string, data?: any) => 
    defaultLogger.apiRequest(module, method, url, data),
  apiResponse: (module: string, method: string, url: string, status: number, data?: any) => 
    defaultLogger.apiResponse(module, method, url, status, data),
  apiError: (module: string, method: string, url: string, error: Error) => 
    defaultLogger.apiError(module, method, url, error)
};

// Suppress React DevTools warning (preserve existing functionality)
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === "string" && args[0].includes("React DevTools")) {
    return;
  }
  originalWarn(...args);
};
