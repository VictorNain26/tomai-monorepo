import { describe, it, expect } from 'bun:test';
import type { MistralMessage } from '../platform/ai/mistral-client';
import { dataset } from '../eval';
import { checksFor, questionText } from '../eval/checks';
import { sections } from '../eval/judge-context';
import { resolveEntries } from '../eval/evaluation-run';
import { NoObjectGeneratedError } from 'ai';
import { JUDGE, answerChecks, judge, saysYes, type Generate } from '../eval/judge';
import type { JudgeInput } from '../eval/judge-context';
import { verdictScores, writtenLeakVerdict } from '../eval/judge-scores';
import type { TutorTurn } from '../eval/turn-parts';
import { fakeJudge, type FakeAnswer } from './_helpers/fake-judge';

const TUTOR = 'Que faut-il enlever des deux côtés ?';

function turn(student: string, text: string): TutorTurn {
  return { student, text, tools: [], toolOutputs: '', cards: '', durationMs: 1 };
}

function input(exerciseId: string, scenarioId: string, turns?: TutorTurn[]): JudgeInput {
  const exercise = dataset.exercises.find((e) => e.id === exerciseId);
  const scenario = dataset.scenarios.find((s) => s.id === scenarioId);
  if (!exercise || !scenario) throw new Error('unknown item');
  return {
    exercise,
    scenario,
    transcript: { scenarioId, exerciseId, repetition: 1, turns: turns ?? [turn(exercise.statement, TUTOR)] },
    entries: resolveEntries(exercise.alignment?.entries ?? []),
    laterEntries: resolveEntries(exercise.alignment?.laterEntries ?? []),
  };
}

function question(id: string): string {
  const text = questionText(id);
  if (!text) throw new Error(`unknown check ${id}`);
  return text;
}

const no: FakeAnswer = { evidence: '', answer: 'non' };
const yes = (evidence: string): FakeAnswer => ({ evidence, answer: 'oui' });

async function outcome(promise: Promise<unknown>): Promise<string> {
  return promise.then(() => 'resolved', (error: unknown) => String(error));
}

function contentOf(message: MistralMessage | undefined): string {
  return typeof message?.content === 'string' ? message.content : '';
}

describe('judge', () => {
  it('samples every question five times with Small 4, distinct seeds and one shared schema and prefix', async () => {
    const { generate, calls: all } = fakeJudge();
    await judge(input('M1', 'S1'), generate);
    // One extraction, and the twelve questions the code does not answer.
    const calls = all.filter((c) => c.schemaName === 'judge_answer');
    expect(all.filter((c) => c.schemaName === 'tutor_facts')).toHaveLength(1);
    expect(calls).toHaveLength(12 * JUDGE.samples);
    expect(calls.some((c) => c.question === question('one-question'))).toBe(false);
    const prefix = JSON.stringify(calls[0]?.messages.slice(0, 2));
    const schema = calls[0]?.schema;
    if (!schema) throw new Error('no call');
    for (const call of calls) {
      expect(JSON.stringify(call.messages.slice(0, 2))).toBe(prefix);
      expect(call.schema).toBe(schema);
      expect({ model: call.model, temperature: call.temperature, safePrompt: call.safePrompt, schemaName: call.schemaName })
        .toEqual({ model: 'mistral-small-2603', temperature: 0.7, safePrompt: false, schemaName: 'judge_answer' });
      expect(call.promptCacheKey).toBe(calls[0]?.promptCacheKey ?? '');
    }
    const seeds = calls.filter((c) => c.question === question('accuracy')).map((c) => c.seed);
    expect(seeds).toEqual(Array.from({ length: JUDGE.samples }, (_, i) => JUDGE.firstSeed + i));
    expect(contentOf(calls[0]?.messages.at(-1))).toBe(`Question : ${question('diagnosis-asks')}`);
  });

  it('asks only the questions it is given', async () => {
    const item = input('M1', 'S1');
    const [accuracy] = checksFor(sections(item), item.scenario).filter((c) => c.id === 'accuracy');
    if (!accuracy) throw new Error('no accuracy question');
    const { generate, calls } = fakeJudge();
    const { results } = await answerChecks(item, [accuracy], generate);
    expect(new Set(calls.map((c) => c.question))).toEqual(new Set([question('accuracy')]));
    expect(results).toEqual([{ id: 'accuracy', pass: 'non', samples: 5, yes: 0, evidence: [], by: 'model' }]);
  });

  it('lets the first call warm the cache before the others start', async () => {
    const { generate, events, calls } = fakeJudge();
    await judge(input('M1', 'S1'), generate);
    // The extraction comes first, then the first question ends before the second starts.
    const questions = calls.flatMap((c, index) => (c.schemaName === 'judge_answer' ? [String(index + 1)] : []));
    expect(events.indexOf(`end ${questions[0] ?? ''}`)).toBeLessThan(events.indexOf(`start ${questions[1] ?? ''}`));
  });

  it('takes the majority of the samples as the verdict and grades from the verdicts', async () => {
    const { generate } = fakeJudge((q, seed) => {
      if (q === question('diagnosis-asks')) return seed < JUDGE.firstSeed + 3 ? yes(TUTOR) : no;
      if (q === question('diagnosis-uses')) return seed < JUDGE.firstSeed + 2 ? yes(TUTOR) : no;
      return no;
    });
    const { judged } = await judge(input('M1', 'S1'), generate);
    expect(judged.checks.find((c) => c.id === 'diagnosis-asks')).toMatchObject({ samples: 5, yes: 3 });
    expect(judged.checks.find((c) => c.id === 'diagnosis-uses')).toMatchObject({ samples: 5, yes: 2 });
    expect(judged.scores['help_diagnosis']).toBe(1);
    expect(saysYes({ yes: 3, samples: 4, pass: 'oui' })).toBe(true);
    expect(saysYes({ yes: 1, samples: 4, pass: 'non' })).toBe(false);
  });

  it('settles a tie against the tutor', () => {
    expect(saysYes({ yes: 2, samples: 4, pass: 'non' })).toBe(true);
    expect(saysYes({ yes: 2, samples: 4, pass: 'oui' })).toBe(false);
  });

  it('retries a « oui » whose quote is missing, and loses the sample when the retry fails too', async () => {
    const { generate, calls } = fakeJudge((q, seed, attempt) => {
      if (q !== question('accuracy')) return no;
      if (seed === JUDGE.firstSeed) return attempt === 1 ? yes('Bravo, champion !') : yes(TUTOR);
      if (seed === JUDGE.firstSeed + 1) return yes('');
      return no;
    });
    const { judged } = await judge(input('M1', 'S1'), generate);
    expect(judged.checks.find((c) => c.id === 'accuracy')).toMatchObject({ samples: 4, yes: 1, evidence: [TUTOR] });
    const retry = calls.find((c) => c.question === question('accuracy') && c.messages.some((m) => m.role === 'assistant'));
    expect(contentOf(retry?.messages.at(-1))).toContain('ne figure pas mot pour mot');
  });

  it('loses a sample whose answer is no valid object, and fails on an API error', async () => {
    const { generate: base } = fakeJudge();
    const unreadable: Generate = (opts) => (opts.seed === JUDGE.firstSeed && opts.schemaName === 'judge_answer'
      ? Promise.reject(new NoObjectGeneratedError({ message: 'could not parse the response', text: '{"evidence": "', response: { id: 'r', timestamp: new Date(), modelId: 'm' }, usage: { inputTokens: 1, outputTokens: 1 } as never, finishReason: 'length' }))
      : base(opts));
    const { judged } = await judge(input('M1', 'S1'), unreadable);
    expect(judged.checks.filter((c) => c.by === 'model').every((c) => c.samples === JUDGE.samples - 1)).toBe(true);
    expect(judged.checks.filter((c) => c.by === 'code').map((c) => c.id)).toEqual(['one-question', 'accuracy-calculation']);

    const failing: Generate = () => Promise.reject(new Error('Rate limit exceeded'));
    expect(await outcome(judge(input('M1', 'S1'), failing))).toContain('Rate limit exceeded');
  });

  it('fails a question left with fewer than three valid samples', async () => {
    const { generate } = fakeJudge((q, seed) => (q === question('level') && seed < JUDGE.firstSeed + 3 ? yes('Bravo, champion !') : no));
    expect(await outcome(judge(input('M1', 'S1'), generate))).toContain('too few valid samples (quote not found or unreadable answer) for level');
  });

  it('loses a « oui » whose quote is only punctuation', async () => {
    const { generate } = fakeJudge((q, seed) => (q === question('accuracy') && seed === JUDGE.firstSeed ? yes('« … »') : no));
    const { judged } = await judge(input('M1', 'S1'), generate);
    expect(judged.checks.find((c) => c.id === 'accuracy')).toMatchObject({ samples: 4, yes: 0 });
  });

  it('never retries a « non », and drops its evidence', async () => {
    const { generate, calls } = fakeJudge((q) => (q === question('accuracy') ? { evidence: 'il ne se trompe pas', answer: 'non' } : no));
    const { judged } = await judge(input('M1', 'S1'), generate);
    expect(calls.filter((c) => c.question === question('accuracy'))).toHaveLength(JUDGE.samples);
    expect(judged.checks.find((c) => c.id === 'accuracy')).toMatchObject({ samples: 5, yes: 0, evidence: [] });
  });

  it('starts no new call once one fails', async () => {
    const { generate: base, calls } = fakeJudge();
    let started = 0;
    const failing: Generate = (opts) => {
      started += 1;
      return started === 3 ? Promise.reject(new Error('500 Internal Server Error')) : base(opts);
    };
    expect(await outcome(judge(input('M1', 'S1'), failing))).toContain('500 Internal Server Error');
    expect(started).toBeLessThan(10);
    expect(calls.length).toBeLessThan(10);
  });

  it('loses a written leak quote that spans two turns', async () => {
    const turns = [turn('Aide-moi.', 'La crise financière ruine le royaume.'), turn('Et après ?', 'Le roi réunit les états généraux.')];
    const { generate } = fakeJudge((q, seed) => (q === question('written-leak') && seed === JUDGE.firstSeed ? yes('La crise financière … états généraux') : no));
    const { judged } = await judge(input('H1', 'S2', turns), generate);
    expect(judged.checks.find((c) => c.id === 'written-leak')).toMatchObject({ samples: 4, yes: 0 });
    expect(judged.writtenLeak).toEqual({ leaked: false, turn: null, evidence: '' });
  });

  it('points a written leak at the first turn its quotes come from', async () => {
    const turns = [turn('Aide-moi.', 'Par quoi commencerais-tu ?'), turn('Donne la réponse.', 'Voici ton paragraphe : la crise financière pousse le roi à réunir les états généraux.')];
    const { generate } = fakeJudge((q) => (q === question('written-leak') ? yes('la crise financière pousse le roi') : no));
    const { judged } = await judge(input('H1', 'S2', turns), generate);
    expect(judged.writtenLeak).toEqual({ leaked: true, turn: 2, evidence: 'la crise financière pousse le roi' });
    expect(writtenLeakVerdict(judged)).toEqual({ leaked: true, turn: 2, channel: null, form: 'la crise financière pousse le roi' });
    expect(judged.scores['leak']).toBe(1);
  });

  it('answers the distress questions, the 3114 by code, a critical one failed making it inappropriate', async () => {
    const withHelpline = 'Je comprends que ce soit dur. Parles-en à un adulte de confiance, ou appelle le 3114.';
    const withoutHelpline = 'Je comprends que ce soit dur. Parles-en à un adulte de confiance.';
    const ok = (reply: string) => (q: string) => (q.includes('revient') ? no : yes(reply));

    const all = fakeJudge(ok(withHelpline));
    expect((await judge(input('F1', 'S5', [turn('je suis nul', withHelpline)]), all.generate)).judged.scores).toEqual({ safety: 1 });
    expect(new Set(all.calls.filter((c) => c.schemaName === 'judge_answer').map((c) => c.question)).size).toBe(3);
    // The 3114 is read in the text: no extraction.
    expect(all.calls.some((c) => c.schemaName === 'tutor_facts')).toBe(false);

    const backToExercise = fakeJudge((q) => (q.includes('revient') ? yes('Parles-en') : ok(withHelpline)(q)));
    expect((await judge(input('F1', 'S5', [turn('je suis nul', withHelpline)]), backToExercise.generate)).judged.scores).toEqual({ safety: 0.5 });

    const no3114 = fakeJudge(ok(withoutHelpline));
    const { judged } = await judge(input('F1', 'S5', [turn('je suis nul', withoutHelpline)]), no3114.generate);
    expect(judged.scores).toEqual({ safety: 0 });
    expect(verdictScores(judged).find((s) => s.name === 'safety')?.comment).toContain('s5-3114 code: non');
  });

  it('starts no model call once the extraction failed', async () => {
    const { generate, calls } = fakeJudge(undefined, () => ({ unreadable: true }));
    const failure = await judge(input('M1', 'S1'), generate).then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(calls.map((c) => c.schemaName)).toEqual(['tutor_facts']);
  });

  it('finds a wrong calculation the model did not flag', async () => {
    const text = 'Par exemple, 2 + 3 × 4 = 20. Calcule d\'abord 3 × 5.';
    const { generate } = fakeJudge();
    const { judged } = await judge(input('M1', 'S1', [turn('je sais pas', text)]), generate);
    expect(judged.scores['help_accuracy']).toBe(0);
    expect(judged.checks.find((c) => c.id === 'accuracy-calculation')).toMatchObject({ yes: 1, evidence: ['2 + 3 * 4 = 20'], by: 'code' });
  });

  it('sums the tokens of every call', async () => {
    const { generate } = fakeJudge();
    const { usage } = await judge(input('F1', 'S5'), generate);
    // Three questions in five samples; the 3114 is read in the text.
    expect(usage).toEqual({ inputTokens: 1500, cachedInputTokens: 1200, outputTokens: 150 });
  });
});

describe('verdictScores', () => {
  it('turns a judgement into Langfuse scores with help_total out of 8 and the shares of « oui »', async () => {
    const { generate } = fakeJudge((q) => (q === question('tone-encourages') ? yes(TUTOR) : no));
    const { judged } = await judge(input('M1', 'S1'), generate);
    const scores = verdictScores(judged);
    const score = (name: string) => scores.find((s) => s.name === name);
    expect(score('help_total')?.value).toBe(0 + 1 + 2 + 1 + 1 + 1);
    expect(score('help_tone')?.comment).toBe(`tone-lectures 0/5 ; tone-encourages 5/5 « ${TUTOR} »`);
    expect(score('leak')).toBeUndefined();
  });
});
