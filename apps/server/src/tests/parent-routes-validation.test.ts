import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { AppEnv } from '../platform/http/context';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const parentUser = { id: 'parent-1', role: 'parent' };
mock.module('../platform/auth/session', () => ({
  requireAuth: () => Promise.resolve({ success: true, user: parentUser, session: { id: 's1' } }),
  requireParentRole: () => Promise.resolve({ success: true, user: parentUser, session: { id: 's1' } }),
}));

const createChild = mock((_parentId: string, data: Record<string, unknown>) =>
  Promise.resolve({ id: 'child-1', ...data }),
);
const updateChild = mock((_parentId: string, childId: string, data: Record<string, unknown>) =>
  Promise.resolve({ id: childId, ...data }),
);
mock.module('../modules/family/parent.service', () => ({ parentService: { createChild, updateChild } }));

const { Hono } = await import('hono');
const { handleError } = await import('../platform/http/error-handler');
const { parentRoutes } = await import('../modules/family/parent.routes');

const app = new Hono<AppEnv>().route('/', parentRoutes).onError(handleError);

const validChild = {
  firstName: 'Lucas',
  lastName: 'Martin',
  username: 'lucas_ce2',
  password: 'ChildPass123',
  schoolLevel: 'ce2',
  dateOfBirth: '2015-03-15',
};

function send(method: 'POST' | 'PATCH', path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parent child routes validate their body once, with the Zod schemas', () => {
  beforeEach(() => {
    createChild.mockClear();
    updateChild.mockClear();
  });

  it.each([
    ['an age out of bounds', { ...validChild, dateOfBirth: '2022-01-01' }],
    ['a weak password', { ...validChild, password: 'weak' }],
    ['a missing date of birth', { ...validChild, dateOfBirth: undefined }],
  ])('POST rejects %s with VALIDATION_ERROR before the service', async (_label, body) => {
    const res = await send('POST', '/parent/children', body);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(createChild).not.toHaveBeenCalled();
  });

  it('POST hands the normalized body to the service', async () => {
    const res = await send('POST', '/parent/children', {
      ...validChild,
      username: 'LUCAS_CE2',
      firstName: 'Lucas ',
    });
    expect(res.status).toBe(200);
    expect(createChild).toHaveBeenCalledTimes(1);
    expect(createChild.mock.calls[0]?.[1]).toMatchObject({ username: 'lucas_ce2', firstName: 'Lucas' });
  });

  it('PATCH rejects an empty update with VALIDATION_ERROR before the service', async () => {
    const res = await send('PATCH', '/parent/children/child-1', {});
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(updateChild).not.toHaveBeenCalled();
  });

  it('PATCH hands a valid partial update to the service', async () => {
    const res = await send('PATCH', '/parent/children/child-1', { schoolLevel: 'cm1' });
    expect(res.status).toBe(200);
    expect(updateChild.mock.calls[0]?.[2]).toEqual({ schoolLevel: 'cm1' });
  });
});
