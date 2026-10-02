import { describe, it, expect, mock, beforeEach } from 'bun:test';

const signUpEmail = mock(async (_args: { body: Record<string, unknown> }) => ({ user: { id: 'student-1' } }));
mock.module('../platform/auth/auth', () => ({ auth: { api: { signUpEmail } } }));

let updateFails = false;
const update = mock(async (_id: string, _data: Record<string, unknown>) => {
  if (updateFails) throw new Error('db down');
  return { id: 'student-1' };
});
const deleteById = mock(async (_id: string) => true);
mock.module('../modules/auth/users.repository', () => ({ usersRepository: { update, deleteById } }));

mock.module('better-auth/crypto', () => ({ hashPassword: async (password: string) => `hashed:${password}` }));
const set = mock((_values: Record<string, unknown>) => ({ where: mock(async () => []) }));
mock.module('../db/connection', () => ({ db: { update: mock(() => ({ set })) } }));

const { createStudentAccount, setPassword } = await import('../modules/auth/accounts');

const input = {
  firstName: 'Léa',
  lastName: 'Martin',
  username: 'lea',
  password: 'temp-pass-123',
  schoolLevel: 'sixieme' as const,
  dateOfBirth: '2014-03-01',
};

beforeEach(() => {
  updateFails = false;
  signUpEmail.mockClear();
  update.mockClear();
  deleteById.mockClear();
  set.mockClear();
});

describe('createStudentAccount', () => {
  it('signs up with the username and an internal email, then fills the student profile', async () => {
    expect(await createStudentAccount(input)).toBe('student-1');

    const body = signUpEmail.mock.calls[0]?.[0].body;
    expect(body).toMatchObject({ username: 'lea', password: 'temp-pass-123', name: 'Léa Martin' });
    expect(String(body?.['email'])).toEndWith('@internal.tomai');
    expect(update).toHaveBeenCalledWith('student-1', expect.objectContaining({ role: 'student', username: 'lea', schoolLevel: 'sixieme' }));
  });

  it('removes the half-created account when the profile update fails', async () => {
    updateFails = true;

    const error = await createStudentAccount(input).then(() => undefined, (err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(deleteById).toHaveBeenCalledWith('student-1');
  });
});

describe('setPassword', () => {
  it('stores the hashed password', async () => {
    await setPassword('student-1', 'new-pass-456');

    expect(set).toHaveBeenCalledWith({ password: 'hashed:new-pass-456' });
  });
});
