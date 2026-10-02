import { describe, it, expect } from 'bun:test';
import { joinRuns, mergePageBreaks, parseBlocks, type Block, type PositionedText } from '../referential/parse';

function run(str: string, x: number, y = 100, extra: Partial<PositionedText> = {}): PositionedText {
  return { str, x, y, width: 3, height: 8.5, eol: false, ...extra };
}

function block(role: Block['role'], text: string, page = 1): Block {
  return { role, text, page, formula: false };
}

const source = { id: 'maths-test', subject: 'mathematiques' as const };

function texts(blocks: Block[]) {
  return parseBlocks(blocks, source).entries.map((e) => e.text);
}

describe('joinRuns', () => {
  it('rebuilds a fraction from two smaller stacked terms: digits, dots, letters, digit groups', () => {
    expect(joinRuns([run('comme ', 50), run('1', 60, 105, { height: 6 }), run('2', 60, 96, { height: 6 }), run(' ;', 64)])).toEqual({
      text: 'comme 1/2 ;', formula: true,
    });
    expect(joinRuns([run('2/3 = ', 50), run('…', 60, 105, { height: 6 }), run('15', 60, 96, { height: 6 })]).text).toBe('2/3 = …/15');
    expect(joinRuns([run('la fraction ', 50), run('a', 60, 105, { height: 6.5 }), run('b', 60, 96, { height: 6.5 })]).text).toBe('la fraction a/b');
    expect(joinRuns([
      run('entre ', 50),
      run('1', 66, 105, { height: 6, width: 2.8 }),
      run('1', 60, 96, { height: 6, width: 2.8 }),
      run(' ', 62.8, 96, { height: 0, width: 1.3 }),
      run('000', 64.1, 96, { height: 6, width: 10.8 }),
      run(' ;', 76),
    ]).text).toBe('entre 1/1 000 ;');
  });

  it('does not read two lines of body text as a fraction', () => {
    expect(joinRuns([run('a', 50, 112, { eol: true }), run('b', 50, 100)]).text).toBe('a b');
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
  it('reads objectives and automatisms per class, domain and subtheme', () => {
    const { entries, dropped } = parseBlocks([
      block('H1', 'Principes'),
      block('H1', 'Nombres et calculs'),
      block('H1', 'Cours moyen première année'),
      block('H2', 'Les fractions'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'CM1 is not collège.'),
      block('H1', 'Cinquième'),
      block('H2', 'Opérations'),
      block('H3', 'Automatismes'),
      block('LI', '− Multiplier et diviser par 10.'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Connaitre et utiliser les priorités opératoires.'),
      block('H3', 'Prolongements possibles : mises en perspective historiques'),
      block('LI', 'An extension, not an objective.'),
    ], source);
    expect(dropped).toEqual([]);
    expect(entries.map(({ kind, text, domain, subtheme, level }) => ({ kind, text, domain, subtheme, level }))).toEqual([
      { kind: 'automatism', text: 'Multiplier et diviser par 10.', domain: 'Nombres et calculs', subtheme: 'Opérations', level: 'cinquieme' },
      { kind: 'objective', text: 'Connaitre et utiliser les priorités opératoires.', domain: 'Nombres et calculs', subtheme: 'Opérations', level: 'cinquieme' },
    ]);
  });

  it('keeps a domain whose class heading has no subtheme', () => {
    const { entries } = parseBlocks([
      block('H1', 'La pensée informatique'),
      block('H1', 'Cinquième'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Manipuler des instructions simples et les séquencer.'),
    ], source);
    expect(entries.map(({ domain, subtheme, text }) => ({ domain, subtheme, text }))).toEqual([
      { domain: 'La pensée informatique', subtheme: null, text: 'Manipuler des instructions simples et les séquencer.' },
    ]);
  });

  it('reads automatisms written as paragraphs and leaves teacher notes out, listed', () => {
    const { entries, notes } = parseBlocks([
      block('H1', 'Nombres'),
      block('H1', 'Sixième'),
      block('H2', 'Les fractions'),
      block('H3', 'Automatismes'),
      block('P', 'L’élève sait calculer 2/3 de 12 œufs.'),
      block('P', 'Par exemple, il sait que 1/2 = 0,5.'),
      block('P', 'Les tables de multiplication sont réactivées.'),
    ], source);
    expect(entries.map((e) => e.text)).toEqual(['L’élève sait calculer 2/3 de 12 œufs.', 'Par exemple, il sait que 1/2 = 0,5.']);
    expect(notes.map((n) => n.text)).toEqual(['Les tables de multiplication sont réactivées.']);
  });

  it('joins items to their lead-in, a table to its entry with the sentence after it', () => {
    expect(texts([
      block('H1', 'Données'),
      block('H1', 'Cinquième'),
      block('H2', 'Probabilités'),
      block('H3', 'Automatismes'),
      block('LI', 'Positionner les évènements du type :'),
      block('LI', 'évènement impossible ;'),
      block('LI', '• évènement certain.'),
      block('LI', 'Lier « une chance sur quatre » et 1/4.'),
      block('LI', 'Voici les résultats :'),
      block('TABLE', 'Alexis Chloé 6 12'),
      block('P', 'Calculer le pourcentage de voix.'),
      block('LI', 'Calculer une fréquence.'),
    ])).toEqual([
      'Positionner les évènements du type : évènement impossible ; évènement certain.',
      'Lier « une chance sur quatre » et 1/4.',
      'Voici les résultats : Alexis Chloé 6 12 Calculer le pourcentage de voix.',
      'Calculer une fréquence.',
    ]);
  });

  it('starts a new entry on a capitalised sentence after a lead-in, and ignores tables outside entries', () => {
    expect(texts([
      block('H1', 'Nombres'),
      block('H1', 'Sixième'),
      block('H2', 'Les fractions'),
      block('TABLE', 'Tous les jours Toutes les semaines'),
      block('H3', 'Automatismes'),
      block('P', 'L’élève reconnaît une fraction, par exemple :'),
      block('P', 'L’élève connaît des relations entre 1/4 et 1/2.'),
    ])).toEqual(['L’élève reconnaît une fraction, par exemple :', 'L’élève connaît des relations entre 1/4 et 1/2.']);
  });

  it('skips rubric labels as themes, keeps the class under an annual perspective', () => {
    const { entries } = parseBlocks([
      block('H1', 'Lecture'),
      block('H1', 'Sixième'),
      block('H1', 'Perspective annuelle – Se découvrir'),
      block('H2', 'Les volumes'),
      block('H3', 'Connaissances et capacités attendues'),
      block('P', 'Objectifs d’apprentissage'),
      block('P', 'Connaître l’unité centimètre cube.'),
    ], source);
    expect(entries.map(({ level, subtheme, subsubtheme }) => ({ level, subtheme, subsubtheme }))).toEqual([
      { level: 'sixieme', subtheme: 'Les volumes', subsubtheme: null },
    ]);
  });

  it('reports list blocks that no class or domain holds', () => {
    expect(parseBlocks([block('P', 'Objectifs d’apprentissage'), block('P', 'Orphan objective.')], source).dropped.map((b) => b.text)).toEqual(['Orphan objective.']);
  });

  it('builds ids from the path and the wording, stable when entries move', () => {
    const before = [block('H1', 'Nombres'), block('H1', 'Cinquième'), block('H2', 'Opérations'), block('P', 'Objectifs d’apprentissage'), block('P', 'Diviser.'), block('P', 'Enchainer.')];
    const after = [...before.slice(0, 4), block('P', 'Nouveau.'), block('P', 'Enchainer.'), block('P', 'Diviser.')];
    const idOf = (blocks: Block[], text: string) => parseBlocks(blocks, source).entries.find((e) => e.text === text)?.id;
    expect(idOf(before, 'Diviser.')).toMatch(/^maths-test\.cinquieme\.nombres\.operations\.o-[0-9a-f]{8}$/);
    expect(idOf(after, 'Diviser.')).toBe(idOf(before, 'Diviser.'));
    expect(idOf(after, 'Enchainer.')).toBe(idOf(before, 'Enchainer.'));
  });
});
