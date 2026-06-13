// TomAI Backend - Production Observability & Monitoring 2025
// Comprehensive monitoring for performance and business metrics

interface LogContext {
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

interface ErrorContext extends LogContext {
  _error: Error | string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Structured Logger - Production-ready logging with context
 */
class StructuredLogger {
  // `bun build --target bun` freezes `process.env.NODE_ENV` at build time,
  // which flipped this to `false` in the bundled dist/index.js even though
  // NODE_ENV=production at runtime. Read via Bun.env to get the runtime value.
  private readonly isProduction = Bun.env['NODE_ENV'] === 'production';
  
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

// Global instances
export const logger = new StructuredLogger();