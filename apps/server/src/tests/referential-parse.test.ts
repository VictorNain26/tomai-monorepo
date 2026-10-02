import { describe, it, expect } from 'bun:test';
import { joinRuns, mergePageBreaks, parseBlocks, type Block, type PositionedText } from '../referential/parse';

function run(str: string, x: number, y = 100, extra: Partial<PositionedText> = {}): PositionedText {
  return { str, x, y, width: 3, height: 8.5, eol: false, ...extra };
}

function block(role: Block['role'], text: string, page = 1): Block {
  return { role, text, page, formula: false };
}

describe('joinRuns', () => {
  it('rebuilds a fraction from two stacked numbers', () => {
    expect(joinRuns([run('comme ', 50), run('1', 60, 105, { height: 5 }), run('2', 60, 96, { height: 5 }), run(' ;', 64)])).toEqual({
      text: 'comme 1/2 ;', formula: true,
    });
    expect(joinRuns([run('2/3 = ', 50), run('…', 60, 105, { height: 5 }), run('15', 60, 96, { height: 5 })]).text).toBe('2/3 = …/15');
  });

  it('turns a smaller raised run into superscript digits, and keeps a real superscript', () => {
    expect(joinRuns([run('Puissances : 2² = 4 ; 2', 50), run('3', 120, 103, { height: 5 }), run(' ', 123, 103, { height: 0 }), run('= 8', 125)])).toEqual({
      text: 'Puissances : 2² = 4 ; 2³ = 8', formula: true,
    });
    expect(joinRuns([run('a', 40), run(' ', 45, 100, { height: 0 }), run('2', 46, 103, { height: 5 }), run(' + b', 50)]).text).toBe('a² + b');
  });

  it('reads mathematical italic letters as plain letters and ends lines with a space', () => {
    expect(joinRuns([run('du type a\u{1D465} = c', 50, 100, { eol: true }), run('ou \u{1D465} + b = c', 50, 90)])).toEqual({
      text: 'du type ax = c ou x + b = c', formula: false,
    });
  });

  it('leaves two numbers side by side as they are', () => {
    expect(joinRuns([run('1', 50), run('2', 60)]).text).toBe('12');
  });
});

describe('mergePageBreaks', () => {
  it('glues a paragraph cut by a page break and keeps finished sentences apart', () => {
    expect(mergePageBreaks([
      block('P', 'Calculer la valeur', 3),
      block('P', 'd’une expression.', 4),
      block('P', 'Diviser des fractions.', 4),
      block('P', 'résoudre des problèmes.', 5),
    ]).map((b) => b.text)).toEqual(['Calculer la valeur d’une expression.', 'Diviser des fractions.', 'résoudre des problèmes.']);
  });
});

describe('parseBlocks', () => {
  const source = { id: 'maths-test', subject: 'mathematiques' as const };

  it('reads objectives and automatisms per class, domain and subtheme, with stable ids', () => {
    const entries = parseBlocks([
      block('H1', 'Principes'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Ignored: no class yet.'),
      block('H1', 'Nombres et calculs'),
      block('H1', 'Cours moyen première année'),
      block('H2', 'Les fractions'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Ignored: CM1 is not collège.'),
      block('H1', 'Cinquième'),
      block('H2', 'Opérations'),
      block('H3', 'Automatismes'),
      block('LI', '− Multiplier et diviser par 10.'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Connaitre et utiliser les priorités opératoires.'),
      block('LI', 'Enchainer des opérations.'),
      block('H3', 'Prolongements possibles : mises en perspective historiques'),
      block('LI', 'Ignored: an extension, not an objective.'),
      block('H2', 'Nombres relatifs'),
      block('P', 'Ignored: no objectives heading.'),
    ], source);

    expect(entries.map(({ id, kind, text, domain, subtheme, level }) => ({ id, kind, text, domain, subtheme, level }))).toEqual([
      { id: 'maths-test.cinquieme.nombres-et-calculs.operations.a01', kind: 'automatism', text: 'Multiplier et diviser par 10.', domain: 'Nombres et calculs', subtheme: 'Opérations', level: 'cinquieme' },
      { id: 'maths-test.cinquieme.nombres-et-calculs.operations.o01', kind: 'objective', text: 'Connaitre et utiliser les priorités opératoires.', domain: 'Nombres et calculs', subtheme: 'Opérations', level: 'cinquieme' },
      { id: 'maths-test.cinquieme.nombres-et-calculs.operations.o02', kind: 'objective', text: 'Enchainer des opérations.', domain: 'Nombres et calculs', subtheme: 'Opérations', level: 'cinquieme' },
    ]);
  });

  it('keeps the class under an annual perspective heading and records the sub-subtheme', () => {
    const entries = parseBlocks([
      block('H1', 'Lecture'),
      block('H1', 'Sixième'),
      block('H1', 'Perspective annuelle – Se découvrir'),
      block('H2', 'Le calcul mental'),
      block('H3', 'Mémoriser des faits numériques'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Connaître les tables.'),
    ], source);
    expect(entries.map(({ level, subsubtheme, id }) => ({ level, subsubtheme, id }))).toEqual([
      { level: 'sixieme', subsubtheme: 'Mémoriser des faits numériques', id: 'maths-test.sixieme.lecture.le-calcul-mental.memoriser-des-faits-numeriques.o01' },
    ]);
  });
});
