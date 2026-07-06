import { describe, expect, test } from 'bun:test';

import { scrubRequestData } from '../lib/sentry';

import type { ErrorEvent } from '@sentry/elysia';

describe('scrubRequestData', () => {
  test('strips headers, cookies and query_string but keeps url/method and the rest of the event', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'boom',
      request: {
        url: 'https://api.tomai.app/chat',
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'user-agent': 'curl' },
        cookies: { 'better-auth.session_token': 'secret-session' },
        query_string: 'token=secret',
      },
    };

    const result = scrubRequestData(event);

    expect(result.message).toBe('boom');
    expect(result.request?.url).toBe('https://api.tomai.app/chat');
    expect(result.request?.method).toBe('POST');
    expect(result.request?.headers).toBeUndefined();
    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.query_string).toBeUndefined();
  });

  test('leaves an event without a request untouched', () => {
    const event: ErrorEvent = { type: undefined, message: 'no request here' };

    const result = scrubRequestData(event);

    expect(result).toEqual(event);
  });
});
