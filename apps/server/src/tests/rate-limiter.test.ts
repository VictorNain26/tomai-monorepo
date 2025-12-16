/**
 * Tests unitaires - Rate Limiting TomAI
 * Tests complets du système de rate limiting
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  checkRateLimit, 
  createRateLimitResponse,
  rateLimitConfigs 
} from '../lib/rate-limiter';

// Mock Request object pour tests
function createMockRequest(ip: string = '127.0.0.1'): Request {
  return {
    headers: new Map([
      ['x-forwarded-for', ip],
      ['x-real-ip', ip],
      ['x-remote-addr', ip]
    ])
  } as unknown as Request;
}

// Mock Context set pour tests
function createMockSet() {
  const headers: Record<string, string> = {};
  return {
    headers,
    status: 200
  };
}

describe('Rate Limiting System - Unit Tests', () => {
  
  // ============================================
  // CONFIGURATION TESTS
  // ============================================
  
  describe('rateLimitConfigs', () => {
    it('should have all required configurations', () => {
      expect(rateLimitConfigs.standard).toBeDefined();
      expect(rateLimitConfigs.aiChat).toBeDefined();
      expect(rateLimitConfigs.auth).toBeDefined();
      expect(rateLimitConfigs.streaming).toBeDefined();
      expect(rateLimitConfigs.registration).toBeDefined();
    });
    
    it('should have correct standard configuration', () => {
      const config = rateLimitConfigs.standard;
      expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.maxRequests).toBe(100);
      expect(config.message).toContain('Too many requests');
    });
    
    it('should have restrictive AI chat configuration', () => {
      const config = rateLimitConfigs.aiChat;
      expect(config.windowMs).toBe(1 * 60 * 1000); // 1 minute
      expect(config.maxRequests).toBe(10);
      expect(config.message).toContain('AI chat rate limit');
    });
    
    it('should have very restrictive auth configuration', () => {
      const config = rateLimitConfigs.auth;
      expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.maxRequests).toBe(5);
      expect(config.message).toContain('authentication attempts');
    });
    
    it('should have ultra-restrictive registration configuration', () => {
      const config = rateLimitConfigs.registration;
      expect(config.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.maxRequests).toBe(3);
      expect(config.message).toContain('registration attempts');
    });
    
    it('should have moderate streaming configuration', () => {
      const config = rateLimitConfigs.streaming;
      expect(config.windowMs).toBe(1 * 60 * 1000); // 1 minute
      expect(config.maxRequests).toBe(5);
      expect(config.message).toContain('Streaming rate limit');
    });
  });

  // ============================================
  // RATE LIMIT LOGIC TESTS
  // ============================================
  
  describe('checkRateLimit', () => {
    const testConfig = {
      windowMs: 60 * 1000, // 1 minute pour tests rapides
      maxRequests: 3,
      message: 'Test rate limit exceeded'
    };
    
    it('should allow requests within limit', async () => {
      const request = createMockRequest('192.168.1.100');
      
      // Premier appel - devrait être autorisé
      const result1 = await checkRateLimit(request, testConfig);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);
      expect(result1.totalHits).toBe(1);
      
      // Deuxième appel - devrait être autorisé
      const result2 = await checkRateLimit(request, testConfig);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
      expect(result2.totalHits).toBe(2);
    });
    
    it('should block requests when limit exceeded', async () => {
      const request = createMockRequest('192.168.1.101');
      
      // Utiliser toute la limite
      for (let i = 0; i < testConfig.maxRequests; i++) {
        const result = await checkRateLimit(request, testConfig);
        expect(result.allowed).toBe(true);
      }
      
      // Le prochain appel devrait être bloqué
      const blockedResult = await checkRateLimit(request, testConfig);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.totalHits).toBe(4);
    });
    
    it('should handle different IPs separately', async () => {
      const request1 = createMockRequest('192.168.1.102');
      const request2 = createMockRequest('192.168.1.103');
      
      // Épuiser la limite pour IP1
      for (let i = 0; i < testConfig.maxRequests; i++) {
        await checkRateLimit(request1, testConfig);
      }
      const blockedResult = await checkRateLimit(request1, testConfig);
      expect(blockedResult.allowed).toBe(false);
      
      // IP2 devrait encore être autorisée
      const allowedResult = await checkRateLimit(request2, testConfig);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.totalHits).toBe(1);
    });
    
    it('should use custom identifier when provided', async () => {
      const request = createMockRequest('192.168.1.104');
      const customIdentifier = 'user-12345';
      
      const result1 = await checkRateLimit(request, testConfig, customIdentifier);
      expect(result1.allowed).toBe(true);
      expect(result1.totalHits).toBe(1);
      
      const result2 = await checkRateLimit(request, testConfig, customIdentifier);
      expect(result2.allowed).toBe(true);
      expect(result2.totalHits).toBe(2);
    });
    
    it('should extract IP from various headers', async () => {
      // Test x-forwarded-for
      const request1 = {
        headers: new Map([['x-forwarded-for', '10.0.0.1, 192.168.1.1']])
      } as unknown as Request;
      
      const result1 = await checkRateLimit(request1, testConfig);
      expect(result1.allowed).toBe(true);
      
      // Test x-real-ip
      const request2 = {
        headers: new Map([['x-real-ip', '10.0.0.2']])
      } as unknown as Request;
      
      const result2 = await checkRateLimit(request2, testConfig);
      expect(result2.allowed).toBe(true);
      
      // Test x-remote-addr
      const request3 = {
        headers: new Map([['x-remote-addr', '10.0.0.3']])
      } as unknown as Request;
      
      const result3 = await checkRateLimit(request3, testConfig);
      expect(result3.allowed).toBe(true);
    });
    
    it('should handle requests without IP headers', async () => {
      const request = {
        headers: new Map()
      } as unknown as Request;
      
      const result = await checkRateLimit(request, testConfig);
      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(1);
    });
  });

  // ============================================
  // RESPONSE CREATION TESTS
  // ============================================
  
  describe('createRateLimitResponse', () => {
    it('should set standard rate limit headers when allowed', () => {
      const result = {
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 3
      };
      
      const config = rateLimitConfigs.standard;
      const mockSet = createMockSet();
      
      const response = createRateLimitResponse(result, config, mockSet);
      
      expect(response).toBeNull(); // Allowed, continue
      expect(mockSet.headers['X-RateLimit-Limit']).toBe('100');
      expect(mockSet.headers['X-RateLimit-Remaining']).toBe('5');
      expect(mockSet.headers['X-RateLimit-Reset']).toBeDefined();
    });
    
    it('should return _error response when blocked', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30000,
        totalHits: 11
      };
      
      const config = rateLimitConfigs.aiChat;
      const mockSet = createMockSet();
      
      const response = createRateLimitResponse(result, config, mockSet);
      
      expect(response).not.toBeNull();
      expect(response?._error).toBe('Rate Limit Exceeded');
      expect(response?.message).toContain('AI chat rate limit');
      expect(response?.limit).toBe(10);
      expect(response?.remaining).toBe(0);
      // Note: Dans un test réel, nous vérifierions que le status a été défini à 429
      expect(mockSet.headers['Retry-After']).toBeDefined();
    });
    
    it('should set legacy headers when enabled', () => {
      const result = {
        allowed: true,
        remaining: 2,
        resetTime: Date.now() + 45000,
        totalHits: 3
      };
      
      const config = {
        ...rateLimitConfigs.standard,
        legacyHeaders: true
      };
      const mockSet = createMockSet();
      
      createRateLimitResponse(result, config, mockSet);
      
      expect(mockSet.headers['X-Rate-Limit-Limit']).toBe('100');
      expect(mockSet.headers['X-Rate-Limit-Remaining']).toBe('2');
      expect(mockSet.headers['X-Rate-Limit-Reset']).toBeDefined();
    });
    
    it('should skip headers when disabled', () => {
      const result = {
        allowed: true,
        remaining: 8,
        resetTime: Date.now() + 120000,
        totalHits: 2
      };
      
      const config = {
        ...rateLimitConfigs.standard,
        standardHeaders: false,
        legacyHeaders: false
      };
      const mockSet = createMockSet();
      
      createRateLimitResponse(result, config, mockSet);
      
      expect(mockSet.headers['X-RateLimit-Limit']).toBeUndefined();
      expect(mockSet.headers['X-Rate-Limit-Limit']).toBeUndefined();
    });
  });

  // ============================================
  // INTEGRATION SCENARIOS
  // ============================================
  
  describe('Real-world scenarios', () => {
    it('should handle registration rate limiting correctly', async () => {
      const request = createMockRequest('203.0.113.1');
      const config = rateLimitConfigs.registration;
      
      // Premier enregistrement - autorisé
      const result1 = await checkRateLimit(request, config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);
      
      // Deuxième enregistrement - autorisé
      const result2 = await checkRateLimit(request, config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
      
      // Troisième enregistrement - autorisé
      const result3 = await checkRateLimit(request, config);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
      
      // Quatrième enregistrement - bloqué
      const result4 = await checkRateLimit(request, config);
      expect(result4.allowed).toBe(false);
      expect(result4.remaining).toBe(0);
    });
    
    it('should handle AI chat bursts correctly', async () => {
      const request = createMockRequest('203.0.113.2');
      const config = rateLimitConfigs.aiChat;
      
      // Simuler 10 requêtes rapides - toutes autorisées
      for (let i = 1; i <= config.maxRequests; i++) {
        const result = await checkRateLimit(request, config);
        expect(result.allowed).toBe(true);
        expect(result.totalHits).toBe(i);
      }
      
      // La 11ème requête devrait être bloquée
      const blockedResult = await checkRateLimit(request, config);
      expect(blockedResult.allowed).toBe(false);
    });
    
    it('should handle authentication attempts correctly', async () => {
      const request = createMockRequest('203.0.113.3');
      const config = rateLimitConfigs.auth;
      
      // 5 tentatives autorisées
      for (let i = 1; i <= config.maxRequests; i++) {
        const result = await checkRateLimit(request, config);
        expect(result.allowed).toBe(true);
      }
      
      // 6ème tentative bloquée
      const blockedResult = await checkRateLimit(request, config);
      expect(blockedResult.allowed).toBe(false);
      
      const mockSet = createMockSet();
      const response = createRateLimitResponse(blockedResult, config, mockSet);
      
      expect(response?.message).toContain('authentication attempts');
      // Note: Dans un test réel, nous vérifierions que le status a été défini à 429
    });
  });

  // ============================================
  // EDGE CASES & ERROR HANDLING
  // ============================================
  
  describe('Edge cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const request = createMockRequest('203.0.113.4');
      const config = {
        windowMs: 60000,
        maxRequests: 1,
        message: 'Single request limit'
      };
      
      // Lancer 3 requêtes concurrentes
      const promises = [
        checkRateLimit(request, config),
        checkRateLimit(request, config),
        checkRateLimit(request, config)
      ];
      
      const results = await Promise.all(promises);
      
      // Au moins une devrait être autorisée, d'autres possiblement bloquées
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBeGreaterThanOrEqual(1);
    });
    
    it('should handle very short time windows', async () => {
      const request = createMockRequest('203.0.113.5');
      const config = {
        windowMs: 100, // 100ms
        maxRequests: 2,
        message: 'Very short window'
      };
      
      const result1 = await checkRateLimit(request, config);
      expect(result1.allowed).toBe(true);
      
      const result2 = await checkRateLimit(request, config);
      expect(result2.allowed).toBe(true);
      
      const result3 = await checkRateLimit(request, config);
      expect(result3.allowed).toBe(false);
    });
    
    it('should handle malformed headers gracefully', async () => {
      const request = {
        headers: new Map([
          ['x-forwarded-for', ''], // Header vide
          ['x-real-ip', 'invalid-ip-format'],
          ['content-type', 'application/json']
        ])
      } as unknown as Request;
      
      const config = rateLimitConfigs.standard;
      
      const result = await checkRateLimit(request, config);
      expect(result.allowed).toBe(true);
      expect(typeof result.totalHits).toBe('number');
      expect(typeof result.remaining).toBe('number');
    });
  });
});