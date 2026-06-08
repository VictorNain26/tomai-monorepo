// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { proxy } from './proxy';

function reqFor(pathname: string, cookie = 'session=abc') {
  const nextUrl = new URL(`http://localhost:3002${pathname}`);
  (nextUrl as unknown as { clone: () => URL }).clone = () => new URL(nextUrl.toString());
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'cookie' ? cookie : null) },
    nextUrl,
  } as unknown as NextRequest;
}

function mockSessionResponse(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 401, headers: { 'content-type': 'application/json' } })
  ));
}

describe('proxy (role-aware auth guard)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000';
  });

  it('redirects to /login when there is no session', async () => {
    mockSessionResponse(null);
    const res = await proxy(reqFor('/parent/enfants'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects to /login when the session fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const res = await proxy(reqFor('/parent'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects to /login when the session endpoint returns 401', async () => {
    mockSessionResponse({ user: { role: 'parent' } }, false);
    const res = await proxy(reqFor('/parent'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('allows a parent to access /parent/*', async () => {
    mockSessionResponse({ user: { role: 'parent' } });
    const res = await proxy(reqFor('/parent/enfants'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects a parent away from /student/* to /parent', async () => {
    mockSessionResponse({ user: { role: 'parent' } });
    const res = await proxy(reqFor('/student/revisions'));
    expect(res.headers.get('location')).toContain('/parent');
  });

  it('treats an unknown role as parent and redirects off a mismatched segment', async () => {
    mockSessionResponse({ user: { role: 'superadmin' } });
    const res = await proxy(reqFor('/student/x'));
    expect(res.headers.get('location')).toContain('/parent');
  });
});
