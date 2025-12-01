/**
 * Professional Logger - Tom Client
 * Remplace tous les console.log avec un système intelligent
 * Configuration selon l'environnement + contexte métier
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ILogContext {
  component?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown; // Permet d'ajouter des propriétés dynamiques
}

interface ILogEntry {
  level: LogLevel;
  message: string;
  context?: ILogContext;
  timestamp: string;
  environment: string;
}

class Logger {
  private static instance: Logger;
  private readonly isDevelopment: boolean;
  private readonly isProduction: boolean;
  private readonly enabledLevels: Set<LogLevel>;

  private constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development';
    this.isProduction = import.meta.env.MODE === 'production';

    // Configuration des niveaux selon l'environnement
    this.enabledLevels = new Set(
      this.isProduction
        ? ['error']
        : ['debug', 'info', 'warn', 'error']
    );
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabledLevels.has(level);
  }

  private formatMessage(level: LogLevel, message: string, context?: ILogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context?.component) {
      return `${prefix} [${context.component}] ${message}`;
    }

    return `${prefix} ${message}`;
  }

  private createLogEntry(level: LogLevel, message: string, context?: ILogContext): ILogEntry {
    return {
      level,
      message,
      ...(context !== undefined && { context }),
      timestamp: new Date().toISOString(),
      environment: import.meta.env.MODE,
    };
  }

  private outputLog(entry: ILogEntry): void {
    const formattedMessage = this.formatMessage(entry.level, entry.message, entry.context);

    switch (entry.level) {
      case 'debug':
        if (this.isDevelopment) {
          // eslint-disable-next-line no-console
          console.debug(formattedMessage, entry.context);
        }
        break;

      case 'info':
        // eslint-disable-next-line no-console
        console.info(formattedMessage, entry.context);
        break;

      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(formattedMessage, entry.context);
        break;

      case 'error':
        // eslint-disable-next-line no-console
        console.error(formattedMessage, entry.context);
        // En production, ici on pourrait envoyer à un service de monitoring
        if (this.isProduction) {
          this.sendToMonitoring(entry);
        }
        break;
    }
  }

  private sendToMonitoring(entry: ILogEntry): void {
    // Stockage local pour debug - monitoring service peut être ajouté ici
    try {
      const existingLogs = JSON.parse(localStorage.getItem('tomai_error_logs') ?? '[]');
      existingLogs.push(entry);
      // Garde seulement les 50 dernières erreurs
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      localStorage.setItem('tomai_error_logs', JSON.stringify(existingLogs));
    } catch {
      // Fallback si localStorage échoue
    }
  }

  // API publique
  public debug(message: string, context?: ILogContext): void {
    if (!this.shouldLog('debug')) return;

    const entry = this.createLogEntry('debug', message, context);
    this.outputLog(entry);
  }

  public info(message: string, context?: ILogContext): void {
    if (!this.shouldLog('info')) return;

    const entry = this.createLogEntry('info', message, context);
    this.outputLog(entry);
  }

  public warn(message: string, context?: ILogContext): void {
    if (!this.shouldLog('warn')) return;

    const entry = this.createLogEntry('warn', message, context);
    this.outputLog(entry);
  }

  public error(message: string, _error?: Error | unknown, context?: ILogContext): void {
    if (!this.shouldLog('error')) return;

    const enhancedContext: ILogContext = {
      ...context,
      metadata: {
        ...context?.metadata,
        _error: _error instanceof Error ? {
          name: _error.name,
          message: _error.message,
          stack: _error.stack,
        } : _error,
      },
    };

    const entry = this.createLogEntry('error', message, enhancedContext);
    this.outputLog(entry);
  }

  // Helpers pour les contextes courants
  public auth(message: string, context?: Omit<ILogContext, 'component'>): void {
    this.info(message, { ...context, component: 'Auth' });
  }

  public api(message: string, context?: Omit<ILogContext, 'component'>): void {
    this.debug(message, { ...context, component: 'API' });
  }

  public store(message: string, context?: Omit<ILogContext, 'component'>): void {
    this.debug(message, { ...context, component: 'Store' });
  }

  public ui(message: string, context?: Omit<ILogContext, 'component'>): void {
    this.debug(message, { ...context, component: 'UI' });
  }
}

// Export singleton
export const logger = Logger.getInstance();

// Types pour l'utilisation
export type { LogLevel, ILogContext };
