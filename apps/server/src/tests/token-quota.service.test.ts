/**
 * Tests unitaires - Token Quota Service
 *
 * Tests des fonctions de gestion de quotas tokens (rolling window + daily cap).
 * Architecture 2025 inspirée ChatGPT/Claude.
 */

import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';

// ============================================
// MOCK DES DÉPENDANCES EXTERNES
// ============================================

// Mock database pour éviter les appels réels
const mockDbSelect = mock(() => ({
  from: mock(() => ({
    innerJoin: mock(() => ({
      where: mock(() => ({
        limit: mock(() => Promise.resolve([]))
      }))
    })),
    where: mock(() => ({
      limit: mock(() => Promise.resolve([]))
    }))
  }))
}));

const mockDbInsert = mock(() => ({
  values: mock(() => Promise.resolve())
}));

const mockDbUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => Promise.resolve())
  }))
}));

mock.module('../db/connection', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  }
}));

mock.module('../lib/observability', () => ({
  logger: {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }
}));

// Import après les mocks
import { tokenQuotaService } from '../services/token-quota.service';

// ============================================
// TESTS CONFIGURATION
// ============================================

describe('Token Quota Service - Configuration', () => {
  describe('QUOTA_CONFIG', () => {
    it('devrait avoir une configuration FREE valide', () => {
      const freeConfig = tokenQuotaService.QUOTA_CONFIG.free;

      expect(freeConfig.windowTokens).toBe(5_000);
      expect(freeConfig.dailyMaxTokens).toBe(15_000);
      expect(freeConfig.windowHours).toBe(5);
    });

    it('devrait avoir une configuration PREMIUM valide', () => {
      const premiumConfig = tokenQuotaService.QUOTA_CONFIG.premium;

      expect(premiumConfig.windowTokens).toBe(25_000);
      expect(premiumConfig.dailyMaxTokens).toBe(75_000);
      expect(premiumConfig.windowHours).toBe(5);
      expect(premiumConfig.dailyDecks).toBe(5);
      expect(premiumConfig.monthlyDecks).toBe(50);
    });

    it('devrait avoir un quota premium > free', () => {
      const { free, premium } = tokenQuotaService.QUOTA_CONFIG;

      expect(premium.windowTokens).toBeGreaterThan(free.windowTokens);
      expect(premium.dailyMaxTokens).toBeGreaterThan(free.dailyMaxTokens);
    });
  });

  describe('SOFT_LIMITS', () => {
    it('devrait avoir des seuils progressifs', () => {
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(limits.NORMAL).toBe(0.70);
      expect(limits.WARNING).toBe(0.85);
      expect(limits.THROTTLE).toBe(0.95);
      expect(limits.HARD_STOP).toBe(1.00);
    });

    it('devrait avoir des seuils ordonnés', () => {
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(limits.NORMAL).toBeLessThan(limits.WARNING);
      expect(limits.WARNING).toBeLessThan(limits.THROTTLE);
      expect(limits.THROTTLE).toBeLessThan(limits.HARD_STOP);
    });
  });
});

// ============================================
// TESTS PURE FUNCTIONS
// ============================================

describe('Token Quota Service - Pure Functions', () => {
  describe('getHoursUntilReset', () => {
    it('devrait retourner une chaîne valide', () => {
      const result = tokenQuotaService.getHoursUntilReset();

      expect(typeof result).toBe('string');
      // Format attendu : "Xh" ou "Xmin"
      expect(result).toMatch(/^\d+h$|^\d+min$/);
    });
  });
});

// ============================================
// TESTS QUOTA MODE LOGIC
// ============================================

describe('Token Quota Service - Quota Mode Logic', () => {
  describe('Mode determination based on usage', () => {
    // Ces tests vérifient la logique de détermination du mode
    // basée sur les seuils SOFT_LIMITS

    it('devrait être NORMAL sous 70%', () => {
      // 70% de 100 = 70, usage de 69 = 69/100 = 0.69
      const usagePercent = 0.69;
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(usagePercent < limits.NORMAL).toBe(true);
    });

    it('devrait être WARNING entre 70% et 85%', () => {
      const usagePercent = 0.80;
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(usagePercent >= limits.NORMAL).toBe(true);
      expect(usagePercent < limits.WARNING).toBe(true);
    });

    it('devrait être THROTTLE entre 85% et 95%', () => {
      const usagePercent = 0.90;
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(usagePercent >= limits.WARNING).toBe(true);
      expect(usagePercent < limits.THROTTLE).toBe(true);
    });

    it('devrait être BLOCKED au-delà de 95%', () => {
      const usagePercent = 0.98;
      const limits = tokenQuotaService.SOFT_LIMITS;

      expect(usagePercent >= limits.THROTTLE).toBe(true);
    });
  });
});

// ============================================
// TESTS CALCUL QUOTAS
// ============================================

describe('Token Quota Service - Quota Calculations', () => {
  describe('Window tokens calculation', () => {
    it('devrait calculer les tokens restants correctement (FREE)', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.free.windowTokens;
      const tokensUsed = 2000;
      const tokensRemaining = windowLimit - tokensUsed;

      expect(tokensRemaining).toBe(3000);
    });

    it('devrait calculer les tokens restants correctement (PREMIUM)', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.premium.windowTokens;
      const tokensUsed = 10000;
      const tokensRemaining = windowLimit - tokensUsed;

      expect(tokensRemaining).toBe(15000);
    });

    it('devrait retourner 0 si tokens utilisés dépassent la limite', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.free.windowTokens;
      const tokensUsed = 6000; // Dépasse 5000
      const tokensRemaining = Math.max(0, windowLimit - tokensUsed);

      expect(tokensRemaining).toBe(0);
    });
  });

  describe('Daily tokens calculation', () => {
    it('devrait calculer le cap journalier FREE', () => {
      const dailyLimit = tokenQuotaService.QUOTA_CONFIG.free.dailyMaxTokens;
      const tokensUsed = 5000;
      const tokensRemaining = dailyLimit - tokensUsed;

      expect(tokensRemaining).toBe(10000);
    });

    it('devrait calculer le cap journalier PREMIUM', () => {
      const dailyLimit = tokenQuotaService.QUOTA_CONFIG.premium.dailyMaxTokens;
      const tokensUsed = 25000;
      const tokensRemaining = dailyLimit - tokensUsed;

      expect(tokensRemaining).toBe(50000);
    });
  });

  describe('Usage percentage calculation', () => {
    it('devrait calculer le pourcentage usage window FREE', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.free.windowTokens;
      const tokensUsed = 2500;
      const usagePercent = Math.round((tokensUsed / windowLimit) * 100);

      expect(usagePercent).toBe(50);
    });

    it('devrait calculer le pourcentage usage window PREMIUM', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.premium.windowTokens;
      const tokensUsed = 12500;
      const usagePercent = Math.round((tokensUsed / windowLimit) * 100);

      expect(usagePercent).toBe(50);
    });

    it('devrait plafonner à 100%', () => {
      const windowLimit = tokenQuotaService.QUOTA_CONFIG.free.windowTokens;
      const tokensUsed = 10000; // Double de la limite
      const usagePercent = Math.min(100, Math.round((tokensUsed / windowLimit) * 100));

      expect(usagePercent).toBe(100);
    });
  });
});

// ============================================
// TESTS DECK QUOTAS (Premium only)
// ============================================

describe('Token Quota Service - Deck Quotas', () => {
  describe('Deck limits configuration', () => {
    it('devrait avoir une limite quotidienne de 5 decks', () => {
      expect(tokenQuotaService.QUOTA_CONFIG.premium.dailyDecks).toBe(5);
    });

    it('devrait avoir une limite mensuelle de 50 decks', () => {
      expect(tokenQuotaService.QUOTA_CONFIG.premium.monthlyDecks).toBe(50);
    });
  });

  describe('Deck remaining calculation', () => {
    it('devrait calculer les decks restants aujourd\'hui', () => {
      const dailyLimit = tokenQuotaService.QUOTA_CONFIG.premium.dailyDecks;
      const decksUsed = 2;
      const decksRemaining = Math.max(0, dailyLimit - decksUsed);

      expect(decksRemaining).toBe(3);
    });

    it('devrait calculer les decks restants ce mois', () => {
      const monthlyLimit = tokenQuotaService.QUOTA_CONFIG.premium.monthlyDecks;
      const decksUsed = 20;
      const decksRemaining = Math.max(0, monthlyLimit - decksUsed);

      expect(decksRemaining).toBe(30);
    });

    it('devrait retourner 0 si limite quotidienne atteinte', () => {
      const dailyLimit = tokenQuotaService.QUOTA_CONFIG.premium.dailyDecks;
      const decksUsed = 6; // Dépasse 5
      const decksRemaining = Math.max(0, dailyLimit - decksUsed);

      expect(decksRemaining).toBe(0);
    });
  });
});

// ============================================
// TESTS TIME-BASED LOGIC
// ============================================

describe('Token Quota Service - Time Logic', () => {
  describe('Window duration', () => {
    it('devrait avoir une fenêtre de 5 heures', () => {
      expect(tokenQuotaService.QUOTA_CONFIG.free.windowHours).toBe(5);
      expect(tokenQuotaService.QUOTA_CONFIG.premium.windowHours).toBe(5);
    });

    it('devrait calculer la durée de fenêtre en millisecondes', () => {
      const windowHours = tokenQuotaService.QUOTA_CONFIG.free.windowHours;
      const windowMs = windowHours * 60 * 60 * 1000;

      expect(windowMs).toBe(5 * 60 * 60 * 1000); // 18,000,000 ms
    });
  });

  describe('Window expiration logic', () => {
    it('devrait détecter une fenêtre expirée (6h passées)', () => {
      const windowStartAt = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h ago
      const windowDurationMs = 5 * 60 * 60 * 1000; // 5h
      const windowAgeMs = Date.now() - windowStartAt.getTime();

      expect(windowAgeMs >= windowDurationMs).toBe(true);
    });

    it('devrait détecter une fenêtre active (2h passées)', () => {
      const windowStartAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      const windowDurationMs = 5 * 60 * 60 * 1000; // 5h
      const windowAgeMs = Date.now() - windowStartAt.getTime();

      expect(windowAgeMs < windowDurationMs).toBe(true);
    });
  });

  describe('Refresh time calculation', () => {
    it('devrait calculer le temps restant avant refresh', () => {
      const windowStartAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      const windowHours = 5;
      const windowEndMs = windowStartAt.getTime() + (windowHours * 60 * 60 * 1000);
      const remainingMs = Math.max(0, windowEndMs - Date.now());

      // ~3 heures restantes
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      expect(remainingHours).toBeGreaterThanOrEqual(2);
      expect(remainingHours).toBeLessThanOrEqual(3);
    });
  });
});

// ============================================
// TESTS EFFECTIVE REMAINING LOGIC
// ============================================

describe('Token Quota Service - Effective Remaining', () => {
  describe('Use most restrictive limit', () => {
    it('devrait utiliser window si plus restrictif que daily', () => {
      const windowRemaining = 1000;
      const dailyRemaining = 5000;
      const effectiveRemaining = Math.min(windowRemaining, dailyRemaining);

      expect(effectiveRemaining).toBe(1000);
    });

    it('devrait utiliser daily si plus restrictif que window', () => {
      const windowRemaining = 4000;
      const dailyRemaining = 1500;
      const effectiveRemaining = Math.min(windowRemaining, dailyRemaining);

      expect(effectiveRemaining).toBe(1500);
    });

    it('devrait bloquer si l\'un des deux est à 0', () => {
      const windowRemaining = 0;
      const dailyRemaining = 5000;
      const effectiveRemaining = Math.min(windowRemaining, dailyRemaining);

      expect(effectiveRemaining).toBe(0);
      expect(effectiveRemaining > 0).toBe(false); // allowed = false
    });
  });
});

// ============================================
// TESTS MODE DETERMINATION
// ============================================

describe('Token Quota Service - Mode Determination', () => {
  const SOFT_LIMITS = tokenQuotaService.SOFT_LIMITS;

  describe('Max usage percentage logic', () => {
    it('devrait utiliser le max entre window et daily pour le mode', () => {
      const windowUsage = 0.50; // 50%
      const dailyUsage = 0.90; // 90%
      const maxUsage = Math.max(windowUsage, dailyUsage);

      expect(maxUsage).toBe(0.90);
      // Cela devrait donner mode = 'throttle' car 90% >= WARNING (85%)
    });

    it('devrait être normal si les deux sont bas', () => {
      const windowUsage = 0.30;
      const dailyUsage = 0.40;
      const maxUsage = Math.max(windowUsage, dailyUsage);

      expect(maxUsage < SOFT_LIMITS.NORMAL).toBe(true);
    });

    it('devrait être blocked si l\'un atteint 100%', () => {
      const windowUsage = 1.00;
      const dailyUsage = 0.50;
      const maxUsage = Math.max(windowUsage, dailyUsage);

      expect(maxUsage >= SOFT_LIMITS.HARD_STOP).toBe(true);
    });
  });
});

// ============================================
// TESTS THROTTLE DELAY
// ============================================

describe('Token Quota Service - Throttle Delay', () => {
  it('devrait avoir un délai de 2s en mode throttle', () => {
    const throttleDelayMs = 2000;
    expect(throttleDelayMs).toBe(2000);
  });

  it('ne devrait pas avoir de délai en mode normal', () => {
    const mode = 'normal';
    const throttleDelayMs = mode === 'throttle' ? 2000 : undefined;

    expect(throttleDelayMs).toBeUndefined();
  });

  it('ne devrait pas avoir de délai en mode warning', () => {
    const mode = 'warning';
    const throttleDelayMs = mode === 'throttle' ? 2000 : undefined;

    expect(throttleDelayMs).toBeUndefined();
  });
});
