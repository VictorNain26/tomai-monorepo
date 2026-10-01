import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { DocumentAnalysisResult } from '../modules/documents/document-types';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

interface FileRow {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  educationalContext: Record<string, unknown> | null;
}

let rows: FileRow[] = [];
const findByIds = mock(async (ids: string[]) => rows.filter((r) => ids.includes(r.id)));
const mergeEducationalContext = mock(async (_id: string, _patch: Record<string, unknown>) => true);
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: { findByIds, mergeEducationalContext },
}));

const getFileContent = mock(async (_key: string): Promise<{ content: Buffer; contentType: string } | null> => ({
  content: Buffer.from('png-bytes'),
  contentType: 'image/png',
}));
mock.module('../modules/documents/storage', () => ({ getFileContent }));

const { updateFileAnalysis, prepareMultimodalFiles } = await import('../modules/documents/file-multimodal.service');

const result: DocumentAnalysisResult = {
  success: true,
  extraction: { text: 'calculer 3 + 4', method: 'unpdf', wordCount: 4 },
  classification: { documentType: 'exercice', subject: 'mathematiques', confidence: 'high', description: 'Document exercice en mathematiques' },
  analysis: 'Exercice de calcul.',
  metrics: { totalTimeMs: 10, extractionTimeMs: 4, analysisTimeMs: 6 },
};

const photo: FileRow = { id: 'f-photo', fileName: 'ex.png', mimeType: 'image/png', storageKey: 'k-photo', educationalContext: null };
const pdf: FileRow = { id: 'f-pdf', fileName: 'cours.pdf', mimeType: 'application/pdf', storageKey: 'k-pdf', educationalContext: { extractedText: 'Théorème de Pythagore' } };
const unread: FileRow = { id: 'f-unread', fileName: 'brouillon.pdf', mimeType: 'application/pdf', storageKey: 'k-unread', educationalContext: {} };

beforeEach(() => {
  rows = [photo, pdf, unread];
  findByIds.mockClear();
  getFileContent.mockClear();
  mergeEducationalContext.mockReset();
  mergeEducationalContext.mockImplementation(async () => true);
  mockLogger.info.mockClear();
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
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('does not claim a save when the file was deleted meanwhile', async () => {
    mergeEducationalContext.mockImplementationOnce(async () => false);

    await updateFileAnalysis('gone', result);

    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('logs and swallows a database failure, the chat turn goes on', async () => {
    mergeEducationalContext.mockImplementationOnce(async () => {
      throw new Error('connection lost');
    });

    await updateFileAnalysis('file-1', result);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('prepareMultimodalFiles', () => {
  it('loads every file in one query and keeps the requested order', async () => {
    const files = await prepareMultimodalFiles(['f-pdf', 'f-photo']);

    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(files.map((f) => f.fileName)).toEqual(['cours.pdf', 'ex.png']);
  });

  it('inlines an image as base64 and a document as its extracted text', async () => {
    const [image, document] = await prepareMultimodalFiles(['f-photo', 'f-pdf']);

    expect(image).toEqual({ fileName: 'ex.png', mimeType: 'image/png', contentType: 'image', base64: Buffer.from('png-bytes').toString('base64') });
    expect(document).toEqual({ fileName: 'cours.pdf', mimeType: 'application/pdf', contentType: 'document', extractedText: 'Théorème de Pythagore' });
    expect(getFileContent).toHaveBeenCalledTimes(1);
  });

  it('skips unknown ids and documents without extracted text', async () => {
    const files = await prepareMultimodalFiles(['missing', 'f-unread', 'f-pdf']);

    expect(files.map((f) => f.fileName)).toEqual(['cours.pdf']);
  });

  it('skips an image the storage cannot return', async () => {
    getFileContent.mockImplementationOnce(async () => null);

    expect(await prepareMultimodalFiles(['f-photo'])).toEqual([]);
  });
});
