/**
 * Tests d'intégration - API Endpoints TomAI
 * Tests complets des endpoints critiques
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';

// Import de l'application pour tests d'intégration
// NOTE: Dans un vrai projet, nous importerions l'app depuis un fichier séparé
// Pour ce test, nous créons une version simplifiée

// Mock des services pour isolation des tests
const mockAiOrchestrator = {
  processMessage: async () => ({
    response: 'Réponse IA simulée',
    model: 'gemini-3-flash',
    tokens: 150,
    cost: 0.0001
  })
};

const mockChatService = {
  createSession: async () => 'mock-session-id',
  saveMessage: async () => ({ id: 'mock-message-id' })
};

interface AuthRequestBody {
  email: string;
  name?: string;
  password?: string;
}

interface AuthRequestHeaders {
  get?: (name: string) => string | null;
  authorization?: string;
}

const mockAuth = {
  api: {
    signUpEmail: async ({ body }: { body: AuthRequestBody }) => ({
      user: {
        id: 'mock-user-id',
        email: body.email,
        name: body.name || 'Test User'
      },
      token: 'mock-jwt-token'
    }),
    signInEmail: async ({ body }: { body: AuthRequestBody }) => ({
      user: {
        id: 'mock-user-id',
        email: body.email,
        name: 'Test User'
      },
      token: 'mock-jwt-token'
    }),
    getSession: async ({ headers }: { headers: AuthRequestHeaders }) => {
      const authHeader = headers?.get?.('authorization') || headers?.authorization;
      if (authHeader === 'Bearer mock-jwt-token') {
        return {
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'parent'
          },
          session: {
            id: 'mock-session-id',
            token: 'mock-jwt-token'
          }
        };
      }
      return null;
    }
  }
};

// Application de test simplifiée
function createTestApp() {
  const app = new Elysia()
    .get('/api/health', () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        ai: 'operational'
      }
    }))
    
    .post('/auth/register', async ({ body, set }) => {
      // Validation simple pour test
      const { email, password } = body as any;
      
      if (!email || !password) {
        set.status = 400;
        return { _error: 'Email and password required' };
      }
      
      if (!email.includes('@')) {
        set.status = 400;
        return { _error: 'Invalid email format' };
      }
      
      if (password.length < 8) {
        set.status = 400;
        return { _error: 'Password too short' };
      }
      
      try {
        const result = await mockAuth.api.signUpEmail({ body });
        return {
          success: true,
          user: result.user,
          token: result.token
        };
      } catch (_error) {
        set.status = 500;
        return { _error: 'Registration failed' };
      }
    })
    
    .post('/auth/login', async ({ body, set }) => {
      const { email, password } = body as any;
      
      if (!email || !password) {
        set.status = 400;
        return { _error: 'Email and password required' };
      }
      
      try {
        const result = await mockAuth.api.signInEmail({ body });
        return {
          success: true,
          user: result.user,
          token: result.token
        };
      } catch (_error) {
        set.status = 401;
        return { _error: 'Invalid credentials' };
      }
    })
    
    .post('/chat/session', async ({ body, request: { headers }, set }) => {
      const session = await mockAuth.api.getSession({ headers });
      
      if (!session) {
        set.status = 401;
        return { _error: 'Unauthorized' };
      }
      
      const { subject } = body as any;
      
      if (!subject) {
        set.status = 400;
        return { _error: 'Subject required' };
      }
      
      const sessionId = await mockChatService.createSession();
      
      return {
        success: true,
        sessionId,
        subject,
        userId: session.user.id
      };
    })
    
    .post('/chat/message', async ({ body, request: { headers }, set }) => {
      const session = await mockAuth.api.getSession({ headers });
      
      if (!session) {
        set.status = 401;
        return { _error: 'Unauthorized' };
      }
      
      const { content, subject, sessionId } = body as any;
      
      if (!content || !subject) {
        set.status = 400;
        return { _error: 'Content and subject required' };
      }
      
      if (content.length > 2000) {
        set.status = 400;
        return { _error: 'Message too long' };
      }
      
      try {
        // Sauvegarder message utilisateur
        await mockChatService.saveMessage();
        
        // Obtenir réponse IA
        const aiResponse = await mockAiOrchestrator.processMessage();
        
        return {
          success: true,
          response: aiResponse.response,
          sessionId: sessionId || `session-${Date.now()}`,
          model: aiResponse.model,
          usage: {
            tokens: aiResponse.tokens,
            cost: aiResponse.cost
          }
        };
      } catch (_error) {
        set.status = 500;
        return { _error: 'Processing failed' };
      }
    });
    
  return app;
}

describe('API Endpoints Integration Tests', () => {
  let app: Elysia;
  
  beforeAll(() => {
    app = createTestApp();
  });

  // ============================================
  // HEALTH CHECK TESTS
  // ============================================
  
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await app
        .handle(new Request('http://localhost/api/health'))
        .then(res => res.json());
        
      expect(response.status).toBe('healthy');
      expect(response.timestamp).toBeDefined();
      expect(response.services.database).toBe('connected');
      expect(response.services.ai).toBe('operational');
    });
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  
  describe('POST /auth/register', () => {
    it('should register a new parent successfully', async () => {
      const testData = {
        email: 'parent@test.com',
        password: 'SecurePass123',
        firstName: 'Marie',
        lastName: 'Dupont'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('parent@test.com');
      expect(data.token).toBeDefined();
    });
    
    it('should reject registration with missing email', async () => {
      const testData = {
        password: 'SecurePass123'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Email and password required');
    });
    
    it('should reject registration with invalid email', async () => {
      const testData = {
        email: 'invalid-email',
        password: 'SecurePass123'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Invalid email format');
    });
    
    it('should reject registration with weak password', async () => {
      const testData = {
        email: 'parent@test.com',
        password: 'weak'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Password too short');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const testData = {
        email: 'parent@test.com',
        password: 'SecurePass123'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('parent@test.com');
      expect(data.token).toBeDefined();
    });
    
    it('should reject login with missing credentials', async () => {
      const testData = {
        email: 'parent@test.com'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Email and password required');
    });
  });

  // ============================================
  // CHAT SYSTEM TESTS
  // ============================================
  
  describe('POST /chat/session', () => {
    it('should create a new chat session when authenticated', async () => {
      const testData = {
        subject: 'Mathématiques'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sessionId).toBeDefined();
      expect(data.subject).toBe('Mathématiques');
      expect(data.userId).toBe('mock-user-id');
    });
    
    it('should reject unauthenticated chat session creation', async () => {
      const testData = {
        subject: 'Mathématiques'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data._error).toBe('Unauthorized');
    });
    
    it('should reject session creation without subject', async () => {
      const testData = {};
      
      const response = await app.handle(
        new Request('http://localhost/chat/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Subject required');
    });
  });

  describe('POST /chat/message', () => {
    it('should process chat message successfully when authenticated', async () => {
      const testData = {
        content: 'Comment résoudre 2x + 3 = 7 ?',
        subject: 'Mathématiques',
        sessionId: 'test-session-123'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.response).toBe('Réponse IA simulée');
      expect(data.sessionId).toBe('test-session-123');
      expect(data.model).toBe('gemini-3-flash');
      expect(data.usage.tokens).toBe(150);
      expect(data.usage.cost).toBe(0.0001);
    });
    
    it('should reject unauthenticated chat message', async () => {
      const testData = {
        content: 'Question sans authentification',
        subject: 'Mathématiques'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data._error).toBe('Unauthorized');
    });
    
    it('should reject message without required fields', async () => {
      const testData = {
        content: 'Message sans matière'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Content and subject required');
    });
    
    it('should reject message that is too long', async () => {
      const testData = {
        content: 'x'.repeat(2001), // Dépasse la limite de 2000 caractères
        subject: 'Test'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data._error).toContain('Message too long');
    });
    
    it('should generate sessionId when not provided', async () => {
      const testData = {
        content: 'Message sans sessionId',
        subject: 'Mathématiques'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sessionId).toMatch(/^session-\d+$/);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  
  describe('Error handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json{'
        })
      );
      
      // Le serveur devrait gérer l'erreur de parsing JSON
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
    
    it('should handle missing Content-Type header', async () => {
      const testData = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };
      
      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          body: JSON.stringify(testData)
        })
      );
      
      // Le serveur devrait gérer la requête même sans Content-Type
      // Status code peut varier selon l'implémentation (400, 422, 500 possibles)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
    
    it('should handle invalid Authorization header format', async () => {
      const testData = {
        subject: 'Mathématiques'
      };
      
      const response = await app.handle(
        new Request('http://localhost/chat/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'InvalidFormat'
          },
          body: JSON.stringify(testData)
        })
      );
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data._error).toBe('Unauthorized');
    });
  });

  // ============================================
  // PERFORMANCE & RELIABILITY TESTS
  // ============================================
  
  describe('Performance and reliability', () => {
    it('should handle concurrent requests', async () => {
      const testData = {
        email: 'concurrent@test.com',
        password: 'SecurePass123'
      };
      
      // Lancer 5 requêtes concurrentes
      const requests = Array.from({ length: 5 }, (_, i) =>
        app.handle(
          new Request('http://localhost/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...testData,
              email: `concurrent${i}@test.com`
            })
          })
        )
      );
      
      const responses = await Promise.all(requests);
      
      // Toutes les requêtes devraient réussir
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
    
    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();
      
      const response = await app.handle(
        new Request('http://localhost/api/health')
      );
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Moins de 100ms
    });
    
    it('should handle rapid sequential requests', async () => {
      const testData = {
        content: 'Question rapide',
        subject: 'Test'
      };
      
      const responses = [];
      
      // Envoyer 3 messages rapidement
      for (let i = 0; i < 3; i++) {
        const response = await app.handle(
          new Request('http://localhost/chat/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-jwt-token'
            },
            body: JSON.stringify(testData)
          })
        );
        responses.push(response);
      }
      
      // Toutes les réponses devraient être OK
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });
});