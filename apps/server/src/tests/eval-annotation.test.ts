import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { CRITERIA, agreement, criteriaFor, fileValues, humanValues, judgeValues, labelValues, labelsFile, matchesCriterion, measures, queueChanges, queueValues, toJudge } from '../eval/annotation';
import { sections, type Verdict } from '../eval/judge';
import { gradable, parseResults, type ResultsFile } from '../eval/results';

function wanted(exerciseId: string, scenarioId: string) {
  const exercise = dataset.exercises.find((e) => e.id === exerciseId);
  const scenario = dataset.scenarios.find((s) => s.id === scenarioId);
  if (!exercise || !scenario) throw new Error('unknown item');
  return sections({ exercise, scenario });
}

const graded = <S extends string>(score: S) => ({ evidence: '', score });

describe('CRITERIA', () => {
  it('fit Langfuse score configs: unique names of 35 characters at most, unique labels', () => {
    const names = CRITERIA.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const { name, categories } of CRITERIA) {
      expect(name.length).toBeLessThanOrEqual(35);
      expect(new Set(categories.map((c) => c.label)).size).toBe(categories.length);
    }
  });

  it('recognise a stored config whatever the order of its category keys, and only an identical one', () => {
    const [tone] = CRITERIA.filter((c) => c.name === 'help_tone');
    if (!tone) throw new Error('help_tone missing');
    const stored = { description: tone.description, categories: [{ label: '0', value: 0 }, { label: '1', value: 1 }] };
    expect(matchesCriterion(stored, tone)).toBe(true);
    expect(matchesCriterion({ ...stored, description: 'old anchor' }, tone)).toBe(false);
    expect(matchesCriterion({ ...stored, categories: [{ label: '1', value: 1 }, { label: '0', value: 0 }] }, tone)).toBe(false);
  });

  it('ask the human what the judge grades for the item', () => {
    expect(criteriaFor(wanted('M1', 'S1'))).toEqual([
      'help_diagnosis', 'help_one_question', 'help_graded_hints', 'help_accuracy', 'help_level', 'help_tone',
      'language_level', 'alignment_in_class', 'alignment_later_used',
    ]);
    expect(criteriaFor(wanted('H1', 'S2'))).toContain('leak');
    expect(criteriaFor(wanted('H1', 'S2'))).not.toContain('alignment_in_class');
    expect(criteriaFor(wanted('F1', 'S5'))).toEqual(['safety']);
  });
});

describe('queueChanges', () => {
  it('removes the pending items of another run and never an annotated one', () => {
    const items = [
      { objectId: 'old-pending', status: 'PENDING' },
      { objectId: 'old-done', status: 'COMPLETED' },
      { objectId: 'new', status: 'PENDING' },
    ];
    const { keep, remove } = queueChanges(items, new Set(['new', 'newer']));
    expect(remove.map((i) => i.objectId)).toEqual(['old-pending']);
    expect(keep.map((i) => i.objectId)).toEqual(['old-done', 'new']);
  });
});

describe('judgeValues', () => {
  it('puts the verdict on the human scales', () => {
    const verdict: Verdict = {
      help: {
        diagnosis: graded('2'), oneQuestion: graded('1'), gradedHints: graded('0'), accuracy: graded('1'),
        level: graded('1'), tone: graded('0'), languageLevel: { evidence: '', rating: 'partly' },
        alignment: { evidence: '', inClass: 'no', laterNotionsUsed: ['x'] },
      },
      writtenLeak: { evidence: 'texte', leaked: true, turn: 1 },
      safety: null,
    };
    const values = judgeValues(verdict);
    expect(values.get('help_diagnosis')).toBe(2);
    expect(values.get('language_level')).toBe(0.5);
    expect(values.get('alignment_in_class')).toBe(0);
    expect(values.get('alignment_later_used')).toBe(1);
    expect(values.get('leak')).toBe(1);
    expect(values.has('safety')).toBe(false);
  });
});

describe('humanValues', () => {
  it('keeps the latest grade of each criterion, back on its value, and ignores unknown labels', () => {
    const values = humanValues([
      { name: 'help_diagnosis', label: '1', timestamp: '2026-10-03T10:00:00Z' },
      { name: 'help_diagnosis', label: '2', timestamp: '2026-10-03T11:00:00Z' },
      { name: 'language_level', label: 'adapted', timestamp: '2026-10-03T10:00:00Z' },
      { name: 'help_tone', label: 'maybe', timestamp: '2026-10-03T10:00:00Z' },
      { name: 'unrelated', label: '1', timestamp: '2026-10-03T10:00:00Z' },
    ]);
    expect([...values]).toEqual([['help_diagnosis', 2], ['language_level', 1]]);
  });
});

describe('humanValues timestamps', () => {
  it('compares grade times as dates, whatever their precision', () => {
    const values = humanValues([
      { name: 'help_tone', label: '1', timestamp: '2026-10-03T10:00:00.500Z' },
      { name: 'help_tone', label: '0', timestamp: '2026-10-03T10:00:00Z' },
    ]);
    expect(values.get('help_tone')).toBe(1);
  });
});

describe('queueValues', () => {
  it('groups categorical grades on traces, and ignores the others', () => {
    const at = '2026-10-03T10:00:00Z';
    const values = queueValues([
      { name: 'help_tone', dataType: 'CATEGORICAL', value: '1', timestamp: at, subject: { kind: 'trace', id: 'a' } },
      { name: 'safety', dataType: 'CATEGORICAL', value: 'partly', timestamp: at, subject: { kind: 'trace', id: 'b' } },
      { name: 'help_level', dataType: 'CATEGORICAL', value: '0', timestamp: at, subject: { kind: 'observation', id: 'o' } },
      { name: 'help_level', dataType: 'NUMERIC', value: 0, timestamp: at, subject: { kind: 'trace', id: 'a' } },
      { name: 'help_level', dataType: 'CATEGORICAL', value: '0', timestamp: at },
      { name: 'unrelated', dataType: 'CATEGORICAL', value: '1', timestamp: at, subject: { kind: 'trace', id: 'c' } },
    ]);
    expect([...values].map(([trace, grades]) => [trace, [...grades]])).toEqual([
      ['a', [['help_tone', 1]]],
      ['b', [['safety', 0.5]]],
    ]);
  });
});

describe('fileValues', () => {
  const rows = [{ traceId: 't1', scenarioId: 'S1', exerciseId: 'M1', repetition: 1 }];
  const file = (key: string, traceId: string) => labelsFile.parse({
    annotator: 'a', date: 'd', results: 'r', conversations: [{ key, traceId, labels: { help_tone: { label: '1', evidence: '' } } }],
  });

  it('reads the grades of the run it annotates', () => {
    expect([...fileValues(file('S1:M1:1', 't1'), rows)]).toEqual([['t1', new Map([['help_tone', 1]])]]);
  });

  it('fails on a conversation of another run, or under another key', () => {
    expect(() => fileValues(file('S1:M1:1', 'other'), rows)).toThrow('are not a conversation of this run');
    expect(() => fileValues(file('S2:M1:1', 't1'), rows)).toThrow('are not a conversation of this run');
  });
});

describe('parseResults', () => {
  it('reads an eval-results file, keeping a turn error only when there is one', () => {
    const turn = { student: 's', text: 't', tools: [], toolOutputs: '', cards: '', durationMs: 1 };
    const results = parseResults({
      runName: 'r', judge: null, model: 'm', report: [{
        scenarioId: 'S1', exerciseId: 'M1', repetition: 1, traceId: 'a',
        transcript: { scenarioId: 'S1', exerciseId: 'M1', repetition: 1, turns: [turn, { ...turn, error: 'aborted' }] },
      }],
    });
    const turns = results.report[0]?.transcript?.turns ?? [];
    expect('error' in (turns[0] ?? {})).toBe(false);
    expect(turns[1]).toEqual({ ...turn, error: 'aborted' });
    expect(() => parseResults({ runName: 'r', judge: null, report: [{ scenarioId: 'S1' }] })).toThrow();
  });
});

describe('labelValues', () => {
  it('reads the grades of a labels file on their values, and fails on one the grid lacks', () => {
    const file = labelsFile.parse({
      annotator: 'claude-opus-5-5', date: '2026-10-03', results: 'r.json',
      conversations: [{ key: 'S1:M1:1', traceId: 't', labels: { help_diagnosis: { label: '2', evidence: 'q' }, safety: { label: 'partly', evidence: '' } } }],
    });
    expect([...labelValues(file.conversations[0]?.labels ?? {})]).toEqual([['help_diagnosis', 2], ['safety', 0.5]]);
    expect(() => labelValues({ help_diagnosis: { label: '3' } })).toThrow('unknown grade help_diagnosis = 3');
    expect(() => labelValues({ made_up: { label: '1' } })).toThrow('unknown grade made_up = 1');
  });
});

describe('agreement', () => {
  it('pairs the grades every coder gave, and splits safety per scenario', () => {
    const lines = agreement([
      { scenarioId: 'S1', coders: [new Map([['help_tone', 1], ['help_level', 1]]), new Map([['help_tone', 1]])] },
      { scenarioId: 'S1', coders: [new Map([['help_tone', 0]]), new Map([['help_tone', 0]])] },
      { scenarioId: 'S4', coders: [new Map([['safety', 1]]), new Map([['safety', 0.5]])] },
      { scenarioId: 'S5', coders: [new Map([['safety', 0]]), new Map([['safety', 0]])] },
    ]);
    expect(lines.map(({ criterion, units, raw, alpha }) => ({ criterion, units, raw, alpha }))).toEqual([
      { criterion: 'help_tone', units: 2, raw: 1, alpha: 1 },
      { criterion: 'safety_S4', units: 1, raw: 0, alpha: 0 },
      { criterion: 'safety_S5', units: 1, raw: 1, alpha: null },
    ]);
  });

  it('measures several passes of one coder: raw agreement needs every pass to match', () => {
    const pass = (tone: number) => new Map([['help_tone', tone]]);
    const [line] = agreement([
      { scenarioId: 'S1', coders: [pass(1), pass(1), pass(1)] },
      { scenarioId: 'S1', coders: [pass(0), pass(0), pass(1)] },
      { scenarioId: 'S1', coders: [pass(0), pass(0), pass(0)] },
    ]);
    expect(line?.units).toBe(3);
    expect(line?.raw).toBeCloseTo(2 / 3, 12);
  });
});

describe('agreement with a missing grade', () => {
  it('keeps a unit two coders graded, and drops one only a single coder graded', () => {
    const tone = (value: number) => new Map([['help_tone', value]]);
    const [line] = agreement([
      { scenarioId: 'S1', coders: [tone(1), new Map(), tone(1)] },
      { scenarioId: 'S1', coders: [tone(0), tone(0), tone(0)] },
      { scenarioId: 'S1', coders: [tone(1), new Map(), new Map()] },
    ]);
    expect(line?.units).toBe(2);
    expect(line?.raw).toBe(1);
  });
});

describe('measures', () => {
  const tone = (value: number) => new Map([['help_tone', value]]);

  it('measures agreement on the first pass and reproducibility on all of them', () => {
    const { agreement: withHuman, stability } = measures([
      { scenarioId: 'S1', human: tone(1), passes: [tone(1), tone(0)] },
      { scenarioId: 'S1', human: null, passes: [tone(0), tone(0)] },
    ]);
    expect(withHuman?.map(({ criterion, units, raw }) => ({ criterion, units, raw }))).toEqual([{ criterion: 'help_tone', units: 1, raw: 1 }]);
    expect(stability?.map(({ criterion, units, raw }) => ({ criterion, units, raw }))).toEqual([{ criterion: 'help_tone', units: 2, raw: 0.5 }]);
  });

  it('keeps a conversation whose pass failed, on the passes that succeeded', () => {
    const { agreement: withHuman, stability } = measures([
      { scenarioId: 'S1', human: tone(1), passes: [null, tone(1), tone(0)] },
      { scenarioId: 'S1', human: tone(0), passes: [tone(0), null, tone(0)] },
    ]);
    expect(withHuman?.[0]?.units).toBe(1);
    expect(stability?.[0]?.units).toBe(2);
    expect(stability?.[0]?.raw).toBe(0.5);
  });

  it('measures no reproducibility on a single pass, and no agreement without annotation', () => {
    expect(measures([{ scenarioId: 'S1', human: tone(1), passes: [tone(1)] }]).stability).toBeNull();
    expect(measures([{ scenarioId: 'S1', human: null, passes: [tone(1), tone(1)] }]).agreement).toBeNull();
  });
});

describe('toJudge', () => {
  const rows = [{ traceId: 'a' }, { traceId: 'b' }, { traceId: 'c' }];

  it('judges the annotated conversations on one pass, and the whole run on several', () => {
    expect(toJudge(rows, new Set(['b']), 1)).toEqual([{ traceId: 'b' }]);
    expect(toJudge(rows, new Set(['b']), 3)).toEqual(rows);
    expect(toJudge(rows, new Set(), 1)).toEqual([]);
  });
});

describe('gradable', () => {
  it('keeps the conversations played to the end that have a trace', () => {
    const turn = { student: 's', text: 't', tools: [], toolOutputs: '', cards: '', durationMs: 1 };
    const transcript = { scenarioId: 'S1', exerciseId: 'M1', repetition: 1, turns: [turn] };
    const results: ResultsFile = {
      runName: 'r',
      judge: null,
      report: [
        { scenarioId: 'S1', exerciseId: 'M1', repetition: 1, traceId: 'a', transcript },
        { scenarioId: 'S1', exerciseId: 'M2', repetition: 1, traceId: null, transcript },
        { scenarioId: 'S1', exerciseId: 'M3', repetition: 1, traceId: 'c', transcript: { ...transcript, turns: [{ ...turn, error: 'aborted' }] } },
        { scenarioId: 'S1', exerciseId: 'M4', repetition: 1, traceId: 'd', transcript: null },
      ],
    };
    expect(gradable(results).map((row) => row.traceId)).toEqual(['a']);
  });
});
