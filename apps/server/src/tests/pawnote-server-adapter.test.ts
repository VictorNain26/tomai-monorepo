/**
 * Tests - PawnoteServerAdapter
 * Mock: pawnote (loginToken, gradesOverview, assignmentsFromIntervals, timetableFromIntervals)
 *
 * connectWithCredentials is test-only and lives in
 * integration-tests/helpers/pronote-credentials-login.ts; it is not exercised here.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ============================================
// MOCKS — must precede adapter import
// ============================================

const mockHandle = {
  userResource: {
    tabs: new Map([
      [
        4 /* TabLocation.Grades */,
        {
          defaultPeriod: { id: 'period-1', name: 'Trimestre 1' },
          periods: [{ id: 'period-1', name: 'Trimestre 1' }],
        },
      ],
    ]),
  },
};

const mockLoginToken = mock(async () => ({
  url: 'https://demo.index-education.net/pronote',
  username: 'jean.dupont',
  kind: 7,
  token: 'rotated-token-96chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  navigatorIdentifier: 'nav-id',
}));

const mockGradesOverview = mock(async () => ({
  grades: [
    {
      value: { kind: 0 /* GradeKind.Grade */, points: 15 },
      outOf: { points: 20 },
      subject: { name: 'Mathématiques' },
      date: new Date('2026-06-01'),
      comment: 'Bon travail',
    },
    {
      value: { kind: 1 /* GradeKind.Absent */, points: 0 },
      outOf: { points: 20 },
      subject: { name: 'Histoire' },
      date: new Date('2026-06-02'),
      comment: '',
    },
  ],
}));

const mockAssignmentsFromIntervals = mock(async () => [
  {
    subject: { name: 'Physique' },
    description: '<p>Lire le <b>chapitre 3</b></p>',
    deadline: new Date('2026-06-10'),
    done: false,
  },
  {
    subject: { name: 'Français' },
    description: 'Rédiger une page',
    deadline: new Date('2026-06-11'),
    done: true,
  },
]);

const mockTimetableFromIntervals = mock(async () => ({
  classes: [
    {
      is: 'lesson',
      subject: { name: 'SVT' },
      startDate: new Date('2026-06-16T08:00:00Z'),
      endDate: new Date('2026-06-16T09:00:00Z'),
      classrooms: ['Salle 12'],
      canceled: false,
    },
    {
      is: 'activity',
      subject: { name: 'Sport' },
      startDate: new Date('2026-06-16T10:00:00Z'),
      endDate: new Date('2026-06-16T11:00:00Z'),
      classrooms: [],
      canceled: false,
    },
    {
      is: 'lesson',
      subject: undefined,
      startDate: new Date('2026-06-16T11:00:00Z'),
      endDate: new Date('2026-06-16T12:00:00Z'),
      classrooms: [],
      canceled: true,
    },
  ],
}));

const mockCreateSessionHandle = mock(() => mockHandle);

mock.module('pawnote', () => ({
  createSessionHandle: mockCreateSessionHandle,
  loginToken: mockLoginToken,
  gradesOverview: mockGradesOverview,
  assignmentsFromIntervals: mockAssignmentsFromIntervals,
  timetableFromIntervals: mockTimetableFromIntervals,
  use: () => {},
  GradeKind: { Error: -1, Grade: 0, Absent: 1, Exempted: 2 },
  TabLocation: { Grades: 4 },
}));

// Import after mocks
const { PawnoteServerAdapter, PronoteReauthRequired } = await import(
  '../services/pronote/pawnote-server.adapter'
);

// ============================================
// Tests
// ============================================

const BASE_INPUT = {
  url: 'https://demo.index-education.net/pronote',
  kind: 7,
  username: 'jean.dupont',
  token: 'stored-token',
  deviceUuid: 'device-uuid-123',
};

describe('PawnoteServerAdapter', () => {
  let adapter: InstanceType<typeof PawnoteServerAdapter>;

  beforeEach(() => {
    adapter = new PawnoteServerAdapter();
    mockLoginToken.mockClear();
    mockGradesOverview.mockClear();
    mockAssignmentsFromIntervals.mockClear();
    mockTimetableFromIntervals.mockClear();
    mockCreateSessionHandle.mockClear();
  });

  // ============================================
  // connect
  // ============================================

  describe('connect', () => {
    it('returns the rotated token from loginToken', async () => {
      const session = await adapter.connect(BASE_INPUT);
      expect(session.token).toBe(
        'rotated-token-96chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      );
      expect(session.username).toBe('jean.dupont');
      expect(mockLoginToken).toHaveBeenCalledTimes(1);
    });

    it('maps a loginToken throw to PronoteReauthRequired', async () => {
      mockLoginToken.mockRejectedValueOnce(new Error('BadCredentials'));

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(adapter.connect(BASE_INPUT)).rejects.toBeInstanceOf(PronoteReauthRequired);
      expect(mockLoginToken).toHaveBeenCalledTimes(1);
    });

    it('throws PronoteReauthRequired on loginToken failure', async () => {
      mockLoginToken.mockRejectedValueOnce(new Error('BadCredentials'));

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(adapter.connect(BASE_INPUT)).rejects.toBeInstanceOf(PronoteReauthRequired);
    });
  });

  // ============================================
  // getGrades
  // ============================================

  describe('getGrades', () => {
    it('returns [] when the grades tab has no period', async () => {
      // Build a handle whose grades tab has neither defaultPeriod nor periods.
      const handleNoPeriod = {
        userResource: {
          tabs: new Map([
            [4 /* TabLocation.Grades */, { defaultPeriod: null, periods: [] }],
          ]),
        },
      };
      mockCreateSessionHandle.mockReturnValueOnce(handleNoPeriod as unknown as typeof mockHandle);

      const session = await adapter.connect(BASE_INPUT);
      const grades = await adapter.getGrades(session, 0);
      expect(grades).toEqual([]);
    });

    it('maps a numeric grade correctly', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const grades = await adapter.getGrades(session, 0);

      const math = grades.find((g) => g.subject === 'Mathématiques');
      expect(math).toBeDefined();
      expect(math!.value).toBe(15);
      expect(math!.scale).toBe(20);
      expect(math!.date).toBe('2026-06-01');
      expect(math!.comment).toBe('Bon travail');
    });

    it('maps an Absent grade to value: null', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const grades = await adapter.getGrades(session, 0);

      const hist = grades.find((g) => g.subject === 'Histoire');
      expect(hist).toBeDefined();
      expect(hist!.value).toBeNull();
      expect(hist!.comment).toBeNull();
    });
  });

  // ============================================
  // getHomework
  // ============================================

  describe('getHomework', () => {
    it('strips HTML tags from description', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const hw = await adapter.getHomework(session, 0);

      const phys = hw.find((h) => h.subject === 'Physique');
      expect(phys).toBeDefined();
      expect(phys!.description).toBe('Lire le chapitre 3');
      expect(phys!.dueDate).toBe('2026-06-10');
      expect(phys!.done).toBe(false);
    });

    it('preserves plain text description unchanged', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const hw = await adapter.getHomework(session, 0);

      const fr = hw.find((h) => h.subject === 'Français');
      expect(fr).toBeDefined();
      expect(fr!.description).toBe('Rédiger une page');
      expect(fr!.done).toBe(true);
    });
  });

  // ============================================
  // getTimetable
  // ============================================

  describe('getTimetable', () => {
    it('returns only lessons (not activities/detentions)', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const lessons = await adapter.getTimetable(session, 0, '2026-06-16');

      expect(lessons).toHaveLength(2);
    });

    it('maps lesson fields correctly', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const lessons = await adapter.getTimetable(session, 0, '2026-06-16');

      const svt = lessons.find((l) => l.subject === 'SVT');
      expect(svt).toBeDefined();
      expect(svt!.start).toBe('2026-06-16T08:00:00.000Z');
      expect(svt!.end).toBe('2026-06-16T09:00:00.000Z');
      expect(svt!.room).toBe('Salle 12');
      expect(svt!.canceled).toBe(false);
    });

    it('falls back to empty string for lesson with no subject', async () => {
      const session = await adapter.connect(BASE_INPUT);
      const lessons = await adapter.getTimetable(session, 0, '2026-06-16');

      const noSubject = lessons.find((l) => l.canceled);
      expect(noSubject).toBeDefined();
      expect(noSubject!.subject).toBe('');
      expect(noSubject!.room).toBeNull();
    });
  });
});
