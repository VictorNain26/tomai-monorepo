/**
 * Tests unitaires - Validation Zod TomAI
 * Tests complets des schémas de validation
 */

import { describe, it, expect } from 'bun:test';
import { 
  validateSchema,
  registerSchema,
  loginSchema,
  chatSessionSchema,
  chatMessageSchema,
  streamChatQuerySchema,
  createChildSchema,
  emailSchema,
  passwordSchema,
  usernameSchema,
  schoolLevelSchema
} from '../schemas/validation';

describe('Validation Schemas - Unit Tests', () => {
  
  // ============================================
  // SCHÉMAS DE BASE
  // ============================================
  
  describe('emailSchema', () => {
    it('should validate valid emails', () => {
      const result = validateSchema(emailSchema, 'parent@tomai.fr');
      expect(result.success).toBe(true);
      expect(result.data).toBe('parent@tomai.fr');
    });
    
    it('should normalize email to lowercase', () => {
      const result = validateSchema(emailSchema, 'PARENT@TOMAI.FR');
      expect(result.success).toBe(true);
      expect(result.data).toBe('parent@tomai.fr');
    });
    
    it('should reject invalid email formats', () => {
      const result = validateSchema(emailSchema, 'invalid-email');
      expect(result.success).toBe(false);
      expect(result._error).toContain('Format email invalide');
    });
    
    it('should reject emails too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateSchema(emailSchema, longEmail);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Email trop long');
    });
  });

  describe('passwordSchema', () => {
    it('should validate strong passwords', () => {
      const result = validateSchema(passwordSchema, 'Password123');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Password123');
    });
    
    it('should reject weak passwords', () => {
      const result = validateSchema(passwordSchema, 'weak');
      expect(result.success).toBe(false);
      expect(result._error).toContain('Mot de passe minimum 8 caractères');
    });
    
    it('should require uppercase, lowercase, and number', () => {
      const result = validateSchema(passwordSchema, 'alllowercase123');
      expect(result.success).toBe(false);
      expect(result._error).toContain('minuscule, majuscule, chiffre');
    });
  });

  describe('usernameSchema', () => {
    it('should validate valid usernames', () => {
      const result = validateSchema(usernameSchema, 'eleve_cp');
      expect(result.success).toBe(true);
      expect(result.data).toBe('eleve_cp');
    });
    
    it('should normalize to lowercase', () => {
      const result = validateSchema(usernameSchema, 'ELEVE_CP');
      expect(result.success).toBe(true);
      expect(result.data).toBe('eleve_cp');
    });
    
    it('should reject invalid characters', () => {
      const result = validateSchema(usernameSchema, 'élève@cp');
      expect(result.success).toBe(false);
      expect(result._error).toContain('lettres, chiffres, points, underscores');
    });
  });

  describe('schoolLevelSchema', () => {
    it('should validate all French education levels', () => {
      const levels = ['cp', 'ce1', 'ce2', 'cm1', 'cm2', 'sixieme', 'cinquieme', 'quatrieme', 'troisieme', 'seconde', 'premiere', 'terminale'];

      levels.forEach(level => {
        const result = validateSchema(schoolLevelSchema, level);
        expect(result.success).toBe(true);
        expect(result.data).toBe(level);
      });
    });
    
    it('should reject invalid school levels', () => {
      const result = validateSchema(schoolLevelSchema, 'CM3');
      expect(result.success).toBe(false);
      expect(result._error).toContain('Niveau scolaire invalide');
    });
  });

  // ============================================
  // SCHÉMAS ENDPOINT AUTHENTICATION
  // ============================================
  
  describe('registerSchema', () => {
    it('should validate complete parent registration', () => {
      const validData = {
        email: 'parent@example.com',
        password: 'SecurePass123',
        firstName: 'Marie',
        lastName: 'Dupont'
      };
      
      const result = validateSchema(registerSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('parent@example.com');
      expect(result.data.firstName).toBe('Marie');
    });
    
    it('should validate minimal parent registration', () => {
      const validData = {
        email: 'parent@example.com',
        password: 'SecurePass123'
      };
      
      const result = validateSchema(registerSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.firstName).toBeUndefined();
    });
    
    it('should reject missing email', () => {
      const invalidData = {
        password: 'SecurePass123'
      };
      
      const result = validateSchema(registerSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('email');
    });
  });

  describe('loginSchema', () => {
    it('should validate parent login with email', () => {
      const validData = {
        email: 'parent@example.com',
        password: 'SecurePass123'
      };
      
      const result = validateSchema(loginSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('parent@example.com');
    });
    
    it('should validate student login with username', () => {
      const validData = {
        username: 'eleve_cp',
        password: 'SecurePass123'
      };
      
      const result = validateSchema(loginSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.username).toBe('eleve_cp');
    });
    
    it('should reject login without email or username', () => {
      const invalidData = {
        password: 'SecurePass123'
      };
      
      const result = validateSchema(loginSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Email ou username requis');
    });
  });

  // ============================================
  // SCHÉMAS CHAT & MESSAGING
  // ============================================
  
  describe('chatSessionSchema', () => {
    it('should validate chat session creation', () => {
      const validData = {
        subject: 'Mathématiques'
      };
      
      const result = validateSchema(chatSessionSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.subject).toBe('Mathématiques');
    });
    
    it('should reject empty subject', () => {
      const invalidData = {
        subject: ''
      };
      
      const result = validateSchema(chatSessionSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Matière requise');
    });
  });

  describe('chatMessageSchema', () => {
    it('should validate complete chat message', () => {
      const validData = {
        content: 'Comment résoudre 2x + 3 = 7 ?',
        subject: 'Mathématiques',
        sessionId: 'session-123'
      };
      
      const result = validateSchema(chatMessageSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Comment résoudre 2x + 3 = 7 ?');
      expect(result.data.sessionId).toBe('session-123');
    });
    
    it('should validate message without sessionId', () => {
      const validData = {
        content: 'Question de français',
        subject: 'Français'
      };
      
      const result = validateSchema(chatMessageSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBeUndefined();
    });
    
    it('should reject message too long', () => {
      const invalidData = {
        content: 'x'.repeat(2001),
        subject: 'Test'
      };
      
      const result = validateSchema(chatMessageSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Message maximum 2000 caractères');
    });
  });

  describe('streamChatQuerySchema', () => {
    it('should validate streaming parameters', () => {
      const validData = {
        message: 'Question en streaming',
        subject: 'Sciences',
        sessionId: 'stream-session-456'
      };
      
      const result = validateSchema(streamChatQuerySchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Question en streaming');
    });
    
    it('should validate without sessionId', () => {
      const validData = {
        message: 'Question en streaming',
        subject: 'Sciences'
      };
      
      const result = validateSchema(streamChatQuerySchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBeUndefined();
    });
  });

  // ============================================
  // SCHÉMAS PARENT/CHILDREN MANAGEMENT
  // ============================================
  
  describe('createChildSchema', () => {
    it('should validate complete child creation', () => {
      const validData = {
        firstName: 'Lucas',
        lastName: 'Martin',
        username: 'lucas_ce2',
        password: 'ChildPass123',
        schoolLevel: 'ce2',
        dateOfBirth: '2015-03-15'
      };
      
      const result = validateSchema(createChildSchema, validData);
      expect(result.success).toBe(true);
      expect(result.data.firstName).toBe('Lucas');
      expect(result.data.schoolLevel).toBe('ce2');
      expect(result.data.dateOfBirth).toBe('2015-03-15');
    });
    
    it('should reject child too young', () => {
      const invalidData = {
        firstName: 'Enfant',
        lastName: 'TropJeune',
        username: 'enfant_jeune',
        password: 'ChildPass123',
        schoolLevel: 'cp',
        dateOfBirth: '2022-01-01' // Trop jeune (2-3 ans)
      };
      
      const result = validateSchema(createChildSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Âge doit être entre 5 et 19 ans');
    });
    
    it('should reject child too old', () => {
      const invalidData = {
        firstName: 'Enfant',
        lastName: 'TropVieux',
        username: 'enfant_vieux',
        password: 'ChildPass123',
        schoolLevel: 'terminale',
        dateOfBirth: '2000-01-01' // Trop vieux
      };
      
      const result = validateSchema(createChildSchema, invalidData);
      expect(result.success).toBe(false);
      expect(result._error).toContain('Âge doit être entre 5 et 19 ans');
    });
  });

  // ============================================
  // HELPER VALIDATESCHEMA
  // ============================================
  
  describe('validateSchema helper', () => {
    it('should return typed success result', () => {
      const result = validateSchema(emailSchema, 'test@example.com');
      
      if (result.success) {
        // TypeScript devrait inférer que result.data est un string
        expect(typeof result.data).toBe('string');
        expect(result.data).toBe('test@example.com');
      }
    });
    
    it('should return detailed _error messages', () => {
      const result = validateSchema(registerSchema, {
        email: 'invalid-email',
        password: 'weak'
      });
      
      expect(result.success).toBe(false);
      expect(result._error).toContain('email');
      expect(result._error).toContain('password');
    });
    
    it('should handle unexpected errors gracefully', () => {
      // Passer null pour déclencher une erreur non-Zod
      const result = validateSchema(emailSchema, null);
      
      expect(result.success).toBe(false);
      expect(typeof result._error).toBe('string');
    });
  });
});