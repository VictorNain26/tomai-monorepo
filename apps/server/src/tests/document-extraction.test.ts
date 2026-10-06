import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

let reply: { text: string; error?: string } = { text: '' };
const readImageWithMistralVision = mock(async (_buffer: ArrayBuffer, _mimeType: string, _owner: unknown) => reply);
mock.module('../modules/documents/mistral-vision', () => ({ readImageWithMistralVision }));

const { documentExtractionService } = await import('../modules/documents/document-extraction.service');

const owner = { userId: 'u1', sessionId: 's1' };
const image = new TextEncoder().encode('PNG').buffer;

describe('documentExtractionService.extractText — image', () => {
  it('gives the text read by vision and its word count, the reading billed to the owner', async () => {
    reply = { text: 'Résous 3x + 5 = 20.' };
    expect(await documentExtractionService.extractText(image, 'image/png', owner)).toMatchObject({
      success: true,
      text: 'Résous 3x + 5 = 20.',
      metadata: { extractionMethod: 'mistral-vision', wordCount: 6 },
    });
    expect(readImageWithMistralVision.mock.calls.at(-1)?.[2]).toEqual(owner);
  });

  it('fails an image with nothing read, and passes on the reason of a failed call', async () => {
    reply = { text: '' };
    expect(await documentExtractionService.extractText(image, 'image/png', owner)).toMatchObject({ success: false, error: "Aucun contenu lu dans l'image" });

    reply = { text: '', error: 'timeout' };
    expect(await documentExtractionService.extractText(image, 'image/png', owner)).toMatchObject({ success: false, error: 'timeout' });
  });

  it('reads plain text without any model call', async () => {
    expect(await documentExtractionService.extractText(new TextEncoder().encode('Exercice 1 : calcule 2 + 3.').buffer, 'text/plain', owner))
      .toMatchObject({ success: true, text: 'Exercice 1 : calcule 2 + 3.', metadata: { extractionMethod: 'text' } });
  });
});
