import './_helpers/mistral-env';
import { describe, it, expect, afterEach, beforeEach, mock } from 'bun:test';

interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  metadata: { wordCount: number; extractionMethod: string };
}

const extracted: ExtractionResult = { success: true, text: 'Exercice 1 : calculer 3 + 4.', metadata: { wordCount: 5, extractionMethod: 'pdf' } };
let extraction: ExtractionResult = extracted;

mock.module('../services/document/document-extraction.service', () => ({
  documentExtractionService: {
    extractText: async () => extraction,
  },
}));

const { documentAnalysisService } = await import('../services/document/document-analysis.service');
const originalFetch = globalThis.fetch;
beforeEach(() => { extraction = extracted; });
afterEach(() => { globalThis.fetch = originalFetch; });

function reply(content: string) {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: 'c', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const options = { schoolLevel: 'sixieme', userId: 'u1' } as const;
const classification = { documentType: 'exercice', subject: 'mathematiques', confidence: 'high', detectedLevel: null };

describe('documentAnalysisService.analyzeDocument', () => {
  it('returns the structured classification and the real usage', async () => {
    reply(JSON.stringify({ classification, analysis: 'Un exercice d’addition.' }));

    const result = await documentAnalysisService.analyzeDocument(new ArrayBuffer(8), 'a.pdf', 'application/pdf', options);

    expect(result.success).toBe(true);
    expect(result.classification.documentType).toBe('exercice');
    expect(result.analysis).toBe('Un exercice d’addition.');
    expect(result.metrics.tokensUsed).toBe(70);
  });

  it('fails explicitly instead of inventing a classification when the output is not JSON', async () => {
    reply('Voici mon analyse sans JSON.');

    const result = await documentAnalysisService.analyzeDocument(new ArrayBuffer(8), 'a.pdf', 'application/pdf', options);

    expect(result.success).toBe(false);
  });

  it('returns a correctly shaped error result when extraction fails', async () => {
    extraction = { success: false, error: 'Upload failed', metadata: { wordCount: 0, extractionMethod: 'none' } };

    const result = await documentAnalysisService.analyzeDocument(new ArrayBuffer(8), 'a.pdf', 'application/pdf', options);

    expect(result).toMatchObject({
      success: false,
      extraction: { text: '', method: 'none', wordCount: 0 },
      classification: { documentType: 'non-educatif', subject: 'inconnu', confidence: 'low', description: 'Erreur' },
      analysis: '',
      metrics: { analysisTimeMs: 0 },
      error: 'Upload failed',
    });
    expect(result.metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('documentAnalysisService.analyzeImage', () => {
  it('returns the extracted text, the classification and the real usage', async () => {
    reply(JSON.stringify({ classification, analysis: 'Une addition.', extractedText: 'calculer 3 + 4' }));

    const result = await documentAnalysisService.analyzeImage('AAAA', 'image/png', 'a.png', options);

    expect(result.success).toBe(true);
    expect(result.extraction).toEqual({ text: 'calculer 3 + 4', method: 'mistral-vision', wordCount: 4 });
    expect(result.metrics.tokensUsed).toBe(70);
  });
});
