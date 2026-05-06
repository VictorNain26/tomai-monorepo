/**
 * Mistral OCR fallback for PDFs.
 *
 * Triggered by document-extraction.service when unpdf produces no native
 * text (scanned manuals, devoirs photographed by students). Uses
 * `mistral-ocr-latest` per the official cookbook flow:
 *
 *   1. files.upload (purpose: 'ocr') → fileId
 *   2. files.getSignedUrl(fileId)    → 1h-expiry HTTPS URL
 *   3. ocr.process({ documentUrl })  → markdown per page
 *   4. files.delete(fileId)          → best-effort cleanup
 *
 * Cost is bounded: this only runs when native extraction fails, so the
 * per-call cost (~0.001-0.005 €/page) is gated by actually-scanned PDFs.
 *
 * Lives outside document-extraction.service.ts to keep that file under
 * the 400-line constitution cap.
 */

import { getMistralClient } from '../../lib/mistral-client.js';
import { withTimeout } from '../../lib/retry.js';
import { logger } from '../../lib/observability.js';
import type { ExtractionResult } from './document-types.js';

const MISTRAL_OCR_MODEL = 'mistral-ocr-latest';
const MISTRAL_OCR_TIMEOUT_MS = 60_000;
const MISTRAL_OCR_SIGNED_URL_HOURS = 1;
const NATIVE_TEXT_MIN_CHARS = 10;

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export async function extractPdfWithMistralOCR(
  buffer: ArrayBuffer,
  startTime: number,
  pageCountHint?: number,
): Promise<ExtractionResult> {
  let fileId: string | null = null;
  const client = getMistralClient();

  try {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const uploaded = await withTimeout(
      client.files.upload({
        file: { fileName: 'document.pdf', content: blob },
        purpose: 'ocr',
      }),
      MISTRAL_OCR_TIMEOUT_MS,
      'mistral-ocr:upload',
    );
    fileId = uploaded.id;

    const signed = await withTimeout(
      client.files.getSignedUrl({ fileId, expiry: MISTRAL_OCR_SIGNED_URL_HOURS }),
      MISTRAL_OCR_TIMEOUT_MS,
      'mistral-ocr:sign',
    );

    const ocrResponse = await withTimeout(
      client.ocr.process({
        model: MISTRAL_OCR_MODEL,
        document: { type: 'document_url', documentUrl: signed.url },
      }),
      MISTRAL_OCR_TIMEOUT_MS,
      'mistral-ocr:process',
    );

    const text = ocrResponse.pages
      .map((p) => p.markdown ?? '')
      .filter((m) => m.length > 0)
      .join('\n\n')
      .trim();

    if (text.length < NATIVE_TEXT_MIN_CHARS) {
      return {
        success: false,
        text: '',
        metadata: {
          wordCount: 0,
          extractionMethod: 'mistral-ocr',
          extractionTimeMs: Date.now() - startTime,
        },
        error: 'OCR Mistral n\'a pas pu extraire de texte de ce PDF (pages vides ou illisibles).',
      };
    }

    const wordCount = countWords(text);
    logger.info('PDF OCR completed via Mistral', {
      pageCount: ocrResponse.pages.length,
      wordCount,
      textLength: text.length,
      operation: 'pdf-extraction:ocr-complete',
    });

    return {
      success: true,
      text,
      metadata: {
        pageCount: ocrResponse.pages.length || pageCountHint,
        wordCount,
        extractionMethod: 'mistral-ocr',
        extractionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    logger.error('Mistral OCR fallback failed', {
      _error: error instanceof Error ? error.message : String(error),
      operation: 'pdf-extraction:ocr-error',
      severity: 'high' as const,
    });
    return {
      success: false,
      text: '',
      metadata: {
        wordCount: 0,
        extractionMethod: 'mistral-ocr',
        extractionTimeMs: Date.now() - startTime,
      },
      error: 'Erreur lors de l\'extraction du PDF (OCR fallback).',
    };
  } finally {
    // Best-effort cleanup. We don't fail the extraction if cleanup itself
    // fails — Mistral's retention policy will GC the file.
    if (fileId) {
      client.files.delete({ fileId }).catch((err: unknown) => {
        logger.debug('Mistral OCR file cleanup failed (non-fatal)', {
          operation: 'pdf-extraction:ocr-cleanup',
          _error: err instanceof Error ? err.message : String(err),
          fileId,
        });
      });
    }
  }
}
