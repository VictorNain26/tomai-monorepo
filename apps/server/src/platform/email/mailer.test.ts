/**
 * The Scaleway mailer against a local HTTP server standing for Scaleway's API: the request the SDK
 * sends is the one of the API's specification (transactional-email v1alpha1, CreateEmail).
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { scalewayMailer } from './mailer';

interface Received {
  method: string;
  path: string;
  token: string | null;
  body: { from: { email: string; name: string }; to: { email: string }[]; subject: string; text: string; html: string; project_id: string };
}

const received: Received[] = [];
let status = 200;
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    received.push({
      method: req.method,
      path: new URL(req.url).pathname,
      token: req.headers.get('x-auth-token'),
      body: (await req.json()) as Received['body'],
    });
    // The SDK parses JSON only under this exact content type, the one Scaleway's API sends.
    return new Response(JSON.stringify(status === 200 ? { emails: [] } : { message: 'refused' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
afterAll(() => server.stop(true));

const PROJECT = '6170692e-7363-616c-6577-61792e636f6d';
const send = scalewayMailer({
  accessKey: 'SCW0123456789ABCDEFG',
  secretKey: '11111111-2222-4333-8444-555555555555',
  projectId: PROJECT,
  from: 'tom@mail.tom.example',
  apiURL: server.url.origin,
});

describe('scalewayMailer', () => {
  it('sends the email to the Paris region of the API, authenticated by the secret key', async () => {
    await send({ to: 'parent@example.com', subject: 'Sujet', text: 'Bonjour,\nun lien : https://tom.example/x?a=1&b=<2>' });
    const [request] = received;
    expect(request).toMatchObject({
      method: 'POST',
      path: '/transactional-email/v1alpha1/regions/fr-par/emails',
      token: '11111111-2222-4333-8444-555555555555',
    });
    expect(request?.body).toMatchObject({
      from: { email: 'tom@mail.tom.example', name: 'Tom' },
      to: [{ email: 'parent@example.com' }],
      subject: 'Sujet',
      text: 'Bonjour,\nun lien : https://tom.example/x?a=1&b=<2>',
      project_id: PROJECT,
    });
  });

  it('escapes the text in its HTML part, one paragraph per line', () => {
    expect(received[0]?.body.html).toBe('<p>Bonjour,</p><p>un lien : https://tom.example/x?a=1&amp;b=&lt;2&gt;</p>');
  });

  it('fails when the API refuses the email, so that the caller knows nothing was sent', async () => {
    status = 400;
    const failure = await send({ to: 'parent@example.com', subject: 'Sujet', text: 'Bonjour' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    status = 200;
  });
});
