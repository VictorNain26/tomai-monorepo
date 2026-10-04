import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

let reply: { text: string; usage?: { inputTokens: number; cachedInputTokens: number; outputTokens: number }; error?: string } = { text: '' };
mock.module('../modules/documents/mistral-vision', () => ({ readImageWithMistralVision: mock(async () => reply) }));

const { documentExtractionService } = await import('../modules/documents/document-extraction.service');

const usage = { inputTokens: 800, cachedInputTokens: 0, outputTokens: 30 };
const image = new TextEncoder().encode('PNG').buffer;

describe('documentExtractionService.extractText — image', () => {
  it('gives the text read by vision, its word count and the usage', async () => {
    reply = { text: 'Résous 3x + 5 = 20.', usage };
    expect(await documentExtractionService.extractText(image, 'image/png', 'exo.png')).toMatchObject({
      success: true,
      text: 'Résous 3x + 5 = 20.',
      metadata: { extractionMethod: 'mistral-vision', wordCount: 6, usage },
    });
  });

  it('fails an image with nothing read, keeping the usage, and passes on the reason of a failed call', async () => {
    reply = { text: '', usage };
    expect(await documentExtractionService.extractText(image, 'image/png', 'exo.png')).toMatchObject({ success: false, metadata: { usage }, error: "Aucun contenu lu dans l'image" });

    reply = { text: '', error: 'timeout' };
    const failed = await documentExtractionService.extractText(image, 'image/png', 'exo.png');
    expect(failed).toMatchObject({ success: false, error: 'timeout' });
    expect(failed.metadata.usage).toBeUndefined();
  });

  it('reads plain text without any model call', async () => {
    expect(await documentExtractionService.extractText(new TextEncoder().encode('Exercice 1 : calcule 2 + 3.').buffer, 'text/plain', 'exo.txt'))
      .toMatchObject({ success: true, text: 'Exercice 1 : calcule 2 + 3.', metadata: { extractionMethod: 'text' } });
  });
});
