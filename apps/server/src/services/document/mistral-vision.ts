/**
 * Mistral Vision OCR for images.
 *
 * Triggered by document-extraction.service when image MIME type is detected.
 * Uses the multimodal chat model (Mistral Small 4) to extract text
 * content and describe structural elements.
 */

import { generateText, type MistralMessage } from '../../lib/ai/mistral-client.js';
import { logger } from '../../lib/observability.js';
import { withGenAiSpan } from '../../lib/otel/index.js';
import type { ExtractionResult } from './document-extraction.service.js';
import { env } from '../../config/env.js';

const VISION_MODEL = env.MISTRAL_MODEL;
const VISION_TEMPERATURE = 0.1;
const VISION_MAX_TOKENS = 2048;
const VISION_TIMEOUT_MS = 30_000;

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export async function extractImageWithMistralVision(
  buffer: ArrayBuffer,
  mimeType: string,
  startTime: number
): Promise<ExtractionResult> {
  try {
    const base64Data = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const messages: MistralMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Décris le contenu textuel et structurel de cette image. Si du texte est lisible, transcris-le fidèlement. Sinon, décris brièvement ce qu\'on voit (diagramme, formule, schéma, graphique...).',
          },
          { type: 'image_url', imageUrl: { url: dataUrl } },
        ],
      },
    ];

    const extractedText = await withGenAiSpan(
      {
        operation: 'text_completion',
        provider: 'mistral_ai',
        model: VISION_MODEL,
        maxTokens: VISION_MAX_TOKENS,
        temperature: VISION_TEMPERATURE,
        serverAddress: new URL(env.MISTRAL_SERVER_URL).host,
      },
      async () => {
        return await generateText({
          model: VISION_MODEL,
          messages,
          temperature: VISION_TEMPERATURE,
          maxTokens: VISION_MAX_TOKENS,
          timeoutMs: VISION_TIMEOUT_MS,
        });
      },
    );

    const trimmedText = extractedText.trim();
    const wordCount = countWords(trimmedText);

    logger.info('Image OCR completed via Mistral Vision', {
      textLength: trimmedText.length,
      wordCount,
      operation: 'image-extraction',
    });

    if (!trimmedText || trimmedText.length < 1) {
      return {
        success: false,
        text: '',
        metadata: {
          wordCount: 0,
          extractionMethod: 'mistral-vision',
          extractionTimeMs: Date.now() - startTime,
        },
        error: 'Mistral Vision n\'a pas pu extraire de contenu de cette image',
      };
    }

    return {
      success: true,
      text: trimmedText,
      metadata: {
        wordCount,
        extractionMethod: 'mistral-vision',
        extractionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    logger.error('Image extraction (Mistral Vision) failed', {
      _error: error instanceof Error ? error.message : String(error),
      operation: 'image-extraction',
      severity: 'medium' as const,
    });

    return {
      success: false,
      text: '',
      metadata: {
        wordCount: 0,
        extractionMethod: 'mistral-vision',
        extractionTimeMs: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : 'Image extraction failed',
    };
  }
}
