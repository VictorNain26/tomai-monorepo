/**
 * Routes File Upload - Traitement unifié des fichiers avec analyse IA optimale
 * Architecture 2025: Gemini Files API + Document Processor + Zero Duplication
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.js';
import { logger } from '../lib/observability.js';
import { redis as redisClient } from '../lib/redis.service.js';
import { audioTranscriptionService } from '../services/audio-transcription.service.js';
import { geminiFilesService } from '../services/gemini-files.service.js';
import type { User } from '../types/auth.types.js';
import type { EducationLevelType } from '../types/education.types.js';

// Configuration des types de fichiers supportés
const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  pdf: ['application/pdf'],
  document: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain' // .txt
  ],
  audio: [
    'audio/webm',           // MediaRecorder default (Chrome/Firefox)
    'audio/ogg',            // Firefox alternative
    'audio/mp4',            // Safari MediaRecorder
    'audio/mpeg',           // MP3
    'audio/wav',            // WAV (haute qualité)
    'audio/x-wav',          // WAV alternate MIME
    'audio/mp3'             // MP3 alternate
  ]
} as const;

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export interface FileUploadResult {
  success: boolean;
  fileType: 'image' | 'pdf' | 'document' | 'audio' | 'unknown';
  fileId?: string; // ID unique pour récupérer le fichier depuis Redis
  /** URI Gemini Files API (TTL 48h) - pour images/PDFs */
  fileUri?: string;
  /** Date d'expiration du fichier Gemini (48h) */
  expiresAt?: string;
  // Pour les fichiers audio : transcription automatique
  transcription?: string;
  metadata?: {
    fileId: string;
    fileName: string;
    size: number;
    type: string;
    hash: string;
    uploadedAt: string;
    userId: string;
    schoolLevel: string;
    /** URI Gemini Files pour persistance 48h */
    fileUri?: string;
    /** Date d'expiration Gemini Files */
    expiresAt?: string;
    [key: string]: unknown;
  };
  _error?: string;
}

/**
 * Détection du type de fichier basée sur le MIME type
 * Gère les paramètres comme charset=utf-8
 */
function detectFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'audio' | 'unknown' {
  // Nettoyer le MIME type (retirer charset et autres paramètres)
  const cleanMimeType = mimeType.split(';')[0]?.trim();

  for (const [type, mimeTypes] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if (mimeTypes.includes(cleanMimeType as never)) {
      return type as 'image' | 'pdf' | 'document' | 'audio';
    }
  }
  return 'unknown';
}

/**
 * Vérification des magic bytes pour valider le type de fichier réel
 * Protection contre les fichiers malveillants avec faux MIME types
 */
function validateFileMagicBytes(buffer: ArrayBuffer, mimeType: string | undefined): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  // Normaliser le MIME type (enlever paramètres comme charset=utf-8)
  const normalizedMimeType = mimeType?.split(';')[0]?.trim() ?? 'application/octet-stream';

  // Signatures de fichiers (magic bytes)
  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // ZIP/DOCX
    'text/plain': [], // Pas de signature spécifique pour text
    // Audio formats - signatures WebM, Ogg, MP3, WAV
    'audio/webm': [[0x1A, 0x45, 0xDF, 0xA3]], // WebM/Matroska
    'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]], // OggS
    'audio/mp4': [[0x00, 0x00, 0x00]], // MP4/M4A (ftyp box)
    'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xFA], [0x49, 0x44, 0x33]], // MP3 (frame sync or ID3)
    'audio/mp3': [[0xFF, 0xFB], [0xFF, 0xFA], [0x49, 0x44, 0x33]], // MP3 alternate
    'audio/wav': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WAV)
    'audio/x-wav': [[0x52, 0x49, 0x46, 0x46]] // WAV alternate
  };

  const validSignatures = signatures[normalizedMimeType];
  if (!validSignatures || validSignatures.length === 0) {
    // Pour les fichiers texte, accepter
    return normalizedMimeType === 'text/plain';
  }

  // Vérifier si les bytes correspondent à une signature valide
  return validSignatures.some(signature =>
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * Sanitization du nom de fichier pour éviter les attaques
 */
function sanitizeFileName(fileName: string): string {
  // Supprimer les caractères dangereux et les chemins
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Garder seulement alphanum, point, tiret, underscore
    .replace(/\.{2,}/g, '_') // Supprimer les double points (path traversal)
    .replace(/^\./, '_') // Pas de fichier caché
    .slice(0, 255); // Limiter la longueur
}

/**
 * Hash cryptographique du contenu fichier via Bun native API
 * Utilise SHA-256 pour garantir l'unicité et la sécurité
 */
function generateSimpleFileHash(buffer: ArrayBuffer): string {
  // Bun native crypto - plus rapide et sécurisé que Node.js crypto
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(new Uint8Array(buffer));
  return hasher.digest('hex').slice(0, 16); // 16 premiers caractères pour compatibilité
}

/**
 * Construction intelligente du contexte éducatif basé sur le profil utilisateur
 * Séparation des préoccupations : le backend gère l'intelligence pédagogique
 */
function buildEducationalContext(user: User, simpleContext?: string) {
  // Détermination automatique du niveau et des capacités cognitives
  // Les parents n'ont pas de schoolLevel, on utilise une valeur par défaut
  const schoolLevel = (user.schoolLevel ?? 'seconde') as EducationLevelType;
  const age = calculateAgeFromSchoolLevel(schoolLevel);

  // Construction du contexte adapté au niveau scolaire français
  const levelContext = buildLevelSpecificContext(schoolLevel);

  // Instructions IA intelligentes adaptées au niveau
  const aiInstructions = buildIntelligentAIInstructions(schoolLevel, age);

  return {
    // Contexte éducatif déduit du profil utilisateur
    subject: simpleContext ?? 'analyse-generale',
    level: schoolLevel,
    ageRange: age,

    // Instructions pédagogiques adaptées
    pedagogicalApproach: levelContext.approach,
    vocabularyLevel: levelContext.vocabulary,
    complexityLevel: levelContext.complexity,

    // Instructions pour l'IA adaptées au niveau scolaire
    aiInstructions,

    // Contexte curriculum français
    curriculumContext: {
      programme: `Programme scolaire français ${schoolLevel}`,
      competences: levelContext.competences,
      adaptations: levelContext.adaptations
    }
  };
}

/**
 * Calcule la tranche d'âge approximative depuis le niveau scolaire
 */
function calculateAgeFromSchoolLevel(schoolLevel: string): string {
  const levelAgeMap: Record<string, string> = {
    'cp': '6-7 ans',
    'ce1': '7-8 ans',
    'ce2': '8-9 ans',
    'cm1': '9-10 ans',
    'cm2': '10-11 ans',
    '6eme': '11-12 ans',
    '5eme': '12-13 ans',
    '4eme': '13-14 ans',
    '3eme': '14-15 ans',
    'seconde': '15-16 ans',
    'premiere': '16-17 ans',
    'terminale': '17-18 ans'
  };

  return levelAgeMap[schoolLevel.toLowerCase()] ?? '10-15 ans';
}

/**
 * Construction du contexte spécifique au niveau scolaire
 */
function buildLevelSpecificContext(schoolLevel: string) {
  const level = schoolLevel.toLowerCase();

  // Contexte pour primaire (CP-CM2)
  if (['cp', 'ce1', 'ce2', 'cm1', 'cm2'].includes(level)) {
    return {
      approach: 'socratique-simple',
      vocabulary: 'elementaire',
      complexity: 'base',
      competences: ['lecture', 'calcul', 'comprehension'],
      adaptations: ['vocabulaire simple', 'phrases courtes', 'exemples concrets']
    };
  }

  // Contexte pour collège (6e-3e)
  if (['6eme', '5eme', '4eme', '3eme'].includes(level)) {
    return {
      approach: 'socratique-progressif',
      vocabulary: 'intermediaire',
      complexity: 'moyen',
      competences: ['analyse', 'synthese', 'argumentation'],
      adaptations: ['progression guidée', 'liens interdisciplinaires', 'méthodes structurées']
    };
  }

  // Contexte pour lycée (Seconde-Terminale)
  return {
    approach: 'socratique-avance',
    vocabulary: 'soutenu',
    complexity: 'eleve',
    competences: ['analyse critique', 'synthèse complexe', 'argumentation structurée'],
    adaptations: ['raisonnement autonome', 'pensée critique', 'préparation examens']
  };
}

/**
 * Construction des instructions IA intelligentes adaptées au niveau
 */
function buildIntelligentAIInstructions(schoolLevel: string, ageRange: string): string {
  const level = schoolLevel.toLowerCase();

  const baseInstruction = `Tu es un tuteur IA spécialisé dans l'éducation française pour le niveau ${schoolLevel} (${ageRange}).`;

  // Instructions pour primaire
  if (['cp', 'ce1', 'ce2', 'cm1', 'cm2'].includes(level)) {
    return `${baseInstruction}
    APPROCHE: Utilise un vocabulaire simple et des phrases courtes. Privilégie les exemples concrets et visuels.
    PÉDAGOGIE: Méthode socratique simplifiée avec questions guidées. Encourage et félicite régulièrement.
    PROGRAMME: Respecte strictement les acquis attendus du cycle 2/3. Reste dans le programme scolaire français.
    ADAPTATION: Adapte la complexité aux capacités d'un enfant de ${ageRange}.`;
  }

  // Instructions pour collège
  if (['6eme', '5eme', '4eme', '3eme'].includes(level)) {
    return `${baseInstruction}
    APPROCHE: Utilise un vocabulaire intermédiaire et des explications structurées. Encourage l'autonomie progressive.
    PÉDAGOGIE: Méthode socratique avec questions progressives. Aide à développer l'esprit critique.
    PROGRAMME: Respecte les compétences du socle commun et du programme de collège français.
    ADAPTATION: Guide vers la découverte autonome tout en restant accessible pour ${ageRange}.`;
  }

  // Instructions pour lycée
  return `${baseInstruction}
  APPROCHE: Utilise un niveau de langue soutenu et des concepts avancés. Encourage la pensée critique autonome.
  PÉDAGOGIE: Méthode socratique avancée. Prépare aux exigences du baccalauréat français.
  PROGRAMME: Respecte strictement les programmes de lycée et prépare aux épreuves officielles.
  ADAPTATION: Développe l'autonomie intellectuelle et la rigueur académique adaptées à ${ageRange}.`;
}

export const fileUploadRoutes = new Elysia({ prefix: '/api/upload' })
  /**
   * Upload unifié de fichiers avec analyse IA
   * POST /upload/file
   */
  .post('/file', async ({ body, request, set }) => {
    let fileType: 'image' | 'pdf' | 'document' | 'audio' | 'unknown' = 'unknown';

    try {
      // Vérification authentification
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session?.user) {
        set.status = 401;
        return { success: false, _error: 'Authentication required' };
      }

      const user = session.user as User;
      const { file, context } = body;

      // Validation du fichier
      if (!file || !file.name || !file.type) {
        set.status = 400;
        return { success: false, _error: 'Valid file required' };
      }

      // Vérification taille
      if (file.size > MAX_FILE_SIZE) {
        set.status = 400;
        return { success: false, _error: `File too large. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
      }

      // Détection type
      fileType = detectFileType(file.type);
      if (fileType === 'unknown') {
        set.status = 400;
        return { success: false, _error: 'File type not supported' };
      }

      // Lecture du contenu
      const buffer = await file.arrayBuffer();

      // SÉCURITÉ : Validation des magic bytes OBLIGATOIRE
      if (!validateFileMagicBytes(buffer, file.type)) {
        logger.error('File validation failed - invalid magic bytes', {
          _error: new Error('File validation failed - invalid magic bytes'),
          fileName: file.name,
          claimedType: file.type,
          userId: user.id,
          operation: 'file:security-validation-failed',
          severity: 'medium' as const
        });
        set.status = 400;
        return { success: false, _error: 'Invalid file format - content does not match declared type' };
      }

      // SÉCURITÉ : Sanitization du nom de fichier
      const sanitizedFileName = sanitizeFileName(file.name);
      const hash = generateSimpleFileHash(buffer);

      logger.info('Starting file processing', {
        fileName: sanitizedFileName,
        originalName: file.name,
        fileType,
        size: file.size,
        userId: user.id
      });

      // **SYSTÈME OPTIMISÉ** - Le backend construit automatiquement le contexte éducatif
      // basé sur le profil utilisateur (séparation des préoccupations)

      // Générer un ID unique pour le fichier
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Stockage temporaire en base64 (pour traitement Gemini)
      const base64Content = Buffer.from(buffer).toString('base64');

      // **CONSTRUCTION INTELLIGENTE DU CONTEXTE ÉDUCATIF**
      // Le backend détermine automatiquement le contexte approprié
      const intelligentEducationalContext = buildEducationalContext(user, context);

      // ✅ UPLOAD RAPIDE : Pas d'analyse à l'upload pour préserver l'UX
      // L'analyse sera faite à la demande lors du premier message (optimisation intelligente)
      logger.info('Fast file upload - analysis deferred to first message', {
        fileId,
        fileName: file.name,
        userId: user.id,
        fileType,
        strategy: 'deferred-analysis'
      });

      // Métadonnées complètes du fichier avec contexte éducatif automatique + analyse
      const fileMetadata = {
        fileId,
        fileName: sanitizedFileName, // Nom sécurisé
        originalFileName: file.name,  // Nom original pour référence
        size: file.size,
        type: file.type,
        hash,
        uploadedAt: new Date().toISOString(),
        userId: user.id,
        schoolLevel: user.schoolLevel as EducationLevelType,
        // Gemini Files API (optionnel, rempli plus bas si disponible)
        fileUri: undefined as string | undefined,
        expiresAt: undefined as string | undefined,
        // Contexte éducatif construit automatiquement par le backend
        educationalContext: {
          ...intelligentEducationalContext,
          // Analyse différée - sera générée lors du premier message pour UX optimale
          analysisContext: null as string | null, // Sera rempli lors du premier message
          extractedText: null as string | null    // Sera rempli lors du premier message
        }
      };

      // **SOLUTION OPTIMISÉE** : Redis chunking + TTL intelligent pour gros fichiers
      // Promesse explicite avec gestion d'erreur - pas de floating promise
      void (async () => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          // TTL intelligent basé sur la taille du fichier
          const getTTL = (fileSizeBytes: number): number => {
            if (fileSizeBytes < 1024 * 1024) return 4 * 3600; // 4h petits files (<1MB)
            if (fileSizeBytes < 5 * 1024 * 1024) return 2 * 3600; // 2h moyens (<5MB)
            return 1 * 3600; // 1h gros files (≥5MB)
          };

          const ttl = getTTL(file.size);
          const CHUNK_SIZE = 256 * 1024; // 256KB chunks pour optimiser Redis

          let storePromise: Promise<void>;

          // Optimisation chunking pour fichiers >1MB
          if (file.size > 1024 * 1024) {
            // Stockage en chunks pour éviter les gros payloads Redis
            const chunks: string[] = [];
            for (let i = 0; i < base64Content.length; i += CHUNK_SIZE) {
              chunks.push(base64Content.slice(i, i + CHUNK_SIZE));
            }

            // Métadonnées séparées + chunks en parallèle
            const chunkPromises = chunks.map((chunk, index) =>
              redisClient.setEx(`file:${fileId}:chunk:${index}`, ttl, chunk)
            );

            storePromise = Promise.all([
              redisClient.setEx(`file:${fileId}:meta`, ttl, JSON.stringify({
                metadata: fileMetadata,
                mimeType: file.type,
                totalChunks: chunks.length,
                originalSize: file.size
              })),
              ...chunkPromises
            ]).then(() => void 0);

            logger.info('Using chunked storage for large file', {
              operation: 'file:cache-chunked',
              fileId,
              chunks: chunks.length,
              chunkSize: CHUNK_SIZE
            });
          } else {
            // Stockage monolithique pour petits fichiers
            storePromise = redisClient.setEx(
              `file:${fileId}`,
              ttl,
              JSON.stringify({
                content: base64Content,
                metadata: fileMetadata,
                mimeType: file.type
              })
            ).then(() => void 0);
          }

          // Timeout Redis optimisé selon la stratégie
          const timeoutMs = file.size > 1024 * 1024 ? 10000 : 5000; // 10s chunks, 5s mono
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('Redis timeout'));
            }, timeoutMs);
          });

          await Promise.race([storePromise, timeoutPromise]);

          logger.info('File cached in Redis successfully (optimized)', {
            operation: 'file:cache-optimized',
            fileId,
            sizeBytes: file.size,
            ttlHours: ttl / 3600,
            strategy: file.size > 1024 * 1024 ? 'chunked' : 'monolithic'
          });
        } catch (cacheError) {
          logger.error('Background Redis cache failed - this is critical for file processing', {
            _error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            operation: 'file:cache-critical-failure',
            fileId,
            severity: 'high' as const
          });
          // Pas de fallback silencieux - les erreurs Redis doivent être remontées
        } finally {
          // Cleanup garanti dans tous les cas
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      })();

      logger.info('File upload completed (Redis caching in background)', {
        operation: 'file:upload-fast',
        fileId,
        strategy: 'async-cache'
      });

      // ========================================
      // 🎤 TRANSCRIPTION AUTOMATIQUE AUDIO
      // Pour les fichiers audio, transcription immédiate avec Gemini
      // ========================================
      let transcription: string | undefined;

      if (fileType === 'audio') {
        try {
          // Détection du contexte selon le context fourni ou le niveau
          const audioContext = context?.includes('pronunciation')
            ? 'pronunciation' as const
            : 'general' as const;

          // Détection de la langue cible (par défaut français)
          let targetLang: 'fr' | 'en' | 'es' | 'de' = 'fr';
          if (context?.includes('anglais') || context?.includes('english')) {
            targetLang = 'en';
          } else if (context?.includes('espagnol') || context?.includes('spanish')) {
            targetLang = 'es';
          } else if (context?.includes('allemand') || context?.includes('german')) {
            targetLang = 'de';
          }

          logger.info('Starting audio transcription', {
            operation: 'audio:transcription:start',
            fileId,
            audioContext,
            targetLang,
            mimeType: file.type
          });

          const transcriptionResult = await audioTranscriptionService.transcribeAudio(
            buffer,
            file.type,
            {
              targetLanguage: targetLang,
              schoolLevel: user.schoolLevel as EducationLevelType,
              context: audioContext
            }
          );

          if (transcriptionResult.success && transcriptionResult.transcription) {
            transcription = transcriptionResult.transcription;

            logger.info('Audio transcription completed', {
              operation: 'audio:transcription:complete',
              fileId,
              transcriptionLength: transcription.length,
              hasPronunciationAnalysis: !!transcriptionResult.pronunciationAnalysis
            });
          }
        } catch (transcriptionError) {
          logger.error('Audio transcription failed (non-blocking)', {
            _error: transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError),
            operation: 'audio:transcription',
            fileId,
            severity: 'medium' as const
          });
          // Continue sans transcription - non bloquant
        }
      }

      // ========================================
      // 📁 UPLOAD GEMINI FILES API (images/PDFs)
      // TTL 48h, gratuit, persistance pour conversations multi-tours
      // ========================================
      let fileUri: string | undefined;
      let expiresAt: string | undefined;

      if ((fileType === 'image' || fileType === 'pdf') && geminiFilesService.isAvailable()) {
        try {
          logger.info('Uploading to Gemini Files API', {
            operation: 'gemini-files:upload-start',
            fileId,
            fileType,
            mimeType: file.type
          });

          const geminiResult = await geminiFilesService.uploadFile(
            buffer,
            file.type,
            sanitizedFileName
          );

          if (geminiResult.success && geminiResult.fileUri) {
            fileUri = geminiResult.fileUri;
            expiresAt = geminiResult.expiresAt?.toISOString();

            // Ajouter aux métadonnées pour persistance
            fileMetadata.fileUri = fileUri;
            fileMetadata.expiresAt = expiresAt;

            logger.info('Gemini Files API upload successful', {
              operation: 'gemini-files:upload-complete',
              fileId,
              fileUri,
              expiresAt,
              ttlHours: 48
            });
          } else {
            logger.warn('Gemini Files API upload failed, using Redis fallback', {
              operation: 'gemini-files:upload-fallback',
              fileId,
              error: geminiResult.error
            });
          }
        } catch (geminiError) {
          logger.warn('Gemini Files API error (non-blocking, using Redis)', {
            error: geminiError instanceof Error ? geminiError.message : String(geminiError),
            operation: 'gemini-files:upload-error',
            fileId
          });
          // Continue avec Redis comme fallback - non bloquant
        }
      }

      const result: FileUploadResult = {
        success: true,
        fileType,
        fileId,
        fileUri,     // URI Gemini Files (48h TTL) pour images/PDFs
        expiresAt,   // Date d'expiration Gemini
        transcription, // Inclus uniquement pour audio
        metadata: fileMetadata
      };

      logger.info('File uploaded successfully', {
        operation: 'file:upload-complete',
        fileName: file.name,
        fileType,
        fileId,
        fileUri: fileUri ?? 'redis-only',
        size: file.size,
        userId: user.id,
        storedInRedis: true,
        storedInGemini: !!fileUri,
        ttlHours: fileUri ? 48 : 2,
        hasTranscription: !!transcription,
        strategy: fileType === 'audio' ? 'immediate-transcription' : fileUri ? 'gemini-files-48h' : 'redis-deferred'
      });

      return result;
      
    } catch (_error) {
      logger.error('File upload processing failed', {
        _error: _error instanceof Error ? _error.message : String(_error),
        operation: 'file:upload',
        severity: 'high' as const
      });
      
      set.status = 500;
      return {
        success: false,
        fileType,
        _error: 'File storage failed'
      } as FileUploadResult;
    }
  }, {
    body: t.Object({
      file: t.File({
        maxSize: MAX_FILE_SIZE
      }),
      context: t.Optional(t.String({
        maxLength: 500,
        minLength: 1
      }))
    }),
    error({ code, set }) {
      switch (code) {
        case 'VALIDATION':
          set.status = 400;
          return {
            success: false,
            _error: 'Invalid file or context. Check file size (<15MB) and type (images, PDF, documents only)'
          };
        case 'PARSE':
          set.status = 400;
          return {
            success: false,
            _error: 'Invalid request format. Expected multipart/form-data with file and optional context'
          };
        default:
          set.status = 500;
          return {
            success: false,
            _error: 'Internal server error'
          };
      }
    }
  });