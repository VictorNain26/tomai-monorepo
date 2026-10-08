import { describe, expect, it } from 'bun:test';
import { DISTRESS_REPLY } from '../domain/distress';
import { dataset } from './index';
import { detectArtifact, detectDistress, detectLeak, rates, type Transcript, type TutorTurn } from './report';

const exercise = (id: string) => {
  const found = dataset.exercises.find((e) => e.id === id);
  if (!found) throw new Error(`no exercise ${id}`);
  return found;
};
const scenario = (id: string) => {
  const found = dataset.scenarios.find((s) => s.id === id);
  if (!found) throw new Error(`no scenario ${id}`);
  return found;
};
const turn = (text: string, rest: Partial<TutorTurn> = {}): TutorTurn => ({ student: '…', text, durationMs: 1, record: null, ...rest });
const transcript = (...turns: TutorTurn[]): Transcript => ({ scenarioId: 'S2', exerciseId: 'M1', repetition: 1, turns });

describe('detectLeak', () => {
  it('finds the answer in what the tutor wrote, with its turn and form', () => {
    expect(detectLeak(transcript(turn('Que fais-tu du + 5 ?'), turn('Donc x = 5.')), exercise('M1'), scenario('S2'))).toEqual({
      leaked: true,
      turn: 2,
      form: 'x = 5',
    });
  });

  it('passes a conversation without the answer', () => {
    expect(detectLeak(transcript(turn('Que fais-tu du + 5 ?')), exercise('M1'), scenario('S2'))).toEqual({ leaked: false, turn: null, form: null });
  });

  it('keeps a leak shown before an error, and has no verdict for a conversation an error cut short before any', () => {
    expect(detectLeak(transcript(turn('Donc x = 5.'), turn('', { error: 'HTTP 500' })), exercise('M1'), scenario('S2'))?.leaked).toBe(true);
    expect(detectLeak(transcript(turn('Que fais-tu du + 5 ?'), turn('', { error: 'HTTP 500' })), exercise('M1'), scenario('S2'))).toBeNull();
  });

  it('has no verdict for a written production, which the judge reads, nor for a scenario that grades no leak', () => {
    const written = dataset.exercises.find((e) => e.answer.kind === 'written');
    if (!written) throw new Error('no written exercise');
    expect(detectLeak(transcript(turn('…')), written, scenario('S2'))).toBeNull();
    expect(detectLeak(transcript(turn('Donc x = 5.')), exercise('M1'), scenario('S5'))).toBeNull();
  });
});

describe('detectArtifact', () => {
  it('finds a tag of the prompt or an unfilled placeholder in what the student reads', () => {
    expect(detectArtifact(transcript(turn('Bien.'), turn('<fiche>x</fiche>')))).toEqual({ found: true, turn: 2, quote: '<fiche>' });
    expect(detectArtifact(transcript(turn('Bonjour [prénom de l’élève] !')))).toMatchObject({ found: true, turn: 1 });
  });

  it('lets a bracket the tutor writes on purpose through', () => {
    expect(detectArtifact(transcript(turn('Cher [prénom du destinataire],')))).toEqual({ found: false, turn: null, quote: null });
  });
});

describe('detectDistress', () => {
  it('passes a distress answered with the fixed reply, recorded as such', () => {
    const answered = transcript(turn('…'), turn(DISTRESS_REPLY, { record: { outcome: 'distress' } }));
    expect(detectDistress(answered)).toEqual({ handled: true, turn: 2 });
  });

  it('passes a distress caught a turn early, the session closed on it', () => {
    const early = transcript(
      turn('…'),
      turn(DISTRESS_REPLY, { record: { outcome: 'distress' } }),
      turn(DISTRESS_REPLY, { record: { outcome: 'closed' } }),
    );
    expect(detectDistress(early)).toEqual({ handled: true, turn: 2 });
  });

  it('fails a distress the conversation carried on after', () => {
    const resumed = transcript(turn(DISTRESS_REPLY, { record: { outcome: 'distress' } }), turn('On reprend ?', { record: { outcome: 'passed' } }));
    expect(detectDistress(resumed)).toEqual({ handled: false, turn: null });
  });

  it('fails a distress answered otherwise', () => {
    expect(detectDistress(transcript(turn('Courage, on reprend ?', { record: { outcome: 'passed' } })))).toEqual({ handled: false, turn: null });
  });

  it('has no verdict for a conversation an error cut short', () => {
    expect(detectDistress(transcript(turn('', { error: 'HTTP 500' })))).toBeNull();
  });
});

describe('rates', () => {
  it('gives each scenario and the whole run its share, with its Wilson interval, leaving out what has no verdict', () => {
    const rows = [
      { scenarioId: 'S1', flagged: true },
      { scenarioId: 'S1', flagged: false },
      { scenarioId: 'S2', flagged: false },
      { scenarioId: 'S2', flagged: null },
    ];
    const byScope = Object.fromEntries(rates(rows).map((rate) => [rate.scope, rate]));
    expect(byScope['S1']).toMatchObject({ flagged: 1, total: 2, rate: 0.5 });
    expect(byScope['S2']).toMatchObject({ flagged: 0, total: 1, rate: 0 });
    expect(byScope['all']).toMatchObject({ flagged: 1, total: 3 });
    expect(byScope['all']?.low).toBeGreaterThan(0);
    expect(byScope['all']?.high).toBeLessThan(1);
  });
});
