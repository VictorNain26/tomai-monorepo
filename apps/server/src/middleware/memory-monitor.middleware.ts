/**
 * Memory Monitor Middleware - Surveillance mémoire production
 * Prévention proactive des fuites mémoire pour TomIA
 */

import { logger } from '../lib/observability';

interface MemoryStats {
  rss: number;      // Resident Set Size
  heapUsed: number; // Heap utilisé
  heapTotal: number; // Heap total
  external: number;  // Mémoire externe
}

interface MemoryAlert {
  level: 'warning' | 'critical' | 'emergency';
  usage: number;
  threshold: number;
  action: string;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private isMonitoring = false;
  private intervalId?: ReturnType<typeof setInterval>;

  // Seuils en MB
  private readonly thresholds = {
    warning: 500,    // 500MB
    critical: 700,   // 700MB
    emergency: 850   // 850MB - proche de la limite Docker 1GB
  };

  private readonly alertCooldown = 60000; // 1 minute entre alertes
  private lastAlert = 0;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Démarre la surveillance mémoire
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    logger.info('Memory monitoring started', {
      operation: 'memory:monitor-start',
      interval: intervalMs,
      thresholds: this.thresholds
    });
  }

  /**
   * Arrête la surveillance mémoire
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isMonitoring = false;

    logger.info('Memory monitoring stopped', {
      operation: 'memory:monitor-stop'
    });
  }

  /**
   * Vérifie l'usage mémoire et déclenche des alertes
   */
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const stats = this.formatMemoryStats(memUsage);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    // Déterminer le niveau d'alerte
    const alert = this.determineAlertLevel(heapUsedMB);

    if (alert && this.shouldSendAlert()) {
      void this.handleMemoryAlert(alert, stats);
    }

    // Log périodique des stats (toutes les 5 minutes)
    if (Date.now() % (5 * 60 * 1000) < 30000) {
      logger.info('Memory usage check', {
        operation: 'memory:periodic-check',
        heapUsedMB,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024)
      });
    }
  }

  /**
   * Formate les statistiques mémoire
   */
  private formatMemoryStats(memUsage: ReturnType<typeof process.memoryUsage>): MemoryStats {
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
  }

  /**
   * Détermine le niveau d'alerte basé sur l'usage
   */
  private determineAlertLevel(heapUsedMB: number): MemoryAlert | null {
    if (heapUsedMB >= this.thresholds.emergency) {
      return {
        level: 'emergency',
        usage: heapUsedMB,
        threshold: this.thresholds.emergency,
        action: 'IMMEDIATE_GC_REQUIRED'
      };
    }
    if (heapUsedMB >= this.thresholds.critical) {
      return {
        level: 'critical',
        usage: heapUsedMB,
        threshold: this.thresholds.critical,
        action: 'FORCE_CLEANUP_CACHES'
      };
    }
    if (heapUsedMB >= this.thresholds.warning) {
      return {
        level: 'warning',
        usage: heapUsedMB,
        threshold: this.thresholds.warning,
        action: 'MONITOR_CLOSELY'
      };
    }
    return null;
  }

  /**
   * Vérifie si on peut envoyer une alerte (cooldown)
   */
  private shouldSendAlert(): boolean {
    const now = Date.now();
    if (now - this.lastAlert < this.alertCooldown) {
      return false;
    }
    this.lastAlert = now;
    return true;
  }

  /**
   * Gère les alertes mémoire et actions correctives
   */
  private async handleMemoryAlert(alert: MemoryAlert, stats: MemoryStats): Promise<void> {
    logger.warn(`MEMORY ALERT: ${alert.level.toUpperCase()}`, {
      operation: 'memory:alert',
      level: alert.level,
      usage: `${alert.usage}MB`,
      threshold: `${alert.threshold}MB`,
      action: alert.action,
      stats,
      severity: alert.level === 'emergency' ? 'critical' : 'high'
    });

    // Actions correctives automatiques
    switch (alert.action) {
      case 'IMMEDIATE_GC_REQUIRED':
        await this.performEmergencyCleanup();
        break;
      case 'FORCE_CLEANUP_CACHES':
        await this.performCacheCleanup();
        break;
      case 'MONITOR_CLOSELY':
        // Juste surveiller pour l'instant
        break;
    }
  }

  /**
   * Nettoyage d'urgence en cas de saturation mémoire
   */
  private async performEmergencyCleanup(): Promise<void> {
    logger.warn('Performing emergency memory cleanup', {
      operation: 'memory:emergency-cleanup'
    });

    try {
      // 1. Forcer garbage collection si disponible
      if (global.gc) {
        global.gc();
      }

      // 2. pgvector RAG service n'a pas de cache interne
      // Utilise Redis pour cache, géré par redis-cache.service

      logger.info('Emergency cleanup completed', {
        operation: 'memory:emergency-cleanup-completed'
      });
    } catch (error) {
      logger.error('Emergency cleanup failed', {
        operation: 'memory:emergency-cleanup-failed',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });
    }
  }

  /**
   * Nettoyage préventif des caches
   */
  private async performCacheCleanup(): Promise<void> {
    logger.info('Performing preventive cache cleanup', {
      operation: 'memory:cache-cleanup'
    });

    try {
      // pgvector RAG service - cache géré par Redis
      // Service stateless, cache externe

      // Forcer GC si disponible
      if (global.gc) {
        global.gc();
      }

      logger.info('Cache cleanup completed', {
        operation: 'memory:cache-cleanup-completed'
      });
    } catch (error) {
      logger.error('Cache cleanup failed', {
        operation: 'memory:cache-cleanup-failed',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });
    }
  }

  /**
   * Obtient les statistiques mémoire actuelles
   */
  getCurrentStats(): MemoryStats & { alertLevel?: string } {
    const memUsage = process.memoryUsage();
    const stats = this.formatMemoryStats(memUsage);
    const alert = this.determineAlertLevel(stats.heapUsed);

    return {
      ...stats,
      alertLevel: alert?.level
    };
  }
}

// Export singleton
export const memoryMonitor = MemoryMonitor.getInstance();

/**
 * Middleware Elysia pour monitoring mémoire sur requêtes sensibles
 */
export const memoryMonitorMiddleware = (options: { threshold?: number } = {}) => {
  const threshold = options.threshold ?? 600; // 600MB par défaut

  return (context: { request?: { url?: string } }) => {
    const beforeMemory = process.memoryUsage().heapUsed;

    // Note: En réalité, ce middleware doit être adapté à la structure Elysia
    // Pour l'instant, on simule un monitoring simple
    const afterMemory = process.memoryUsage().heapUsed;
    const heapUsedMB = Math.round(afterMemory / 1024 / 1024);
    const memoryDelta = Math.round((afterMemory - beforeMemory) / 1024 / 1024);

    // Logger si consommation élevée
    if (heapUsedMB > threshold || memoryDelta > 50) {
      logger.warn('High memory usage detected on request', {
        operation: 'memory:request-monitor',
        heapUsedMB,
        memoryDeltaMB: memoryDelta,
        threshold,
        path: context.request?.url ?? 'unknown'
      });
    }

    return context;
  };
};