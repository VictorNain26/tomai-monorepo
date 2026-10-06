import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { ExtractionResult } from '../modules/documents/document-extraction.service';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

interface FileRow {
  id: string;
  userId: string;
  status: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  educationalContext: Record<string, unknown> | null;
}
let rows: FileRow[] = [];
const mergeEducationalContext = mock(async (_id: string, _patch: Record<string, unknown>) => true);
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: {
    // As the query filters: the user's own files, uploaded.
    findReadyOwnedBy: mock(async (userId: string, ids: readonly string[]) =>
      rows.filter((row) => ids.includes(row.id) && row.userId === userId && row.status === 'ready'),
    ),
    mergeEducationalContext,
  },
}));

let attached: { fileId: string; fileName: string; mimeType: string; storageKey: string; educationalContext: Record<string, unknown> | null }[] = [];
let sessionFilesFail = false;
mock.module('../modules/documents/session-files.repository', () => ({
  sessionFilesRepository: {
    findBySessionWithContext: mock(async () => {
      if (sessionFilesFail) throw new Error('db down');
      return attached;
    }),
  },
}));

const getFileContent = mock(async (_key: string): Promise<{ content: Buffer; contentType: string } | null> => {
  // A view on a larger pool, as Buffer often is: only its own bytes must reach the extraction.
  const pool = Buffer.from('xxxxIMAGEyyyy');
  return { content: pool.subarray(4, 9), contentType: 'image/png' };
});
mock.module('../modules/documents/storage', () => ({ getFileContent }));

const received: string[] = [];
const extractText = mock(async (buffer: ArrayBuffer, _mimeType: string, _owner: unknown) => {
  received.push(Buffer.from(buffer).toString());
  return extraction;
});
const read = (text: string): ExtractionResult => ({
  success: true,
  text,
  metadata: { wordCount: 4, extractionMethod: 'mistral-vision', extractionTimeMs: 1 },
});
let extraction: ExtractionResult = read('Résous 3x + 5 = 20.');
mock.module('../modules/documents/document-extraction.service', () => ({
  documentExtractionService: {
    extractText,
  },
}));

const { fileContextService, UNREADABLE } = await import('../modules/documents/file-context.service');

const photo: FileRow = {
  id: 'f-photo',
  userId: 'u1',
  status: 'ready',
  fileName: 'exo.png',
  mimeType: 'image/png',
  sizeBytes: 5,
  storageKey: 'k-photo',
  educationalContext: {},
};
const owner = { userId: 'u1', sessionId: 's1' };
const sessionFile = (fileId: string, educationalContext: Record<string, unknown>) => ({
  fileId,
  fileName: `${fileId}.pdf`,
  mimeType: 'application/pdf',
  storageKey: `k-${fileId}`,
  educationalContext,
});

beforeEach(() => {
  rows = [photo];
  attached = [];
  sessionFilesFail = false;
  received.length = 0;
  extraction = read('Résous 3x + 5 = 20.');
  mergeEducationalContext.mockClear();
  getFileContent.mockClear();
  extractText.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
});

describe('fileContextService.prepareFileContext', () => {
  it("reads a turn's file once, from its own bytes, keeps the text on the record and bills the reading to the student", async () => {
    const { files, fileIds, attachedFileInfos } = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });

    expect(files).toEqual([{ fileId: 'f-photo', fileName: 'exo.png', text: 'Résous 3x + 5 = 20.' }]);
    expect(fileIds).toEqual(['f-photo']);
    expect(attachedFileInfos).toEqual([{ fileName: 'exo.png', fileId: 'f-photo', mimeType: 'image/png', fileSizeBytes: 5 }]);
    expect(received).toEqual(['IMAGE']);
    expect(mergeEducationalContext).toHaveBeenCalledWith('f-photo', {
      extractedText: 'Résous 3x + 5 = 20.',
      extractionMethod: 'mistral-vision',
      wordCount: 4,
    });
    expect(extractText.mock.calls[0]?.[2]).toEqual(owner);
  });

  it("never reads another user's file nor an unfinished upload, and leaves them out of the files to attach", async () => {
    rows = [photo, { ...photo, id: 'f-other', userId: 'u2' }, { ...photo, id: 'f-pending', status: 'pending' }];

    const { files, fileIds } = await fileContextService.prepareFileContext({ fileIds: ['f-other', 'f-pending', 'f-photo'], ...owner });

    expect(fileIds).toEqual(['f-photo']);
    expect(files.map((file) => file.fileId)).toEqual(['f-photo']);
    expect(received).toEqual(['IMAGE']);
  });

  it('reads a file sent twice once', async () => {
    const { files, fileIds } = await fileContextService.prepareFileContext({ fileIds: ['f-photo', 'f-photo'], ...owner });

    expect(fileIds).toEqual(['f-photo']);
    expect(files).toHaveLength(1);
    expect(received).toHaveLength(1);
  });

  it('reuses the text kept on the record without reading the file again', async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'Déjà lu' } }];

    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).files[0]?.text).toBe('Déjà lu');
    expect(getFileContent).not.toHaveBeenCalled();
    expect(extractText).not.toHaveBeenCalled();
  });

  it('marks a file that cannot be read, keeps the failure and its cost, and does not try again', async () => {
    extraction = { success: false, text: '', metadata: { wordCount: 0, extractionMethod: 'mistral-vision', extractionTimeMs: 1 }, error: 'timeout' };

    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).files).toEqual([
      { fileId: 'f-photo', fileName: 'exo.png', text: UNREADABLE },
    ]);
    expect(mergeEducationalContext).toHaveBeenCalledWith('f-photo', { extractionFailed: true });
    expect(extractText).toHaveBeenCalledTimes(1);

    rows = [{ ...photo, educationalContext: { extractionFailed: true } }];
    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).files[0]?.text).toBe(UNREADABLE);
    expect(getFileContent).toHaveBeenCalledTimes(1);
  });

  it("gives the session's files in their order before the turn's, a file sent again counting as the turn's, and reads one attached from the binder", async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'Photo' } }];
    attached = [
      sessionFile('cours', { extractedText: 'Le cours' }),
      { ...sessionFile('f-photo', { extractedText: 'Photo' }), fileName: 'exo.png' },
      sessionFile('classeur', {}),
    ];
    extraction = read('Le document du classeur');

    const { files } = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });

    expect(files.map((file) => [file.fileId, file.text])).toEqual([
      ['cours', 'Le cours'],
      ['classeur', 'Le document du classeur'],
      ['f-photo', 'Photo'],
    ]);
    expect(mergeEducationalContext).toHaveBeenCalledWith('classeur', expect.objectContaining({ extractedText: 'Le document du classeur' }));
  });

  it('serves the newest files first from the budget, so the same files get the same cut on the next turn', async () => {
    rows = [{ ...photo, educationalContext: { extractedText: 'p'.repeat(49_990) } }];
    attached = [sessionFile('ancien', { extractedText: 'Le plus ancien' }), sessionFile('cours', { extractedText: 'c'.repeat(100) })];

    const turn = await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner });
    expect(turn.files.map((file) => file.text)).toEqual(['[Contenu tronqué]', `${'c'.repeat(10)}\n\n[Contenu tronqué]`, 'p'.repeat(49_990)]);

    attached = [...attached, { ...sessionFile('f-photo', { extractedText: 'p'.repeat(49_990) }), fileName: 'exo.png' }];
    const next = await fileContextService.prepareFileContext({ fileIds: [], ...owner });
    expect(next.files).toEqual(turn.files);
  });

  it('goes on without the session files when they cannot be loaded, and logs it', async () => {
    sessionFilesFail = true;

    expect((await fileContextService.prepareFileContext({ fileIds: ['f-photo'], ...owner })).files.map((file) => file.fileId)).toEqual(['f-photo']);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
