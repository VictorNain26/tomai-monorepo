// TomAI Backend - Production Observability & Monitoring 2025
// Comprehensive monitoring for performance and business metrics

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  notice?: string | undefined;
  environment?: string;
  // SSE/Chat specific fields
  clientId?: string;
  connectionId?: string;
  totalConnections?: number;
  messageType?: string;
  messageId?: string;
  eventType?: string;
  // Additional fields used in the application
  subject?: string;
  userAgent?: string;
  messagePreview?: string;
  inactiveSince?: string;
  event?: string;
  [key: string]: unknown;
}

export interface ErrorContext extends LogContext {
  _error: Error | string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceContext extends LogContext {
  duration: number;
  resource?: string;
  success: boolean;
}

/**
 * Structured Logger - Production-ready logging with context
 */
class StructuredLogger {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };
    
    if (this.isProduction) {
      return JSON.stringify(logEntry);
    }
    
    // Development: Pretty format
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: ErrorContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

/**
 * Metrics Collector - Business and performance metrics
 */
class MetricsCollector {
  private metrics: MetricData[] = [];
  private readonly maxMetrics = 1000;

  /**
   * Record a custom metric
   */
  record(metric: MetricData): void {
    const metricWithTimestamp = {
      ...metric,
      timestamp: metric.timestamp ?? new Date(),
    };
    
    this.metrics.push(metricWithTimestamp);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    logger.debug('Metric recorded', {
      operation: 'metrics:record',
      metadata: {
        metric: metricWithTimestamp.name,
        value: metricWithTimestamp.value,
      }
    });
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, unknown> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(
      m => m.timestamp!.getTime() > oneHourAgo
    );
    
    return {
      totalMetrics: this.metrics.length,
      recentMetrics: recentMetrics.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get metrics for specific time range
   */
  getMetrics(since?: Date, until?: Date): MetricData[] {
    let filtered = this.metrics;
    
    if (since) {
      filtered = filtered.filter(m => m.timestamp! >= since);
    }
    
    if (until) {
      filtered = filtered.filter(m => m.timestamp! <= until);
    }
    
    return filtered;
  }
}

/**
 * Performance Monitor - Track operation performance
 */
class PerformanceMonitor {
  private readonly thresholds = {
    api_response: 1000,     // 1s for API responses
    database_query: 500,    // 500ms for DB queries
    ai_request: 3000,       // 3s for AI requests
    cache_operation: 100,   // 100ms for cache operations
  };

  /**
   * Track operation performance
   */
  async track<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let _error: Error | undefined;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } catch (err) {
      _error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      const threshold = this.thresholds[operation as keyof typeof this.thresholds] ?? 1000;
      
      // Record performance metric
      metrics.record({
        name: `performance.${operation}`,
        value: duration,
        tags: {
          success: success.toString(),
          slow: (duration > threshold).toString(),
        },
      });
      
      // Log performance
      const performanceContext: PerformanceContext = {
        ...context,
        duration,
        resource: operation,
        success,
      };
      
      if (duration > threshold) {
        logger.warn(`Slow operation detected: ${operation}`, performanceContext);
      } else {
        logger.debug(`Operation completed: ${operation}`, performanceContext);
      }
      
      // Log _error if occurred
      if (_error) {
        logger.error(`Operation failed: ${operation}`, {
          ...performanceContext,
          _error,
          severity: 'medium' as const,
          metadata: { duration, resource: operation },
        });
      }
    }
  }

  /**
   * Simple timing for synchronous operations
   */
  time<T>(operation: string, fn: () => T): T {
    const startTime = Date.now();
    
    try {
      const result = fn();
      const duration = Date.now() - startTime;
      
      metrics.record({
        name: `sync_performance.${operation}`,
        value: duration,
      });
      
      return result;
    } catch (_error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Sync operation failed: ${operation}`, {
        _error: _error as Error,
        severity: 'medium' as const,
        metadata: { duration },
      });
      
      throw _error;
    }
  }
}

/**
 * Health Monitor - System health tracking
 */
class HealthMonitor {
  private lastHealthCheck = Date.now();
  private healthStatus: Record<string, unknown> = {};

  /**
   * Record health check result
   */
  recordHealthCheck(component: string, status: 'healthy' | 'unhealthy', details?: unknown): void {
    this.healthStatus[component] = {
      status,
      details,
      timestamp: new Date().toISOString(),
    };
    
    this.lastHealthCheck = Date.now();
    
    logger.info(`Health check: ${component}`, {
      operation: 'health:check',
      metadata: {
        component,
        status,
      }
    });
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): Record<string, unknown> {
    const unhealthyComponents = Object.entries(this.healthStatus)
      .filter(([, status]) => (status as { status: string }).status === 'unhealthy')
      .map(([name]) => name);
    
    return {
      status: unhealthyComponents.length === 0 ? 'healthy' : 'unhealthy',
      components: this.healthStatus,
      unhealthyComponents,
      lastCheck: new Date(this.lastHealthCheck).toISOString(),
      uptime: process.uptime(),
    };
  }
}

// Global instances
export const logger = new StructuredLogger();
export const metrics = new MetricsCollector();
export const performance = new PerformanceMonitor();
export const health = new HealthMonitor();

/**
 * Initialize observability system
 */
export function initializeObservability(): void {
  logger.info('Initializing observability system', {
    operation: 'observability:init',
  });

  // Set up process event handlers
  process.on('uncaughtException', (_error) => {
    logger.error('Uncaught Exception', {
      _error,
      severity: 'critical' as const,
    });

    // Give time for logs to be written
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      _error: reason as Error,
      severity: 'high' as const,
      metadata: { promise: promise.toString() },
    });
  });

  // Memory monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();

    metrics.record({
      name: 'system.memory.heap_used',
      value: memUsage.heapUsed,
    });

    metrics.record({
      name: 'system.memory.heap_total',
      value: memUsage.heapTotal,
    });

    // Warn on high memory usage
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 256) {
      logger.warn('High memory usage detected', {
        operation: 'system:memory',
        metadata: { heapUsedMB: Math.round(heapUsedMB) },
      });
    }
  }, 60000); // Every minute

  logger.info('Observability system initialized', {
    operation: 'observability:ready',
    features: [
      'structured-logging',
      'performance-monitoring',
      'health-checks'
    ]
  });
}