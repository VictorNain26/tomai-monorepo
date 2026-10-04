import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { ExtractionResult } from '../modules/documents/document-extraction.service';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

interface FileRow { id: string; fileName: string; mimeType: string; sizeBytes: number; storageKey: string; educationalContext: Record<string, unknown> | null }
let rows: FileRow[] = [];
const mergeEducationalContext = mock(async (_id: string, _patch: Record<string, unknown>) => true);
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: { findByIds: mock(async (ids: string[]) => rows.filter((row) => ids.includes(row.id))), mergeEducationalContext },
}));

let attached: { fileId: string; fileName: string; mimeType: string; educationalContext: Record<string, unknown> | null }[] = [];
mock.module('../modules/documents/session-files.repository', () => ({
  sessionFilesRepository: { findBySessionWithContext: mock(async () => attached) },
}));

const getFileContent = mock(async (_key: string): Promise<{ content: Buffer; contentType: string } | null> => {
  // A view on a larger pool, as Buffer often is: only its own bytes must reach the extraction.
  const pool = Buffer.from('xxxxIMAGEyyyy');
  return { content: pool.subarray(4, 9), contentType: 'image/png' };
});
mock.module('../modules/documents/storage', () => ({ getFileContent }));

const received: string[] = [];
let extraction: ExtractionResult = { success: true, text: 'Résous 3x + 5 = 20.', metadata: { wordCount: 4, extractionMethod: 'mistral-vision', extractionTimeMs: 1, usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 40 } } };
mock.module('../modules/documents/document-extraction.service', () => ({
  documentExtractionService: {
    extractText: mock(async (buffer: ArrayBuffer) => {
      received.push(Buffer.from(buffer).toString());
      return extraction;
    }),
  },
}));

const record = mock(async (_input: unknown) => {});
const actualBilling = await import('../modules/billing/index');
mock.module('../modules/billing/index', () => ({ ...actualBilling, costTrackingService: { record } }));

const { fileContextService } = await import('../modules/documents/file-context.service');

const photo: FileRow = { id: 'f-photo', fileName: 'exo.png', mimeType: 'image/png', sizeBytes: 5, storageKey: 'k-photo', educationalContext: {} };
const owner = { userId: 'u1', sessionId: 's1' };

beforeEach(() => {
  rows = [photo];
  attached = [];
  received.length = 0;
  extraction = { success: true, text: 'Résous 3x + 5 = 20.', metadata: { wordCount: 4, extractionMethod: 'mistral-vision', extractionTimeMs: 1, usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 40 } } };
  mergeEducationalContext.mockClear();
  getFileContent.mockClear();
  record.mockClear();
  mockLogger.warn.mockClear();
});

describe('fileContextService.prepareFileContext', () => {
  it("reads a turn's file once, from its own bytes, keeps the text on the record and counts the vision call", async () => {
    const { turnFiles, sessionFiles, attachedFileInfos } = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });

    expect(turnFiles).toEqual([{ fileId: 'f-photo', fileName: 'exo.png', text: 'Résous 3x + 5 = 20.' }]);
    expect(sessionFiles).toEqual([]);
    expect(attachedFileInfos).toEqual([{ fileName: 'exo.png', fileId: 'f-photo', mimeType: 'image/png', fileSizeBytes: 5 }]);
    expect(received).toEqual(['IMAGE']);
    expect(mergeEducationalContext).toHaveBeenCalledWith('f-photo', { extractedText: 'Résous 3x + 5 = 20.', extractionMethod: 'mistral-vision', wordCount: 4 });
    expect(record.mock.calls[0]?.[0]).toMatchObject({ operation: 'document-extraction', tokensInput: 900, tokensOutput: 40, userId: 'u1', sessionId: 's1' });
  });

  it('reuses the text kept on the record without reading the file again', async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'Déjà lu' } }];

    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).turnFiles[0]?.text).toBe('Déjà lu');
    expect(getFileContent).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('leaves out a file that cannot be read, and logs it', async () => {
    extraction = { success: false, text: '', metadata: { wordCount: 0, extractionMethod: 'unpdf', extractionTimeMs: 1 }, error: 'PDF sans texte' };

    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).turnFiles).toEqual([]);
    expect(mergeEducationalContext).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("gives the session's files in their order, without the ones sent again with the turn nor the unread ones", async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'Photo' } }];
    attached = [
      { fileId: 'f-cours', fileName: 'cours.pdf', mimeType: 'application/pdf', educationalContext: { extractedText: 'Le cours' } },
      { fileId: 'f-photo', fileName: 'exo.png', mimeType: 'image/png', educationalContext: { extractedText: 'Photo' } },
      { fileId: 'f-vide', fileName: 'vide.pdf', mimeType: 'application/pdf', educationalContext: {} },
      { fileId: 'f-fiche', fileName: 'fiche.pdf', mimeType: 'application/pdf', educationalContext: { extractedText: 'La fiche' } },
    ];

    const { sessionFiles, turnFiles } = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });

    expect(sessionFiles.map((file) => file.fileId)).toEqual(['f-cours', 'f-fiche']);
    expect(turnFiles.map((file) => file.fileId)).toEqual(['f-photo']);
  });

  it("serves the turn's files first from the budget, and cuts the session's with what is left", async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'p'.repeat(49_990) } }];
    attached = [
      { fileId: 'f-cours', fileName: 'cours.pdf', mimeType: 'application/pdf', educationalContext: { extractedText: 'c'.repeat(100) } },
      { fileId: 'f-fiche', fileName: 'fiche.pdf', mimeType: 'application/pdf', educationalContext: { extractedText: 'La fiche' } },
    ];

    const { sessionFiles, turnFiles } = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });

    expect(turnFiles[0]?.text).toHaveLength(49_990);
    expect(sessionFiles[0]?.text).toBe(`${'c'.repeat(10)}\n\n[Contenu tronqué]`);
    expect(sessionFiles[1]?.text).toBe('[Contenu tronqué]');
  });
});
