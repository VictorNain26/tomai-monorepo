/** Moderation against the fake Mistral: what blocks, what is kept, and an unavailable Mistral. */

import { beforeEach, describe, expect, it } from 'bun:test';
import pino from 'pino';
import { fakeMistral } from '../../testing/mistral';
import { createModeration } from './moderation';

const mistral = fakeMistral();
// The error a call ends on, or null when it answers.
const failure = (call: Promise<unknown>) =>
  call.then(
    () => null,
    (error: unknown) => error,
  );
const logger = pino({ level: 'silent' });
const moderation = createModeration({ mistral: mistral.config(), logger });

beforeEach(() => {
  mistral.moderations.length = 0;
  mistral.received.length = 0;
});

describe('reply', () => {
  it('returns the blocking categories only, the reply read after the student message', async () => {
    mistral.moderations.push({ flagged: ['violence_and_threats', 'health'] });
    expect(await moderation.reply('Raconte la bataille', 'Les soldats…')).toEqual(['violence_and_threats']);
    expect(mistral.received).toMatchObject([
      {
        path: '/v1/chat/moderations',
        body: {
          input: [
            { role: 'user', content: 'Raconte la bataille' },
            { role: 'assistant', content: 'Les soldats…' },
          ],
        },
      },
    ]);
  });

  it('moderates the reply alone when the student sent no text', async () => {
    expect(await moderation.reply('  ', 'Voici la photo lue.')).toEqual([]);
    expect(mistral.received).toMatchObject([{ path: '/v1/moderations', body: { input: ['Voici la photo lue.'] } }]);
  });
});

describe('texts', () => {
  it('returns one result per text, in order', async () => {
    mistral.moderations.push({ flagged: ['sexual'] });
    expect(await moderation.texts(['a', 'b'])).toEqual([['sexual'], ['sexual']]);
  });

  it('asks nothing for no text', async () => {
    expect(await moderation.texts([])).toEqual([]);
    expect(mistral.received).toEqual([]);
  });
});

describe('studentTurn', () => {
  it('keeps the recorded categories and the self-harm score, the tutor message first for context', async () => {
    mistral.moderations.push({ flagged: ['selfharm', 'health'], scores: { selfharm: 0.92 } });
    expect(await moderation.studentTurn('Où bloques-tu ?', 'je veux disparaître')).toEqual({ flagged: ['selfharm'], selfharmScore: 0.92 });
    expect(mistral.received[0]?.body['input']).toMatchObject([
      { role: 'assistant', content: 'Où bloques-tu ?' },
      { role: 'user', content: 'je veux disparaître' },
    ]);
  });

  it('asks nothing for a turn without text, a photo alone', async () => {
    expect(await moderation.studentTurn('Envoie ton exercice', '  ')).toEqual({ flagged: [], selfharmScore: null });
    expect(mistral.received).toEqual([]);
  });

  it('reads a missing score as unknown, not as low', async () => {
    mistral.moderations.push({ scores: {} });
    expect(await moderation.studentTurn(null, 'bonjour')).toEqual({ flagged: [], selfharmScore: null });
  });
});

describe('an unavailable Mistral', () => {
  it('throws without retries', async () => {
    mistral.moderations.push({ status: 503 });
    expect(await failure(moderation.texts(['a']))).toBeInstanceOf(Error);
  });

  it('is retried, a hung attempt cut, within the call deadline', async () => {
    const patient = createModeration({ mistral: mistral.config({ retryAttempts: 2 }), logger });
    mistral.moderations.push({ status: 503 }, 'hang', {});
    const start = Date.now();
    expect(await patient.texts(['a'])).toEqual([[]]);
    expect(mistral.received).toHaveLength(3);
    expect(Date.now() - start).toBeLessThan(5_000);
  }, 10_000);

  it('gives up when the retries run out', async () => {
    const patient = createModeration({ mistral: mistral.config({ retryAttempts: 2 }), logger });
    mistral.moderations.push(...Array.from({ length: 20 }, () => ({ status: 503 })));
    expect(await failure(patient.texts(['a']))).toBeInstanceOf(Error);
  }, 10_000);
});
