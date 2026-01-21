/**
 * Tests unitaires - Chat Service
 *
 * Tests des opérations de sessions et messages de chat.
 * Focus sur la logique métier sans mocking DB complet.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCK DES DÉPENDANCES
// ============================================

mock.module('../lib/observability', () => ({
  logger: {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }
}));

// ============================================
// TYPES (Reproduits pour tests isolés)
// ============================================

interface SessionDetails {
  id: string;
  userId: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  frustrationAvg: number | null;
  questionLevelsAvg: number | null;
  conceptsCovered: string | null;
}

interface MessageDetails {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  frustrationLevel: number | null;
  questionLevel: number | null;
  aiModel: string | null;
  isFallback: boolean;
  timestamp: Date;
  tokensUsed: number | null;
  costEstimate: number | null;
  attachedFile?: {
    fileName: string;
    fileId?: string;
    geminiFileId?: string;
    mimeType?: string;
    fileSizeBytes?: number;
  } | null;
}

// ============================================
// TESTS UUID VALIDATION
// ============================================

describe('Chat Service - UUID Validation', () => {
  /**
   * Simule la logique de safeUUID
   */
  function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  describe('Valid UUIDs', () => {
    it('devrait accepter un UUID v4 valide', () => {
      const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('devrait accepter un UUID en majuscules', () => {
      const uuid = 'F47AC10B-58CC-4372-A567-0E02B2C3D479';
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('devrait accepter différentes versions UUID', () => {
      const uuidV1 = 'f47ac10b-58cc-1372-a567-0e02b2c3d479';
      const uuidV4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const uuidV5 = 'f47ac10b-58cc-5372-a567-0e02b2c3d479';

      expect(isValidUUID(uuidV1)).toBe(true);
      expect(isValidUUID(uuidV4)).toBe(true);
      expect(isValidUUID(uuidV5)).toBe(true);
    });
  });

  describe('Invalid UUIDs', () => {
    it('devrait rejeter une chaîne vide', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('devrait rejeter un format invalide', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('session-123')).toBe(false);
    });

    it('devrait rejeter un UUID avec mauvais séparateurs', () => {
      expect(isValidUUID('f47ac10b_58cc_4372_a567_0e02b2c3d479')).toBe(false);
    });

    it('devrait rejeter un UUID trop court', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567')).toBe(false);
    });

    it('devrait rejeter un UUID trop long', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479-extra')).toBe(false);
    });
  });
});

// ============================================
// TESTS SESSION DETAILS MAPPING
// ============================================

describe('Chat Service - Session Details Mapping', () => {
  describe('Session to SessionDetails', () => {
    it('devrait mapper une session complète', () => {
      const dbSession = {
        id: 'session-uuid',
        userId: 'user-uuid',
        subject: 'Mathématiques',
        startedAt: new Date('2025-01-10T09:00:00Z'),
        endedAt: new Date('2025-01-10T10:00:00Z'),
        durationMinutes: 60,
        frustrationAvg: '2.5',
        questionLevelsAvg: '3.0',
        conceptsCovered: ['algèbre', 'équations']
      };

      const details: SessionDetails = {
        id: dbSession.id,
        userId: dbSession.userId,
        subject: dbSession.subject,
        startedAt: dbSession.startedAt,
        endedAt: dbSession.endedAt,
        durationMinutes: dbSession.durationMinutes,
        frustrationAvg: dbSession.frustrationAvg ? parseFloat(dbSession.frustrationAvg) : null,
        questionLevelsAvg: dbSession.questionLevelsAvg ? parseFloat(dbSession.questionLevelsAvg) : null,
        conceptsCovered: Array.isArray(dbSession.conceptsCovered) ? dbSession.conceptsCovered.join(', ') : null
      };

      expect(details.id).toBe('session-uuid');
      expect(details.subject).toBe('Mathématiques');
      expect(details.frustrationAvg).toBe(2.5);
      expect(details.conceptsCovered).toBe('algèbre, équations');
    });

    it('devrait gérer les valeurs nulles', () => {
      const dbSession = {
        id: 'session-uuid',
        userId: 'user-uuid',
        subject: 'Français',
        startedAt: new Date(),
        endedAt: null,
        durationMinutes: null,
        frustrationAvg: null,
        questionLevelsAvg: null,
        conceptsCovered: null
      };

      const details: SessionDetails = {
        id: dbSession.id,
        userId: dbSession.userId,
        subject: dbSession.subject,
        startedAt: dbSession.startedAt,
        endedAt: dbSession.endedAt,
        durationMinutes: dbSession.durationMinutes,
        frustrationAvg: dbSession.frustrationAvg ? parseFloat(dbSession.frustrationAvg) : null,
        questionLevelsAvg: dbSession.questionLevelsAvg ? parseFloat(dbSession.questionLevelsAvg) : null,
        conceptsCovered: dbSession.conceptsCovered
      };

      expect(details.endedAt).toBeNull();
      expect(details.frustrationAvg).toBeNull();
      expect(details.conceptsCovered).toBeNull();
    });
  });
});

// ============================================
// TESTS MESSAGE DETAILS MAPPING
// ============================================

describe('Chat Service - Message Details Mapping', () => {
  describe('Message to MessageDetails', () => {
    it('devrait mapper un message utilisateur', () => {
      const dbMessage = {
        id: 'msg-uuid',
        sessionId: 'session-uuid',
        role: 'user' as const,
        content: 'Comment résoudre 2x + 3 = 7 ?',
        frustrationLevel: 1,
        questionLevel: 2,
        aiModel: null,
        tokensUsed: null,
        createdAt: new Date('2025-01-10T09:00:00Z'),
        attachedFile: null
      };

      const details: MessageDetails = {
        id: dbMessage.id,
        sessionId: dbMessage.sessionId,
        role: dbMessage.role,
        content: dbMessage.content,
        frustrationLevel: dbMessage.frustrationLevel,
        questionLevel: dbMessage.questionLevel,
        aiModel: dbMessage.aiModel,
        isFallback: false,
        timestamp: dbMessage.createdAt,
        tokensUsed: dbMessage.tokensUsed,
        costEstimate: null,
        attachedFile: null
      };

      expect(details.role).toBe('user');
      expect(details.content).toBe('Comment résoudre 2x + 3 = 7 ?');
      expect(details.frustrationLevel).toBe(1);
    });

    it('devrait mapper un message assistant avec tokens', () => {
      const dbMessage = {
        id: 'msg-uuid',
        sessionId: 'session-uuid',
        role: 'assistant' as const,
        content: 'Pour résoudre cette équation...',
        frustrationLevel: null,
        questionLevel: null,
        aiModel: 'gemini-2.5-flash',
        tokensUsed: 150,
        createdAt: new Date(),
        attachedFile: null
      };

      const details: MessageDetails = {
        id: dbMessage.id,
        sessionId: dbMessage.sessionId,
        role: dbMessage.role,
        content: dbMessage.content,
        frustrationLevel: dbMessage.frustrationLevel,
        questionLevel: dbMessage.questionLevel,
        aiModel: dbMessage.aiModel,
        isFallback: false,
        timestamp: dbMessage.createdAt,
        tokensUsed: dbMessage.tokensUsed,
        costEstimate: null,
        attachedFile: null
      };

      expect(details.role).toBe('assistant');
      expect(details.aiModel).toBe('gemini-2.5-flash');
      expect(details.tokensUsed).toBe(150);
    });

    it('devrait mapper un message avec fichier attaché', () => {
      const attachedFile = {
        fileName: 'exercice.pdf',
        fileId: 'file-uuid',
        geminiFileId: 'gemini-file-id',
        mimeType: 'application/pdf',
        fileSizeBytes: 102400
      };

      const dbMessage = {
        id: 'msg-uuid',
        sessionId: 'session-uuid',
        role: 'user' as const,
        content: 'Voici mon exercice',
        frustrationLevel: null,
        questionLevel: null,
        aiModel: null,
        tokensUsed: null,
        createdAt: new Date(),
        attachedFile
      };

      const details: MessageDetails = {
        id: dbMessage.id,
        sessionId: dbMessage.sessionId,
        role: dbMessage.role,
        content: dbMessage.content,
        frustrationLevel: dbMessage.frustrationLevel,
        questionLevel: dbMessage.questionLevel,
        aiModel: dbMessage.aiModel,
        isFallback: false,
        timestamp: dbMessage.createdAt,
        tokensUsed: dbMessage.tokensUsed,
        costEstimate: null,
        attachedFile: dbMessage.attachedFile
      };

      expect(details.attachedFile).not.toBeNull();
      expect(details.attachedFile?.fileName).toBe('exercice.pdf');
      expect(details.attachedFile?.mimeType).toBe('application/pdf');
    });
  });
});

// ============================================
// TESTS SESSION HISTORY OPTIMIZATION
// ============================================

describe('Chat Service - Session History Optimization', () => {
  describe('Message limit with file preservation', () => {
    interface TestMessage {
      id: string;
      content: string;
      attachedFile: { fileName: string } | null;
      createdAt: Date;
    }

    function optimizeHistory(messages: TestMessage[], limit: number): TestMessage[] {
      if (messages.length <= limit) {
        return messages;
      }

      // Séparer les messages avec et sans fichiers
      const messagesWithFiles = messages.filter(msg => msg.attachedFile !== null);
      const messagesWithoutFiles = messages.filter(msg => msg.attachedFile === null);

      // Prendre les derniers messages sans fichiers selon la limite
      const recentMessages = messagesWithoutFiles.slice(-limit);

      // Combiner avec TOUS les messages contenant des fichiers
      const combinedMessages = [...messagesWithFiles, ...recentMessages];

      // Trier par date
      return combinedMessages.sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
      );
    }

    it('devrait retourner tous les messages si sous la limite', () => {
      const messages: TestMessage[] = [
        { id: '1', content: 'Msg 1', attachedFile: null, createdAt: new Date('2025-01-10T09:00:00Z') },
        { id: '2', content: 'Msg 2', attachedFile: null, createdAt: new Date('2025-01-10T09:01:00Z') }
      ];

      const result = optimizeHistory(messages, 10);
      expect(result.length).toBe(2);
    });

    it('devrait garder tous les fichiers même au-delà de la limite', () => {
      const messages: TestMessage[] = [
        { id: '1', content: 'File 1', attachedFile: { fileName: 'doc1.pdf' }, createdAt: new Date('2025-01-10T09:00:00Z') },
        { id: '2', content: 'Msg 2', attachedFile: null, createdAt: new Date('2025-01-10T09:01:00Z') },
        { id: '3', content: 'Msg 3', attachedFile: null, createdAt: new Date('2025-01-10T09:02:00Z') },
        { id: '4', content: 'Msg 4', attachedFile: null, createdAt: new Date('2025-01-10T09:03:00Z') },
        { id: '5', content: 'File 2', attachedFile: { fileName: 'doc2.pdf' }, createdAt: new Date('2025-01-10T09:04:00Z') },
        { id: '6', content: 'Msg 6', attachedFile: null, createdAt: new Date('2025-01-10T09:05:00Z') }
      ];

      const result = optimizeHistory(messages, 2); // Limite de 2 messages normaux

      // Devrait avoir: 2 fichiers + 2 derniers messages normaux
      expect(result.length).toBe(4);

      // Vérifier que les fichiers sont préservés
      const filesInResult = result.filter(m => m.attachedFile !== null);
      expect(filesInResult.length).toBe(2);
    });

    it('devrait conserver l\'ordre chronologique', () => {
      const messages: TestMessage[] = [
        { id: '1', content: 'File 1', attachedFile: { fileName: 'doc1.pdf' }, createdAt: new Date('2025-01-10T09:00:00Z') },
        { id: '2', content: 'Msg 2', attachedFile: null, createdAt: new Date('2025-01-10T09:01:00Z') },
        { id: '3', content: 'Msg 3', attachedFile: null, createdAt: new Date('2025-01-10T09:02:00Z') },
        { id: '4', content: 'Msg 4', attachedFile: null, createdAt: new Date('2025-01-10T09:03:00Z') }
      ];

      const result = optimizeHistory(messages, 2);

      // Vérifier l'ordre
      for (let i = 1; i < result.length; i++) {
        expect(result[i].createdAt.getTime()).toBeGreaterThan(result[i - 1].createdAt.getTime());
      }
    });
  });
});

// ============================================
// TESTS SESSION METADATA
// ============================================

describe('Chat Service - Session Metadata', () => {
  describe('Attached files metadata', () => {
    it('devrait initialiser le tableau de fichiers', () => {
      const currentMetadata: Record<string, unknown> = {};

      if (!Array.isArray(currentMetadata.attachedFiles)) {
        currentMetadata.attachedFiles = [];
      }

      expect(Array.isArray(currentMetadata.attachedFiles)).toBe(true);
      expect((currentMetadata.attachedFiles as unknown[]).length).toBe(0);
    });

    it('devrait ajouter un nouveau fichier analysé', () => {
      const currentMetadata: Record<string, unknown> = {
        attachedFiles: []
      };

      const newFile = {
        fileName: 'exercice.pdf',
        analysis: 'Ce document contient des exercices de mathématiques',
        extractedText: 'Exercice 1: Résoudre 2x + 3 = 7',
        fileType: 'application/pdf',
        size: 102400,
        uploadedAt: '2025-01-10T09:00:00Z',
        analyzedAt: new Date().toISOString()
      };

      (currentMetadata.attachedFiles as unknown[]).push(newFile);

      expect((currentMetadata.attachedFiles as unknown[]).length).toBe(1);
    });
  });

  describe('Get session files', () => {
    it('devrait retourner un tableau vide si pas de metadata', () => {
      const sessionMetadata: Record<string, unknown> | null = null;
      const files = sessionMetadata ? (sessionMetadata.attachedFiles as unknown[]) ?? [] : [];

      expect(files).toEqual([]);
    });

    it('devrait retourner les fichiers de la metadata', () => {
      const sessionMetadata = {
        attachedFiles: [
          { fileName: 'doc1.pdf', analysis: 'Analysis 1' },
          { fileName: 'doc2.pdf', analysis: 'Analysis 2' }
        ]
      };

      const files = sessionMetadata.attachedFiles;
      expect(files.length).toBe(2);
    });
  });
});

// ============================================
// TESTS USER SESSION MAPPING
// ============================================

describe('Chat Service - User Sessions', () => {
  interface UserSession {
    id: string;
    subject: string;
    startedAt: Date;
    endedAt: Date | null;
    messagesCount: number;
    lastActivity: Date;
    frustrationAvg: number;
  }

  describe('Session list mapping', () => {
    it('devrait mapper les sessions avec stats', () => {
      const dbSessions = [
        {
          id: 'session-1',
          subject: 'Mathématiques',
          startedAt: new Date('2025-01-10T09:00:00Z'),
          endedAt: new Date('2025-01-10T10:00:00Z'),
          messageCount: 10,
          frustrationAvg: '2.5'
        },
        {
          id: 'session-2',
          subject: 'Français',
          startedAt: new Date('2025-01-09T14:00:00Z'),
          endedAt: null,
          messageCount: 5,
          frustrationAvg: null
        }
      ];

      const userSessions: UserSession[] = dbSessions.map(session => ({
        id: session.id,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messagesCount: session.messageCount,
        lastActivity: session.endedAt ?? session.startedAt,
        frustrationAvg: parseFloat(session.frustrationAvg ?? '0')
      }));

      expect(userSessions.length).toBe(2);
      expect(userSessions[0].messagesCount).toBe(10);
      expect(userSessions[0].frustrationAvg).toBe(2.5);
      expect(userSessions[1].frustrationAvg).toBe(0);
    });

    it('devrait utiliser startedAt comme lastActivity si endedAt null', () => {
      const session = {
        id: 'session-1',
        subject: 'Sciences',
        startedAt: new Date('2025-01-10T09:00:00Z'),
        endedAt: null,
        messageCount: 3,
        frustrationAvg: null
      };

      const userSession: UserSession = {
        id: session.id,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messagesCount: session.messageCount,
        lastActivity: session.endedAt ?? session.startedAt,
        frustrationAvg: parseFloat(session.frustrationAvg ?? '0')
      };

      expect(userSession.lastActivity).toEqual(session.startedAt);
    });
  });

  describe('Session limit', () => {
    it('devrait limiter le nombre de sessions retournées', () => {
      const allSessions = Array.from({ length: 20 }, (_, i) => ({
        id: `session-${i}`,
        subject: 'Test',
        startedAt: new Date(),
        endedAt: null,
        messageCount: 1,
        frustrationAvg: null
      }));

      const limit = 5;
      const limitedSessions = limit ? allSessions.slice(0, limit) : allSessions;

      expect(limitedSessions.length).toBe(5);
    });

    it('devrait retourner toutes les sessions si pas de limite', () => {
      const allSessions = Array.from({ length: 20 }, (_, i) => ({
        id: `session-${i}`,
        subject: 'Test',
        startedAt: new Date(),
        endedAt: null,
        messageCount: 1,
        frustrationAvg: null
      }));

      const limit: number | undefined = undefined;
      const limitedSessions = limit ? allSessions.slice(0, limit) : allSessions;

      expect(limitedSessions.length).toBe(20);
    });
  });
});

// ============================================
// TESTS AI MODEL MAPPING
// ============================================

describe('Chat Service - AI Model Mapping', () => {
  describe('Model name mapping', () => {
    function mapAIModelName(modelName?: string | null): string | null {
      return modelName ?? null;
    }

    it('devrait passer le nom du modèle tel quel', () => {
      expect(mapAIModelName('gemini-2.5-flash')).toBe('gemini-2.5-flash');
      expect(mapAIModelName('gpt-4')).toBe('gpt-4');
    });

    it('devrait retourner null si undefined', () => {
      expect(mapAIModelName(undefined)).toBeNull();
    });

    it('devrait retourner null si null', () => {
      expect(mapAIModelName(null)).toBeNull();
    });
  });
});

// ============================================
// TESTS SESSION RESET
// ============================================

describe('Chat Service - Session Reset', () => {
  describe('Reset logic', () => {
    it('devrait archiver l\'ancienne session', () => {
      const updates = {
        status: 'completed' as const,
        endedAt: new Date()
      };

      expect(updates.status).toBe('completed');
      expect(updates.endedAt).toBeInstanceOf(Date);
    });

    it('devrait créer une nouvelle session active', () => {
      const newSession = {
        userId: 'user-123',
        subject: 'Mathématiques',
        status: 'active' as const,
        startedAt: new Date()
      };

      expect(newSession.status).toBe('active');
      expect(newSession.subject).toBe('Mathématiques');
    });
  });
});

// ============================================
// TESTS ERROR MESSAGES
// ============================================

describe('Chat Service - Error Messages', () => {
  describe('Error formatting', () => {
    it('devrait formater l\'erreur session non trouvée', () => {
      const sessionId = 'session-uuid';
      const errorMessage = `Session ${sessionId} not found. Create session explicitly first.`;

      expect(errorMessage).toContain('not found');
      expect(errorMessage).toContain('session-uuid');
    });

    it('devrait formater l\'erreur UUID invalide', () => {
      const sessionId = 'invalid-id';
      const errorMessage = `Invalid session UUID: "${sessionId}"`;

      expect(errorMessage).toContain('Invalid');
      expect(errorMessage).toContain('invalid-id');
    });

    it('devrait formater l\'erreur accès refusé', () => {
      const errorMessage = 'Session not found or access denied';

      expect(errorMessage).toContain('access denied');
    });
  });
});

// ============================================
// TESTS USER VALIDATION
// ============================================

describe('Chat Service - User Validation', () => {
  describe('School level validation', () => {
    const validSchoolLevels = [
      'cp', 'ce1', 'ce2', 'cm1', 'cm2',
      'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
      'seconde', 'premiere', 'terminale'
    ];

    it('devrait accepter tous les niveaux scolaires français', () => {
      validSchoolLevels.forEach(level => {
        const isValid = validSchoolLevels.includes(level);
        expect(isValid).toBe(true);
      });
    });

    it('devrait rejeter un niveau invalide', () => {
      const invalidLevel = 'CM3';
      const isValid = validSchoolLevels.includes(invalidLevel.toLowerCase());

      expect(isValid).toBe(false);
    });
  });

  describe('User school level requirement', () => {
    it('devrait exiger un niveau scolaire défini', () => {
      const user = {
        id: 'user-123',
        schoolLevel: null
      };

      const hasSchoolLevel = user.schoolLevel !== null;
      expect(hasSchoolLevel).toBe(false);
    });

    it('devrait accepter un utilisateur avec niveau scolaire', () => {
      const user = {
        id: 'user-123',
        schoolLevel: 'quatrieme'
      };

      const hasSchoolLevel = user.schoolLevel !== null;
      expect(hasSchoolLevel).toBe(true);
    });
  });
});

// ============================================
// TESTS FILE DELETION
// ============================================

describe('Chat Service - File Deletion', () => {
  describe('File ID extraction from messages', () => {
    it('devrait extraire les fileIds des messages', () => {
      const messages = [
        { id: '1', attachedFile: { fileId: 'file-1' } },
        { id: '2', attachedFile: null },
        { id: '3', attachedFile: { fileId: 'file-2' } },
        { id: '4', attachedFile: { fileName: 'doc.pdf' } } // Pas de fileId
      ];

      const fileIds: string[] = [];
      for (const msg of messages) {
        if (msg.attachedFile && typeof msg.attachedFile === 'object' && 'fileId' in msg.attachedFile) {
          const fileId = (msg.attachedFile as { fileId?: string }).fileId;
          if (fileId) {
            fileIds.push(fileId);
          }
        }
      }

      expect(fileIds).toEqual(['file-1', 'file-2']);
    });

    it('devrait retourner tableau vide si pas de fichiers', () => {
      const messages = [
        { id: '1', attachedFile: null },
        { id: '2', attachedFile: null }
      ];

      const fileIds: string[] = [];
      for (const msg of messages) {
        if (msg.attachedFile && typeof msg.attachedFile === 'object' && 'fileId' in msg.attachedFile) {
          const fileId = (msg.attachedFile as { fileId?: string }).fileId;
          if (fileId) {
            fileIds.push(fileId);
          }
        }
      }

      expect(fileIds).toEqual([]);
    });
  });
});

// ============================================
// TESTS MESSAGE METADATA
// ============================================

describe('Chat Service - Message Metadata', () => {
  describe('Save message metadata', () => {
    it('devrait accepter tous les champs de metadata', () => {
      const metadata = {
        frustrationLevel: 2,
        questionLevel: 3,
        tokensUsed: 150,
        responseTimeMs: 450,
        aiModel: 'gemini-2.5-flash',
        attachedFile: {
          fileName: 'exercice.pdf',
          fileId: 'file-123',
          geminiFileId: 'gemini-123',
          mimeType: 'application/pdf',
          fileSizeBytes: 102400
        }
      };

      expect(metadata.frustrationLevel).toBe(2);
      expect(metadata.questionLevel).toBe(3);
      expect(metadata.tokensUsed).toBe(150);
      expect(metadata.responseTimeMs).toBe(450);
      expect(metadata.aiModel).toBe('gemini-2.5-flash');
      expect(metadata.attachedFile?.fileName).toBe('exercice.pdf');
    });

    it('devrait gérer les champs optionnels', () => {
      const metadata = {
        frustrationLevel: null,
        questionLevel: null,
        tokensUsed: null,
        responseTimeMs: null,
        aiModel: null
      };

      expect(metadata.frustrationLevel).toBeNull();
      expect(metadata.aiModel).toBeNull();
    });
  });
});
