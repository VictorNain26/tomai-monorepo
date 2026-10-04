import { describe, it, expect } from 'bun:test';
import { chatTransport, sendTurn } from '../eval/chat-request';

/** The transport of the client against a fake chat route that records the JSON bodies it receives. */
function capture() {
  const bodies: Record<string, unknown>[] = [];
  const fetchImpl = Object.assign(
    (_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('the transport sends a JSON string');
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      return Promise.resolve(new Response('', { headers: { 'content-type': 'text/event-stream' } }));
    },
    { preconnect: fetch.preconnect },
  );
  return { bodies, transport: chatTransport('http://eval.local/api/chat/stream', fetchImpl, 's1', 'quatrieme') };
}

describe('sendTurn', () => {
  it('declares the voice channel for a spoken turn, as the client does, and nothing for a typed one', async () => {
    const { bodies, transport } = capture();
    await sendTurn(transport, 's1', { text: 'Tu peux me l’expliquer ?', inputMode: 'voice' });
    await sendTurn(transport, 's1', { text: 'Oui, fais-les.' });
    expect(bodies.map((body) => ({ inputMode: body['inputMode'], sessionId: body['sessionId'], schoolLevel: body['schoolLevel'] }))).toEqual([
      { inputMode: 'voice', sessionId: 's1', schoolLevel: 'quatrieme' },
      { inputMode: undefined, sessionId: 's1', schoolLevel: 'quatrieme' },
    ]);
  });
});
