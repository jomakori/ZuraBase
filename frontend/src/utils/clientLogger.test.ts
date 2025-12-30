/**
 * Test file for ClientLogger functionality
 * Verifies structured logging, environment modes, and correlation ID handling
 */

import * as ClientLoggerModule from './clientLogger';
import logger from './clientLogger';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ClientLogger', () => {
  let logger: ClientLoggerModule.ClientLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Create logger instance for testing
    logger = new ClientLoggerModule.ClientLogger({
      environment: 'development',
      component: 'TestComponent'
    });
  });

  describe('Basic Logging', () => {
    it('should create log entries with correct structure', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.info('Test message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]'),
        'Test message',
        { key: 'value' }
      );

      consoleSpy.mockRestore();
    });

    it('should include all required fields in log entries', () => {
      const entry = (logger as any).createLogEntry('info', 'Test message', { test: 'data' });

      expect(entry).toMatchObject({
        timestamp: expect.any(String),
        level: 'info',
        component: 'TestComponent',
        message: 'Test message',
        context: { test: 'data' },
        correlation_id: expect.any(String),
        session_id: expect.any(String),
        url: expect.any(String),
        environment: 'development',
        user_agent: expect.any(String)
      });
    });
  });

  describe('Environment Modes', () => {
    it('should log to console in development mode', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.info('Development log');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log to console in production mode for non-error levels', () => {
      const productionLogger = new ClientLoggerModule.ClientLogger({
        environment: 'production',
        component: 'TestComponent'
      });

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      productionLogger.info('Production log');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should still log errors to console in production mode', () => {
      const productionLogger = new ClientLoggerModule.ClientLogger({
        environment: 'production',
        component: 'TestComponent'
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      productionLogger.error('Production error');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Correlation ID Handling', () => {
    it('should generate correlation ID if not provided', () => {
      const correlationId = logger.getCorrelationId();
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      expect(correlationId.length).toBeGreaterThan(0);
    });

    it('should allow setting correlation ID', () => {
      const newCorrelationId = 'test-correlation-123';
      logger.setCorrelationId(newCorrelationId);

      expect(logger.getCorrelationId()).toBe(newCorrelationId);
    });
  });

  describe('API Logging Methods', () => {
    it('should log API requests correctly', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.apiRequest('Notes', 'POST', '/api/notes', { title: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]'),
        'POST /api/notes',
        expect.objectContaining({
          component: 'Notes',
          method: 'POST',
          url: '/api/notes',
          data: { title: 'Test' },
          type: 'api_request'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log API responses correctly', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.apiResponse('Notes', 'GET', '/api/notes', 200, { data: [] });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]'),
        'GET /api/notes → 200',
        expect.objectContaining({
          component: 'Notes',
          method: 'GET',
          url: '/api/notes',
          status: 200,
          data: { data: [] },
          type: 'api_response'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log API errors correctly', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Network error');

      logger.apiError('Notes', 'GET', '/api/notes', testError);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]'),
        'GET /api/notes → ERROR',
        expect.objectContaining({
          component: 'Notes',
          method: 'GET',
          url: '/api/notes',
          error: 'Network error',
          stack: testError.stack,
          type: 'api_error'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Batch Logging', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should batch logs in production mode', async () => {
      const productionLogger = new ClientLoggerModule.ClientLogger({
        environment: 'production',
        component: 'TestComponent',
        batchInterval: 1000,
        maxBatchSize: 2
      });

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      // Log two entries - should trigger batch send due to maxBatchSize
      productionLogger.info('Log 1');
      productionLogger.info('Log 2');

      // Wait for async operations
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/logs',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': expect.any(String)
          },
          body: expect.stringContaining('"logs":')
        })
      );
    });

    it('should flush logs on timer in production mode', async () => {
      const productionLogger = new ClientLoggerModule.ClientLogger({
        environment: 'production',
        component: 'TestComponent',
        batchInterval: 1000,
        maxBatchSize: 10
      });

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      productionLogger.info('Log 1');

      // Fast-forward timer
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const productionLogger = new ClientLoggerModule.ClientLogger({
        environment: 'production',
        component: 'TestComponent'
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      productionLogger.info('Test log');
      await productionLogger.flush();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error sending logs to backend:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('should persist session ID across instances', () => {
      const sessionId = logger.getCorrelationId();
      
      const newLogger = new ClientLoggerModule.ClientLogger({
        environment: 'development',
        component: 'NewComponent'
      });

      expect(newLogger.getCorrelationId()).toBe(sessionId);
    });

    it('should generate new session ID if not in storage', () => {
      sessionStorage.clear();
      
      const newLogger = new ClientLoggerModule.ClientLogger({
        environment: 'development',
        component: 'NewComponent'
      });

      expect(newLogger.getCorrelationId()).toBeDefined();
    });
  });
});

// Usage examples for documentation
describe('ClientLogger Usage Examples', () => {
  it('should demonstrate basic usage patterns', () => {
    // Basic logging
    logger.info('User login successful', { user_id: 'u123', component: 'AuthPage' });
    logger.error('API request failed', { endpoint: '/api/notes', status: 500 });

    // API-specific logging
    logger.apiRequest('Notes', 'POST', '/api/notes', { title: 'New Note' });
    logger.apiResponse('Notes', 'POST', '/api/notes', 201, { id: 'note_123' });
    logger.apiError('Notes', 'GET', '/api/notes', new Error('Network timeout'));

    // Getting correlation ID for custom requests
    const correlationId = logger.getCorrelationId();
    console.log('Current correlation ID:', correlationId);

    // Force flush pending logs
    logger.flush();
  });

  it('should demonstrate custom logger creation', () => {
    // Create custom logger for specific component
    const customLogger = new ClientLoggerModule.ClientLogger({
      environment: 'production',
      component: 'PlannerApp',
      batchInterval: 3000, // 3 seconds
      maxBatchSize: 25
    });

    customLogger.info('Planner initialized', { version: '1.0.0' });
    customLogger.warn('Low disk space', { available: '500MB' });
  });
});
