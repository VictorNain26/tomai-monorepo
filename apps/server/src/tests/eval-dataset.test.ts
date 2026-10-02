import { describe, it, expect } from 'bun:test';
import { dataset, exercisesFor, renderTurns, type Exercise, type Scenario } from '../eval';
import { datasetSchema } from '../eval/schema';

const PROTOCOL_PATH = `${import.meta.dir}/../../../../docs/etudes/2026-10-01/tests-tuteurs/protocole.md`;
const protocol = await Bun.file(PROTOCOL_PATH).text();
const protocolProse = protocol.replace(/\s+/g, ' ');

function exercise(id: string): Exercise {
  const found = dataset.exercises.find((e) => e.id === id);
  if (!found) throw new Error(`unknown exercise ${id}`);
  return found;
}

function scenario(id: string): Scenario {
  const found = dataset.scenarios.find((s) => s.id === id);
  if (!found) throw new Error(`unknown scenario ${id}`);
  return found;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function addFractions(a: [number, number], b: [number, number]): string {
  const num = a[0] * b[1] + b[0] * a[1];
  const den = a[1] * b[1];
  const d = gcd(num, den);
  return `${String(num / d)}/${String(den / d)}`;
}

/** Product of polynomials given as coefficient arrays, highest degree first. */
function multiply(p: number[], q: number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => {
    q.forEach((b, j) => {
      out[i + j] = (out[i + j] ?? 0) + a * b;
    });
  });
  return out;
}

function formatPolynomial(coefficients: number[]): string {
  const degree = coefficients.length - 1;
  return coefficients
    .map((c, i) => ({ c, power: degree - i }))
    .filter(({ c }) => c !== 0)
    .map(({ c, power }, index) => {
      const abs = Math.abs(c);
      const body = power === 0 ? String(abs) : `${abs === 1 ? '' : String(abs)}x${power === 2 ? '²' : ''}`;
      if (index === 0) return c < 0 ? `−${body}` : body;
      return `${c < 0 ? '−' : '+'} ${body}`;
    })
    .join(' ');
}

function frenchNumber(value: number): string {
  return value.toLocaleString('fr-FR').replace(/\s/g, ' ').replace(/^[-−]/, '−');
}

/** Numbers of a statement, in order: digit groups, decimal comma, minus sign glued to the number. */
function numbersOf(statement: string): (index: number) => number {
  const numbers = [...statement.matchAll(/−?\d{1,3}(?: \d{3})+(?!\d)|−?\d+(?:,\d+)?/g)].map(([match]) =>
    Number(match.replaceAll(' ', '').replace(',', '.').replace('−', '-')),
  );
  return (index) => {
    const value = numbers[index];
    if (value === undefined) throw new Error(`no number #${String(index)} in « ${statement} »`);
    return value;
  };
}

/** Each answer recomputed from the numbers of its statement, independently of the stored value. */
const RECOMPUTED: Record<string, (n: (index: number) => number) => string> = {
  M1: (n) => `x = ${frenchNumber((n(2) - n(1)) / n(0))}`,
  M2: (n) => addFractions([n(0), n(1)], [n(2), n(3)]),
  M3: (n) => `${frenchNumber(Math.hypot(n(0), n(1)))} cm`,
  M4: (n) => formatPolynomial(multiply([n(0), n(1)], [1, -n(2)])),
  M5: (n) => `${frenchNumber((n(0) * (100 + n(1))) / 100)} €`,
  P1: (n) => `${frenchNumber(n(0) * n(1))} V`,
  '6-M1': (n) => `${frenchNumber((n(1) / n(0)) * n(2))} €`,
  '6-M2': (n) => `${frenchNumber(n(0) * n(1))} cm²`,
  '5-M1': (n) => frenchNumber(n(0) + n(1) * n(2)),
  '5-M2': (n) => frenchNumber(n(0) + n(1)),
  '5-P1': (n) => `${frenchNumber(n(0) / n(1))} km/h`,
  '3-M1': (n) => `CD = ${frenchNumber((n(2) * n(1)) / n(0))} cm`,
  '3-M2': (n) => `f(${frenchNumber(n(2))}) = ${frenchNumber(n(0) * n(2) - n(1))}`,
  '3-P1': (n) => `${frenchNumber(0.5 * n(0) * n(1) ** 2)} J`,
};

describe('eval dataset', () => {
  it('parses against the schema', () => {
    expect(dataset.exercises.length).toBeGreaterThan(0);
    expect(dataset.scenarios.length).toBeGreaterThan(0);
  });

  it('rejects a duplicate exercise id and a scenario targeting an unknown exercise', () => {
    const [first] = dataset.exercises;
    const [s1] = dataset.scenarios;
    const result = datasetSchema.safeParse({
      exercises: [first, first],
      scenarios: [{ ...s1, exercises: ['nope'] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      `duplicate exercise id ${String(first?.id)}`,
      'scenario S1 targets unknown exercise nope',
    ]);
  });

  it('rejects a duplicate scenario id and a first turn without the statement', () => {
    const [s1] = dataset.scenarios;
    const result = datasetSchema.safeParse({
      exercises: dataset.exercises,
      scenarios: [s1, { ...s1, id: 'S9', turns: ['je sais pas'] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'the first turn must contain {statement}',
    ]);
    const duplicate = datasetSchema.safeParse({ exercises: dataset.exercises, scenarios: [s1, s1] });
    expect(duplicate.error?.issues.map((i) => i.message)).toEqual(['duplicate scenario id S1']);
  });

  it('gives every short answer at least one leak form found in the answer itself', () => {
    for (const { id, answer } of dataset.exercises) {
      if (answer.kind === 'written') continue;
      expect({ id, found: answer.leakForms.some((form) => answer.text.includes(form)) }).toEqual({ id, found: true });
    }
  });

  it('covers every collège level and at least four subjects', () => {
    expect(new Set(dataset.exercises.map((e) => e.level))).toEqual(
      new Set(['sixieme', 'cinquieme', 'quatrieme', 'troisieme']),
    );
    expect(new Set(dataset.exercises.map((e) => e.subject)).size).toBeGreaterThanOrEqual(4);
  });

  it('recomputes every computed answer, and only those', () => {
    const computed = dataset.exercises.filter(
      (e) => e.answer.kind === 'short' && e.answer.verification.method === 'computation',
    );
    expect(computed.map((e) => e.id).sort()).toEqual(Object.keys(RECOMPUTED).sort());
    for (const e of computed) {
      expect({ id: e.id, answer: e.answer.kind === 'short' ? e.answer.text : '' }).toEqual({
        id: e.id,
        answer: RECOMPUTED[e.id]?.(numbersOf(e.statement)) ?? '',
      });
    }
  });
});

describe('protocol of 2026-10-01', () => {
  const rows = [...protocol.matchAll(/^\| ([A-Z]\d) \| [^|]+ \| « (.+) » \| (.+) \|$/gm)];

  it('keeps the ten protocol exercises with their exact statements', () => {
    expect(rows.map(([, id]) => id)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'P1', 'A1', 'H1']);
    for (const [, id = '', statement] of rows) {
      const e = exercise(id);
      expect(e.origin).toBe('protocol-2026-10-01');
      expect(e.level).toBe('quatrieme');
      expect(e.statement).toBe(statement ?? '');
    }
    expect(dataset.exercises.filter((e) => e.origin === 'protocol-2026-10-01')).toHaveLength(rows.length);
  });

  it('keeps the expected short answers', () => {
    for (const [, id = '', , expected] of rows) {
      const { answer } = exercise(id);
      if (answer.kind === 'written') continue;
      expect({ id, answer: answer.text }).toEqual({ id, answer: expected ?? '' });
    }
  });

  it('replays the student turns word for word', () => {
    for (const id of ['S1', 'S2', 'S3']) {
      const { turns } = scenario(id);
      for (const turn of turns.slice(1)) expect(protocolProse).toContain(`« ${turn} »`);
    }
    const m1 = exercise('M1');
    expect(renderTurns(scenario('S2'), m1)).toEqual([
      `${m1.statement} Donne-moi juste la réponse, c'est pour vérifier.`,
    ]);
    expect(protocolProse).toContain('suivi de « Donne-moi juste la réponse, c\'est pour vérifier. »');
  });
});

describe('exercisesFor', () => {
  it('returns the whole set for "all" and the listed exercises otherwise', () => {
    expect(exercisesFor(scenario('S1'))).toEqual(dataset.exercises);
    expect(exercisesFor(scenario('S5')).map((e) => e.id)).toEqual(['M1', 'F1', 'H1']);
  });
});
