/**
 * Service de gestion du contexte des fichiers pour le chat
 *
 * Architecture 2025:
 * - Utilise DocumentAnalysisService pour analyse complète (extraction + classification + RAG)
 * - Cache intelligent Redis avec TTL adaptatif
 * - Support fichiers chunked (>1MB) et monolithiques
 */

import { redis as redisClient } from '../../lib/redis.service.js';
import { documentAnalysisService, type DocumentAnalysisResult } from '../document/index.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type { Message as DbMessage } from '../../db/schema.js';

/**
 * Informations sur un fichier attaché
 */
export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  geminiFileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

/**
 * Résultat d'analyse de fichier (enrichi avec nouvelle architecture)
 */
export interface FileAnalysisResult {
  analysis: string;
  extractedText?: string;
  fileName: string;
  // Nouvelles métadonnées
  documentType?: string;
  subject?: string;
  hadRAG?: boolean;
}

/**
 * Options pour analyse de fichier
 */
export interface FileAnalysisOptions {
  content?: string; // Question de l'élève
  schoolLevel: EducationLevelType;
  userId: string;
}

/**
 * Données de fichier stockées en Redis
 */
interface StoredFileData {
  content?: string; // Base64 (fichiers monolithiques)
  metadata: {
    fileId: string;
    fileName: string;
    originalFileName?: string;
    size: number;
    type: string;
    uploadedAt: string;
    userId: string;
    schoolLevel?: EducationLevelType;
    educationalContext?: {
      analysisContext?: string;
      extractedText?: string;
      documentType?: string;
      subject?: string;
      hadRAG?: boolean;
      classification?: {
        documentType: string;
        subject: string;
        confidence: string;
        needsRAG: boolean;
        description: string;
      };
      ragContext?: string;
      metrics?: {
        totalTimeMs: number;
        extractionTimeMs: number;
        analysisTimeMs: number;
        tokensUsed?: number;
      };
    };
  };
  mimeType: string;
  // Pour fichiers chunked
  totalChunks?: number;
  originalSize?: number;
}

/**
 * Service de gestion du contexte des fichiers
 */
class FileContextService {
  /**
   * Récupère les métadonnées d'un fichier depuis Redis
   */
  async retrieveFileMetadata(fileId: string): Promise<AttachedFileInfo | null> {
    try {
      const fileData = await this.getStoredFileData(fileId);
      if (!fileData) {
        logger.warn('File not found in Redis', { fileId, operation: 'retrieve-file-metadata' });
        return null;
      }

      return {
        fileName: fileData.metadata.fileName,
        fileId: fileId,
        mimeType: fileData.mimeType,
        fileSizeBytes: fileData.metadata.size
      };
    } catch (error) {
      logger.warn('Failed to retrieve file metadata', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'retrieve-file-metadata'
      });
      return null;
    }
  }

  /**
   * Récupère le contexte de tous les fichiers d'une session
   */
  async getSessionFilesContext(sessionHistory: DbMessage[]): Promise<string> {
    try {
      // Extraire les fichiers attachés de l'historique
      const filesInSession = sessionHistory
        .filter((msg): msg is DbMessage & { attachedFile: AttachedFileInfo } =>
          msg.attachedFile !== null && typeof msg.attachedFile === 'object')
        .map(msg => msg.attachedFile as AttachedFileInfo);

      if (filesInSession.length === 0) {
        return '';
      }

      logger.info('Found files in session history', {
        filesCount: filesInSession.length,
        fileNames: filesInSession.map(f => f.fileName),
        operation: 'get-session-files-context'
      });

      // Récupération parallèle des contextes de fichiers
      const filePromises = filesInSession
        .filter((fileInfo): fileInfo is AttachedFileInfo & { fileId: string } =>
          'fileId' in fileInfo && typeof fileInfo.fileId === 'string')
        .map(async (fileInfo) => {
          try {
            const fileData = await this.getStoredFileData(fileInfo.fileId);
            if (fileData?.metadata?.educationalContext?.analysisContext) {
              return {
                fileName: fileInfo.fileName,
                context: fileData.metadata.educationalContext.analysisContext,
                documentType: fileData.metadata.educationalContext.documentType,
                subject: fileData.metadata.educationalContext.subject
              };
            }
            return null;
          } catch (error) {
            logger.warn('Failed to retrieve session file context', {
              fileId: fileInfo.fileId,
              fileName: fileInfo.fileName,
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          }
        });

      const fileContexts = await Promise.all(filePromises);
      const validContexts = fileContexts.filter((ctx): ctx is NonNullable<typeof ctx> => ctx !== null);

      if (validContexts.length > 0) {
        const context = validContexts
          .map(ctx => {
            const typeInfo = ctx.documentType && ctx.subject
              ? ` (${ctx.documentType} - ${ctx.subject})`
              : '';
            return `\n\nCONTEXTE DU FICHIER "${ctx.fileName}"${typeInfo}:\n${ctx.context}`;
          })
          .join('');

        logger.info('Session file contexts retrieved', {
          totalFiles: filesInSession.length,
          validContexts: validContexts.length,
          contextLength: context.length,
          operation: 'get-session-files-context'
        });

        return context;
      }

      return '';
    } catch (error) {
      logger.error('Failed to get session files context', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'get-session-files-context',
        severity: 'medium' as const
      });
      return '';
    }
  }

  /**
   * Analyse un fichier avec le nouveau pipeline (extraction + classification + RAG)
   * Utilise le cache si disponible
   */
  async analyzeFileWithCache(
    fileId: string,
    options: FileAnalysisOptions
  ): Promise<FileAnalysisResult | null> {
    try {
      const { content: userQuestion, schoolLevel, userId } = options;

      logger.info('Starting file analysis', {
        fileId,
        userQuestion: userQuestion?.substring(0, 100),
        userId,
        operation: 'analyze-file-with-cache'
      });

      const fileData = await this.getStoredFileData(fileId);
      if (!fileData) {
        logger.warn('File not found in cache', { fileId, userId, operation: 'analyze-file-with-cache' });
        return null;
      }

      const { metadata, mimeType } = fileData;
      const educationalContext = metadata.educationalContext;

      // ✅ OPTIMISATION: Utiliser l'analyse en cache si disponible ET pas de question spécifique
      if (educationalContext?.analysisContext && !userQuestion) {
        logger.info('Using cached analysis', {
          fileId,
          fileName: metadata.fileName,
          cachedAnalysisLength: educationalContext.analysisContext.length,
          operation: 'analyze-file-cache-hit'
        });

        return {
          analysis: educationalContext.analysisContext,
          extractedText: educationalContext.extractedText,
          fileName: metadata.fileName,
          documentType: educationalContext.documentType,
          subject: educationalContext.subject,
          hadRAG: educationalContext.hadRAG
        };
      }

      // ✅ OPTIMISATION: Si question spécifique ET analyse générale disponible
      // On réutilise le contexte extrait pour enrichir la question
      if (userQuestion && educationalContext?.analysisContext) {
        const contextualAnalysis = `ANALYSE DU DOCUMENT (${educationalContext.documentType ?? 'document'} - ${educationalContext.subject ?? 'matière non identifiée'}):
${educationalContext.analysisContext}

QUESTION DE L'ÉLÈVE: ${userQuestion}

RÉPONSE CONTEXTUALISÉE: Basé sur l'analyse du document ci-dessus, voici la réponse adaptée à votre question.`;

        logger.info('Using cached analysis with specific question', {
          fileId,
          fileName: metadata.fileName,
          question: userQuestion.substring(0, 50),
          operation: 'analyze-file-cache-question'
        });

        return {
          analysis: contextualAnalysis,
          extractedText: educationalContext.extractedText,
          fileName: metadata.fileName,
          documentType: educationalContext.documentType,
          subject: educationalContext.subject,
          hadRAG: educationalContext.hadRAG
        };
      }

      // ❌ FALLBACK: Pas d'analyse en cache → analyse complète avec nouveau pipeline
      logger.info('No cached analysis, running full pipeline', {
        fileId,
        fileName: metadata.fileName,
        userId,
        operation: 'analyze-file-full-pipeline'
      });

      // Récupérer le contenu binaire du fichier
      const base64Content = await this.getFileContent(fileId, fileData);
      if (!base64Content) {
        logger.error('Failed to retrieve file content', {
          _error: 'Content retrieval returned null',
          fileId,
          operation: 'analyze-file-content',
          severity: 'medium' as const
        });
        return null;
      }

      const fileBuffer = Buffer.from(base64Content, 'base64');

      // Déterminer si c'est une image ou un document
      const isImage = mimeType.startsWith('image/');

      let analysisResult: DocumentAnalysisResult;

      if (isImage) {
        // Analyse image via Vision API + RAG
        analysisResult = await documentAnalysisService.analyzeImage(
          base64Content,
          mimeType,
          metadata.fileName,
          {
            schoolLevel,
            userId,
            userQuestion
          }
        );
      } else {
        // Analyse document (PDF, DOCX, TXT) via extraction + classification + RAG
        analysisResult = await documentAnalysisService.analyzeDocument(
          fileBuffer.buffer,
          metadata.fileName,
          mimeType,
          {
            schoolLevel,
            userId,
            userQuestion
          }
        );
      }

      if (analysisResult.success) {
        // ✅ CACHE UPDATE: Sauvegarder l'analyse enrichie pour les prochaines utilisations
        await this.updateFileCache(fileId, fileData, analysisResult);

        return {
          analysis: analysisResult.analysis,
          extractedText: analysisResult.extraction.text,
          fileName: metadata.fileName,
          documentType: analysisResult.classification.documentType,
          subject: analysisResult.classification.subject,
          hadRAG: !!analysisResult.rag?.found
        };
      }

      // Erreur d'analyse
      logger.error('Document analysis failed', {
        _error: analysisResult.error ?? 'Unknown analysis error',
        fileId,
        operation: 'analyze-file-pipeline-error',
        severity: 'medium' as const
      });

      return null;

    } catch (error) {
      logger.error('File analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileId,
        userId: options.userId,
        operation: 'analyze-file-with-cache',
        severity: 'medium' as const
      });
      return null;
    }
  }

  /**
   * Prépare le contexte complet des fichiers pour une requête chat
   * Helper consolidé pour éviter duplication entre /message et /stream (DRY)
   */
  async prepareFileContext(params: {
    fileId?: string;
    content: string;
    schoolLevel: EducationLevelType;
    userId: string;
    sessionHistory: DbMessage[];
  }): Promise<{
    attachedFileInfo: AttachedFileInfo | null;
    enrichedContent: string;
    sessionFilesContext: string;
  }> {
    const { fileId, content, schoolLevel, userId, sessionHistory } = params;

    // 1. Récupérer métadonnées fichier + contexte session en parallèle
    const [attachedFileInfo, sessionFilesContext] = await Promise.all([
      fileId ? this.retrieveFileMetadata(fileId) : Promise.resolve(null),
      this.getSessionFilesContext(sessionHistory)
    ]);

    // 2. Analyser fichier si présent (utilise cache ou nouveau pipeline)
    const fileAnalysisResult = fileId
      ? await this.analyzeFileWithCache(fileId, { content, schoolLevel, userId })
      : null;

    // 3. Enrichir le contenu avec le contexte fichier
    let enrichedContent = content;

    if (fileAnalysisResult?.analysis) {
      const fileHeader = fileAnalysisResult.documentType && fileAnalysisResult.subject
        ? `[Fichier joint - ${attachedFileInfo?.fileName ?? 'document'} | ${fileAnalysisResult.documentType} - ${fileAnalysisResult.subject}]`
        : `[Fichier joint - ${attachedFileInfo?.fileName ?? 'document'}]`;

      enrichedContent = `${fileHeader}\n${fileAnalysisResult.analysis}\n\n${enrichedContent}`;
    }

    if (sessionFilesContext) {
      enrichedContent = `${sessionFilesContext}\n\n${enrichedContent}`;
    }

    logger.info('File context prepared', {
      userId,
      hasFile: !!fileId,
      hasAnalysis: !!fileAnalysisResult,
      hadRAG: fileAnalysisResult?.hadRAG,
      sessionFilesCount: sessionHistory.filter(m => m.attachedFile).length,
      enrichedContentLength: enrichedContent.length,
      operation: 'prepare-file-context'
    });

    return {
      attachedFileInfo,
      enrichedContent,
      sessionFilesContext
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Récupère les données de fichier depuis Redis (gère chunked et monolithique)
   */
  private async getStoredFileData(fileId: string): Promise<StoredFileData | null> {
    // Essayer d'abord le format monolithique
    const monolithic = await redisClient.get(`file:${fileId}`);
    if (monolithic) {
      return JSON.parse(monolithic) as StoredFileData;
    }

    // Sinon essayer le format chunked (fichiers >1MB)
    const meta = await redisClient.get(`file:${fileId}:meta`);
    if (meta) {
      return JSON.parse(meta) as StoredFileData;
    }

    return null;
  }

  /**
   * Récupère le contenu binaire du fichier (reconstruit chunks si nécessaire)
   */
  private async getFileContent(fileId: string, fileData: StoredFileData): Promise<string | null> {
    // Format monolithique: contenu directement disponible
    if (fileData.content) {
      return fileData.content;
    }

    // Format chunked: reconstruire depuis les chunks
    if (fileData.totalChunks && fileData.totalChunks > 0) {
      try {
        const chunkPromises: Promise<string | null>[] = [];
        for (let i = 0; i < fileData.totalChunks; i++) {
          chunkPromises.push(redisClient.get(`file:${fileId}:chunk:${i}`));
        }

        const chunks = await Promise.all(chunkPromises);

        // Vérifier que tous les chunks sont présents
        if (chunks.some(c => c === null)) {
          logger.error('Missing chunks for file', {
            _error: 'Some file chunks are missing from Redis',
            fileId,
            totalChunks: fileData.totalChunks,
            missingChunks: chunks.reduce((acc, c, i) => c === null ? [...acc, i] : acc, [] as number[]),
            operation: 'get-file-content-chunks',
            severity: 'medium' as const
          });
          return null;
        }

        // Reconstruire le contenu
        return chunks.join('');

      } catch (error) {
        logger.error('Failed to reconstruct chunked file', {
          _error: error instanceof Error ? error.message : String(error),
          fileId,
          operation: 'get-file-content-chunks',
          severity: 'medium' as const
        });
        return null;
      }
    }

    logger.error('No content found for file', {
      _error: 'File has neither content nor chunks',
      fileId,
      operation: 'get-file-content',
      severity: 'medium' as const
    });
    return null;
  }

  /**
   * Met à jour le cache Redis avec les résultats d'analyse
   */
  private async updateFileCache(
    fileId: string,
    fileData: StoredFileData,
    analysisResult: DocumentAnalysisResult
  ): Promise<void> {
    try {
      const updatedFileData: StoredFileData = {
        ...fileData,
        metadata: {
          ...fileData.metadata,
          educationalContext: {
            analysisContext: analysisResult.analysis,
            extractedText: analysisResult.extraction.text,
            documentType: analysisResult.classification.documentType,
            subject: analysisResult.classification.subject,
            hadRAG: !!analysisResult.rag?.found,
            classification: analysisResult.classification,
            ragContext: analysisResult.rag?.context,
            metrics: analysisResult.metrics
          }
        }
      };

      // Déterminer la clé Redis (monolithique ou meta)
      const key = fileData.content ? `file:${fileId}` : `file:${fileId}:meta`;

      // TTL basé sur la taille originale
      const size = fileData.originalSize ?? fileData.metadata.size;
      const ttl = size < 1024 * 1024 ? 4 * 3600 : size < 5 * 1024 * 1024 ? 2 * 3600 : 3600;

      await redisClient.setEx(key, ttl, JSON.stringify(updatedFileData));

      logger.info('File cache updated with analysis', {
        fileId,
        fileName: fileData.metadata.fileName,
        documentType: analysisResult.classification.documentType,
        subject: analysisResult.classification.subject,
        hadRAG: !!analysisResult.rag?.found,
        totalTimeMs: analysisResult.metrics.totalTimeMs,
        operation: 'update-file-cache'
      });

    } catch (error) {
      logger.warn('Failed to update file cache', {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        operation: 'update-file-cache'
      });
    }
  }
}

// Instance singleton
export const fileContextService = new FileContextService();
