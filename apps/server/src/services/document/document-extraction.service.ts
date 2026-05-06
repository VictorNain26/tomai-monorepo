/**
 * Document Extraction Service - Extraction texte unifiée
 *
 * Responsabilités:
 * - Extraction PDF via unpdf (pure JS, serverless-compatible)
 * - Fallback Mistral OCR pour PDFs scannés (manuels, devoirs photographiés)
 *   quand unpdf ne récupère pas de texte natif
 * - Extraction DOCX via mammoth
 * - Extraction texte brut
 * - OCR images via Mistral Vision (délégué à document-analysis)
 *
 * Architecture 2025: Separation of concerns
 * - Ce service extrait le TEXTE uniquement
 * - L'analyse IA est déléguée à d'autres services
 */

import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { logger } from '../../lib/observability.js';
import { extractPdfWithMistralOCR } from './mistral-ocr.js';
import type { ExtractionResult } from './document-types.js';

export type { ExtractionResult } from './document-types.js';

/** Threshold below which unpdf output is considered a scanned-PDF miss. */
const NATIVE_TEXT_MIN_CHARS = 10;

/**
 * Service d'extraction de texte depuis documents
 */
class DocumentExtractionService {
  /**
   * Extrait le texte d'un document selon son type MIME
   */
  async extractText(
    buffer: ArrayBuffer,
    mimeType: string,
    fileName: string
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const cleanMimeType = mimeType.split(';')[0]?.trim() ?? '';

    try {
      // PDF
      if (cleanMimeType === 'application/pdf') {
        return await this.extractFromPDF(buffer, startTime);
      }

      // DOCX
      if (cleanMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractFromDOCX(buffer, startTime);
      }

      // DOC (ancien format Word) - limité
      if (cleanMimeType === 'application/msword') {
        return this.createResult(
          false,
          '',
          'text',
          startTime,
          'Format .doc non supporté. Veuillez convertir en .docx ou .pdf'
        );
      }

      // Texte brut
      if (cleanMimeType === 'text/plain') {
        return await this.extractFromText(buffer, startTime);
      }

      // Images : marqueur pour traitement Mistral Vision côté analyse
      if (cleanMimeType.startsWith('image/')) {
        return this.createResult(
          true,
          '[IMAGE_REQUIRES_VISION_API]',
          'mistral-vision',
          startTime
        );
      }

      // Type non supporté
      return this.createResult(
        false,
        '',
        'text',
        startTime,
        `Type de fichier non supporté: ${cleanMimeType}`
      );

    } catch (error) {
      logger.error('Document extraction failed', {
        _error: error instanceof Error ? error.message : String(error),
        mimeType: cleanMimeType,
        fileName,
        operation: 'document-extraction',
        severity: 'medium' as const
      });

      return this.createResult(
        false,
        '',
        'text',
        startTime,
        error instanceof Error ? error.message : 'Extraction failed'
      );
    }
  }

  /**
   * Extraction PDF via unpdf (pure JS, serverless-compatible).
   * Falls back to `mistral-ocr-latest` when unpdf produces empty output —
   * typical case: scanned manuals or devoirs photographed by students.
   * @see https://github.com/unjs/unpdf
   */
  private async extractFromPDF(
    buffer: ArrayBuffer,
    startTime: number
  ): Promise<ExtractionResult> {
    let unpdfPageCount: number | undefined;
    try {
      // unpdf API: getDocumentProxy + extractText
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      unpdfPageCount = totalPages;

      const extractedText = (text as string)?.trim() ?? '';
      const wordCount = this.countWords(extractedText);

      if (extractedText.length >= NATIVE_TEXT_MIN_CHARS) {
        logger.info('PDF extraction completed (native text)', {
          pageCount: totalPages,
          wordCount,
          textLength: extractedText.length,
          operation: 'pdf-extraction'
        });
        return {
          success: true,
          text: extractedText,
          metadata: {
            pageCount: totalPages,
            wordCount,
            extractionMethod: 'unpdf',
            extractionTimeMs: Date.now() - startTime
          }
        };
      }

      logger.info('PDF has no native text, falling back to Mistral OCR', {
        pageCount: totalPages,
        operation: 'pdf-extraction:ocr-fallback'
      });
    } catch (error) {
      logger.warn('unpdf failed, falling back to Mistral OCR', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'pdf-extraction:unpdf-error'
      });
    }

    return extractPdfWithMistralOCR(buffer, startTime, unpdfPageCount);
  }

  /**
   * Extraction DOCX via mammoth
   */
  private async extractFromDOCX(
    buffer: ArrayBuffer,
    startTime: number
  ): Promise<ExtractionResult> {
    try {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer)
      });

      const text = result.value?.trim() ?? '';
      const wordCount = this.countWords(text);

      // Log warnings si présents
      if (result.messages.length > 0) {
        logger.warn('DOCX extraction warnings', {
          warnings: result.messages.map(m => m.message),
          operation: 'docx-extraction'
        });
      }

      logger.info('DOCX extraction completed', {
        wordCount,
        textLength: text.length,
        warningsCount: result.messages.length,
        operation: 'docx-extraction'
      });

      if (!text || text.length < 10) {
        return this.createResult(
          false,
          '',
          'mammoth',
          startTime,
          'Document Word vide ou sans contenu texte'
        );
      }

      return {
        success: true,
        text,
        metadata: {
          wordCount,
          extractionMethod: 'mammoth',
          extractionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      logger.error('DOCX extraction error', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'docx-extraction',
        severity: 'medium' as const
      });

      return this.createResult(
        false,
        '',
        'mammoth',
        startTime,
        'Erreur lors de l\'extraction du document Word'
      );
    }
  }

  /**
   * Extraction texte brut
   */
  private async extractFromText(
    buffer: ArrayBuffer,
    startTime: number
  ): Promise<ExtractionResult> {
    try {
      const text = Buffer.from(buffer).toString('utf8').trim();
      const wordCount = this.countWords(text);

      if (!text || text.length < 1) {
        return this.createResult(
          false,
          '',
          'text',
          startTime,
          'Fichier texte vide'
        );
      }

      return {
        success: true,
        text,
        metadata: {
          wordCount,
          extractionMethod: 'text',
          extractionTimeMs: Date.now() - startTime
        }
      };

    } catch {
      return this.createResult(
        false,
        '',
        'text',
        startTime,
        'Erreur lors de la lecture du fichier texte'
      );
    }
  }

  /**
   * Helper pour créer un résultat d'extraction
   */
  private createResult(
    success: boolean,
    text: string,
    method: ExtractionResult['metadata']['extractionMethod'],
    startTime: number,
    error?: string
  ): ExtractionResult {
    return {
      success,
      text,
      metadata: {
        wordCount: this.countWords(text),
        extractionMethod: method,
        extractionTimeMs: Date.now() - startTime
      },
      error
    };
  }

  /**
   * Compte les mots dans un texte
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }
}

// Singleton export
export const documentExtractionService = new DocumentExtractionService();
