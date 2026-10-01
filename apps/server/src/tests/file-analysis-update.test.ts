import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { DocumentAnalysisResult } from '../modules/documents/document-types';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const mergeEducationalContext = mock(async (_id: string, _patch: Record<string, unknown>) => {});
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: { mergeEducationalContext },
}));

const { updateFileAnalysis } = await import('../modules/documents/file-multimodal.service');

const result: DocumentAnalysisResult = {
  success: true,
  extraction: { text: 'calculer 3 + 4', method: 'unpdf', wordCount: 4 },
  classification: { documentType: 'exercice', subject: 'mathematiques', confidence: 'high', description: 'Document exercice en mathematiques' },
  analysis: 'Exercice de calcul.',
  metrics: { totalTimeMs: 10, extractionTimeMs: 4, analysisTimeMs: 6 },
};

beforeEach(() => {
  mergeEducationalContext.mockReset();
  mockLogger.warn.mockClear();
});

describe('updateFileAnalysis', () => {
  it('merges the analysis into the file context in one SQL update', async () => {
    await updateFileAnalysis('file-1', result);

    expect(mergeEducationalContext).toHaveBeenCalledTimes(1);
    expect(mergeEducationalContext.mock.calls[0]).toEqual(['file-1', {
      analysisContext: 'Exercice de calcul.',
      extractedText: 'calculer 3 + 4',
      documentType: 'exercice',
      subject: 'mathematiques',
      classification: result.classification,
      metrics: result.metrics,
    }]);
  });

  it('logs and swallows a database failure, the chat turn goes on', async () => {
    mergeEducationalContext.mockImplementationOnce(async () => {
      throw new Error('connection lost');
    });

    await updateFileAnalysis('file-1', result);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });
});
