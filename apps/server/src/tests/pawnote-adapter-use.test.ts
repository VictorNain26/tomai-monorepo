/**
 * Tests — PawnoteServerAdapter resource selection via pawnote.use()
 * Verifies that getGrades/getHomework/getTimetable call use(handle, resourceId)
 * before each read, including resourceId > 0 (multi-child).
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockUse = mock(() => {});
const mockGradesOverview = mock(async () => ({ grades: [] }));
const mockAssignmentsFromIntervals = mock(async () => []);
const mockTimetableFromIntervals = mock(async () => ({ classes: [] }));

mock.module('pawnote', () => ({
  createSessionHandle: mock(() => ({})),
  loginToken: mock(async () => ({ token: 'tok', username: 'u' })),
  use: mockUse,
  gradesOverview: mockGradesOverview,
  assignmentsFromIntervals: mockAssignmentsFromIntervals,
  timetableFromIntervals: mockTimetableFromIntervals,
  GradeKind: { Grade: 'Grade' },
  TabLocation: { Grades: 'Grades' },
}));

import { PawnoteServerAdapter } from '../services/pronote/pawnote-server.adapter';
import type { SessionHandle } from 'pawnote';

function makeSession(resourceId = 0) {
  const handle = {
    userResource: {
      tabs: new Map(),
    },
    user: { resources: [] },
  } as unknown as SessionHandle;
  return { token: 'tok', username: 'user', handle, resourceId };
}

describe('PawnoteServerAdapter — resource selection', () => {
  let adapter: PawnoteServerAdapter;

  beforeEach(() => {
    adapter = new PawnoteServerAdapter();
    mockUse.mockClear();
    mockGradesOverview.mockClear();
    mockAssignmentsFromIntervals.mockClear();
    mockTimetableFromIntervals.mockClear();
  });

  it('getGrades calls use(handle, 0) for resourceId=0', async () => {
    const session = makeSession(0);
    await adapter.getGrades(session, 0);
    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(session.handle, 0);
  });

  it('getGrades calls use(handle, 2) for resourceId=2 — no throw', async () => {
    const session = makeSession(2);
    await adapter.getGrades(session, 2);
    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(session.handle, 2);
  });

  it('getHomework calls use(handle, 1) for resourceId=1', async () => {
    const session = makeSession(1);
    await adapter.getHomework(session, 1);
    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(session.handle, 1);
  });

  it('getTimetable calls use(handle, 0) for resourceId=0', async () => {
    const session = makeSession(0);
    await adapter.getTimetable(session, 0, '2026-06-18');
    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(session.handle, 0);
  });

  it('assertAdapterSession still throws when handle is absent', async () => {
    const broken = { token: 'tok', username: 'u' };
    expect(adapter.getGrades(broken, 0)).rejects.toThrow('AdapterSession expected');
  });
});
