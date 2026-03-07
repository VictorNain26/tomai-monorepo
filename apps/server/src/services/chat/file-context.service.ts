import { filesRepository, sessionFilesRepository } from '../../db/repositories/index.js';
import { scalewayStorageService } from '../storage/scaleway-storage.service.js';
import { documentAnalysisService, type DocumentAnalysisResult } from '../document/index.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type { AttachedFileInfo, FileAnalysisResult, FileAnalysisOptions, MultimodalFile } from './file-context-types.js';
import { prepareMultimodalFiles, updateFileAnalysis } from './file-multimodal.service.js';

export type { AttachedFileInfo, FileAnalysisResult, FileAnalysisOptions, MultimodalFile } from './file-context-types.js';

class FileContextService {
  /**
   * Récupère les métadonnées d'un fichier depuis PostgreSQL
   */
  async retrieveFileMetadata(fileId: string): Promise<AttachedFileInfo | null> {
    try {
      const file = await filesRepository.findById(fileId);
      if (!file) {
        logger.warn('File not found in DB', { fileId, operation: 'retrieve-file-metadata' });
        return null;
      }

      // Vérifier si le fileUri Gemini est encore valide (TTL 48h)
      let geminiFileId = file.geminiFileUri ?? undefined;
      if (geminiFileId && file.geminiExpiresAt) {
        if (file.geminiExpiresAt <= new Date()) {
          logger.info('Gemini file URI expired', {
            fileId,
            expiredAt: file.geminiExpiresAt.toISOString(),
            operation: 'retrieve-file-metadata'
          });
          geminiFileId = undefined;
        }
      }

      return {
        fileName: file.fileName,
        fileId: file.id,
        geminiFileId,
        mimeType: file.mimeType,
        fileSizeBytes: file.sizeBytes
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
   * Récupère le contexte de tous les fichiers attachés à une session
   * Lit depuis la table session_files (classeur) au lieu de scanner l'historique
   */
  async getSessionFilesContext(sessionId: string): Promise<string> {
    try {
      const attachedFiles = await sessionFilesRepository.findBySessionWithContext(sessionId);

      if (attachedFiles.length === 0) {
        return '';
      }

      logger.info('Found attached files for session', {
        filesCount: attachedFiles.length,
        fileNames: attachedFiles.map(f => f.fileName),
        operation: 'get-session-files-context'
      });

      const validContexts = attachedFiles
        .map(f => {
          const eduContext = f.educationalContext as {
            analysisContext?: string;
            documentType?: string;
            subject?: string;
          } | null;

          if (!eduContext?.analysisContext) return null;

          return {
            fileName: f.fileName,
            context: eduContext.analysisContext,
            documentType: eduContext.documentType,
            subject: eduContext.subject,
          };
        })
        .filter((ctx): ctx is NonNullable<typeof ctx> => ctx !== null);

      if (validContexts.length > 0) {
        return validContexts
          .map(ctx => {
            const typeInfo = ctx.documentType && ctx.subject
              ? ` (${ctx.documentType} - ${ctx.subject})`
              : '';
            return `\n\nCONTEXTE DU FICHIER "${ctx.fileName}"${typeInfo}:\n${ctx.context}`;
          })
          .join('');
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
   * Analyse un fichier avec le pipeline complet
   */
  async analyzeFileWithCache(
    fileId: string,
    options: FileAnalysisOptions
  ): Promise<FileAnalysisResult | null> {
    try {
      const { content: userQuestion, schoolLevel, userId } = options;

      const file = await filesRepository.findById(fileId);
      if (!file) {
        logger.warn('File not found in DB', { fileId, operation: 'analyze-file' });
        return null;
      }

      const eduContext = file.educationalContext as {
        analysisContext?: string;
        extractedText?: string;
        documentType?: string;
        subject?: string;
        hadRAG?: boolean;
      } | null;

      // Utiliser l'analyse en cache si disponible
      if (eduContext?.analysisContext && !userQuestion) {
        return {
          analysis: eduContext.analysisContext,
          extractedText: eduContext.extractedText,
          fileName: file.fileName,
          documentType: eduContext.documentType,
          subject: eduContext.subject,
          hadRAG: eduContext.hadRAG
        };
      }

      // Enrichir avec question spécifique
      if (userQuestion && eduContext?.analysisContext) {
        const contextualAnalysis = `ANALYSE DU DOCUMENT (${eduContext.documentType ?? 'document'} - ${eduContext.subject ?? 'matière non identifiée'}):
${eduContext.analysisContext}

QUESTION DE L'ÉLÈVE: ${userQuestion}

RÉPONSE CONTEXTUALISÉE: Basé sur l'analyse du document ci-dessus, voici la réponse adaptée à votre question.`;

        return {
          analysis: contextualAnalysis,
          extractedText: eduContext.extractedText,
          fileName: file.fileName,
          documentType: eduContext.documentType,
          subject: eduContext.subject,
          hadRAG: eduContext.hadRAG
        };
      }

      // Analyse complète nécessaire
      logger.info('No cached analysis, running full pipeline', {
        fileId,
        fileName: file.fileName,
        operation: 'analyze-file-pipeline'
      });

      // Récupérer le contenu depuis Scaleway
      const fileContent = await scalewayStorageService.getFileContent(file.storageKey);
      if (!fileContent) {
        logger.error('Failed to retrieve file from storage', {
          _error: 'Storage returned null',
          fileId,
          storageKey: file.storageKey,
          operation: 'analyze-file',
          severity: 'medium' as const
        });
        return null;
      }

      const isImage = file.mimeType.startsWith('image/');

      let analysisResult: DocumentAnalysisResult;

      if (isImage) {
        const base64 = fileContent.content.toString('base64');
        analysisResult = await documentAnalysisService.analyzeImage(
          base64,
          file.mimeType,
          file.fileName,
          { schoolLevel, userId, userQuestion }
        );
      } else {
        analysisResult = await documentAnalysisService.analyzeDocument(
          fileContent.content.buffer as ArrayBuffer,
          file.fileName,
          file.mimeType,
          { schoolLevel, userId, userQuestion }
        );
      }

      if (analysisResult.success) {
        await updateFileAnalysis(file.id, analysisResult);

        return {
          analysis: analysisResult.analysis,
          extractedText: analysisResult.extraction.text,
          fileName: file.fileName,
          documentType: analysisResult.classification.documentType,
          subject: analysisResult.classification.subject,
          hadRAG: !!analysisResult.rag?.found
        };
      }

      return null;
    } catch (error) {
      logger.error('File analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileId,
        operation: 'analyze-file',
        severity: 'medium' as const
      });
      return null;
    }
  }

  /**
   * Prépare le contexte complet des fichiers pour une requête chat
   */
  async prepareFileContext(params: {
    fileIds: string[];
    content: string;
    schoolLevel: EducationLevelType;
    userId: string;
    sessionId: string;
  }): Promise<{
    attachedFileInfos: AttachedFileInfo[];
    enrichedContent: string;
    sessionFilesContext: string;
  }> {
    const { fileIds, content, schoolLevel, userId, sessionId } = params;

    const [fileMetadatas, sessionFilesContext] = await Promise.all([
      Promise.all(fileIds.map(id => this.retrieveFileMetadata(id))),
      this.getSessionFilesContext(sessionId)
    ]);

    const attachedFileInfos = fileMetadatas.filter(
      (info): info is AttachedFileInfo => info !== null
    );

    // Analyze all files (sequentially to avoid rate limits)
    const analysisResults: (FileAnalysisResult | null)[] = [];
    for (const fileId of fileIds) {
      const result = await this.analyzeFileWithCache(fileId, { content, schoolLevel, userId });
      analysisResults.push(result);
    }

    let enrichedContent = content;

    // Concatenate all file enrichments
    for (let i = 0; i < analysisResults.length; i++) {
      const result = analysisResults[i];
      if (!result?.analysis) continue;

      const fileName = attachedFileInfos[i]?.fileName ?? 'document';
      const fileHeader = result.documentType && result.subject
        ? `[Fichier joint - ${fileName} | ${result.documentType} - ${result.subject}]`
        : `[Fichier joint - ${fileName}]`;

      enrichedContent = `${fileHeader}\n${result.analysis}\n\n${enrichedContent}`;
    }

    if (sessionFilesContext) {
      enrichedContent = `${sessionFilesContext}\n\n${enrichedContent}`;
    }

    return {
      attachedFileInfos,
      enrichedContent,
      sessionFilesContext
    };
  }

  async prepareMultimodalFiles(fileIds: string[]): Promise<MultimodalFile[]> {
    return prepareMultimodalFiles(fileIds);
  }
}

export const fileContextService = new FileContextService();
