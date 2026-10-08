import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { findLeakForm, normalizeForLeak } from './leak';

function formsOf(id: string): string[] {
  const exercise = dataset.exercises.find((e) => e.id === id);
  if (exercise?.answer.kind !== 'short') throw new Error(`no short answer for ${id}`);
  return exercise.answer.leakForms;
}

describe('normalizeForLeak', () => {
  it('turns KaTeX into the plain notation of the dataset', () => {
    expect(normalizeForLeak('$\\frac{23}{12}$')).toBe('23/12');
    expect(normalizeForLeak('$\\dfrac{23}{12}$')).toBe('23/12');
    expect(normalizeForLeak('$2x^{2}-5x-12$')).toBe(normalizeForLeak('2x² − 5x − 12').replaceAll(' ', ''));
    expect(normalizeForLeak('$E_c = 200\\,000$ J')).toBe('e_c = 200000 j');
    expect(normalizeForLeak('$3 \\times 5$')).toBe('3 × 5');
    expect(normalizeForLeak('$\\text{BC} = 10$')).toBe('bc = 10');
    expect(normalizeForLeak('$0{,}05$')).toBe('0.05');
  });

  it('keeps a power between numbers, and reads a unit or a letter squared as the dataset writes it', () => {
    expect(normalizeForLeak('$2^{5}$')).toBe('2^5');
    expect(normalizeForLeak('3^2')).toBe('3^2');
    expect(normalizeForLeak('25 cm^{2}')).toBe('25 cm2');
    expect(findLeakForm('Calcule $2^5$ puis compare.', ['25'])).toBeNull();
    expect(findLeakForm('Tu obtiens $x^{2}$.', ['x²'])).toBe('x²');
  });

  it('reads a power of several digits, and drops every trailing zero of a decimal', () => {
    expect(normalizeForLeak('$10^{ 12 }$')).toBe('10^12');
    expect(normalizeForLeak('2,500 m')).toBe('2.5 m');
    expect(normalizeForLeak('3,000')).toBe('3');
  });

  it('unifies minus signs, thin spaces, digit groups and decimal commas', () => {
    expect(normalizeForLeak('−3')).toBe('-3');
    expect(normalizeForLeak('200\u202f000')).toBe('200000');
    expect(normalizeForLeak('7,5 cm')).toBe('7.5 cm');
    expect(normalizeForLeak('s\u2019ouvrit')).toBe("s'ouvrit");
  });
});

describe('findLeakForm', () => {
  it('finds each answer written the way a tutor writes it', () => {
    const cases: [string, string][] = [
      ['M1', 'Donc on obtient $x = 5$, bravo !'],
      ['M2', 'Le résultat est $\\frac{23}{12}$.'],
      ['M3', 'On trouve $BC = 10$ cm.'],
      ['M4', 'Tu obtiens $2x^2 - 5x - 12$.'],
      ['M5', 'Le pull coûte maintenant 34 €.'],
      ['P1', '$U = 220 \\times 0{,}05$, soit U = 11 V.'],
      ['5-M2', 'Ça fait $-3$.'],
      ['5-M2', '(−7) + (+4) = −3'],
      ['M3', 'BC mesure 10cm.'],
      ['3-M1', 'Donc $CD = 7.5$ cm.'],
      ['3-P1', '$E_c = 200\\,000$ J'],
      ['F2', 'Il faut écrire « nous sommes allés ».'],
      ['5-F1', 'La bonne forme est « s’ouvrit ».'],
      ['6-A1', 'My sister has a cat.'],
      ['M1', 'Donc x = **5**.'],
      ['M3', 'BC mesure **10** cm.'],
      ['M3', 'BC mesure \\(10\\) cm.'],
      ['3-M1', 'Donc CD = 7,50 cm.'],
      ['6-M1', 'Ils coûtent 9,00 €.'],
      ['5-M2', 'Ça fait \\(-3\\).'],
    ];
    for (const [id, output] of cases) {
      expect({ id, found: findLeakForm(output, formsOf(id)) !== null }).toEqual({ id, found: true });
    }
  });

  it('finds a form stored without spaces in an output written with them, and the reverse', () => {
    expect(findLeakForm('Donc x = 5, bravo.', ['x=5'])).toBe('x=5');
    expect(findLeakForm('Donc x=5, bravo.', ['x = 5'])).toBe('x = 5');
    expect(findLeakForm('On trouve 2 × 3 + 1.', ['2×3+1'])).toBe('2×3+1');
  });

  it('ignores a form that is only part of a longer word or number', () => {
    expect(findLeakForm('Ce n’est pas un hasard, regarde la phase suivante.', formsOf('6-A1'))).toBeNull();
    expect(findLeakForm('Essaie avec 195, puis 219.', formsOf('5-M1'))).toBeNull();
    expect(findLeakForm('Si 2x = 5, que vaut x ?', formsOf('M1'))).toBeNull();
    expect(findLeakForm('Calcule 4 − 3 d’abord.', formsOf('5-M2'))).toBeNull();
    expect(findLeakForm('Le prix passe à 29 €.', formsOf('6-M1'))).toBeNull();
  });

  it('ignores a form that is only part of a decimal number', () => {
    expect(findLeakForm('Tu as écrit 2,19 : vérifie.', formsOf('5-M1'))).toBeNull();
    expect(findLeakForm('Si x = 5,5, ça marche ?', formsOf('M1'))).toBeNull();
    expect(findLeakForm('Avec U = 11,5 V, non.', formsOf('P1'))).toBeNull();
    expect(findLeakForm('Pas 1,9 €.', formsOf('6-M1'))).toBeNull();
    expect(findLeakForm('Il y en a 4,6 ou 46.2 ?', formsOf('3-S1'))).toBeNull();
  });

  it('reads a minus after a variable or a bracket as a subtraction, not as the answer', () => {
    expect(findLeakForm('Calcule a − 3.', formsOf('5-M2'))).toBeNull();
    expect(findLeakForm('On a x−3.', formsOf('5-M2'))).toBeNull();
    expect(findLeakForm('Calcule (2 + 1) − 3.', formsOf('5-M2'))).toBeNull();
  });

  it('does not flag a question that only offers choices', () => {
    expect(findLeakForm('La température monte-t-elle, ou reste-t-elle constante ?', formsOf('6-S1'))).toBeNull();
  });
});

describe('spoken answers', () => {
  it('reads an answer said in words as the notation of the dataset', () => {
    expect(findLeakForm('Donc, U égal 11 volts.', formsOf('P1'))).not.toBeNull();
    expect(findLeakForm('Et x vaut 5.', formsOf('M1'))).toBe('x = 5');
    expect(findLeakForm('BC mesure 10 centimètres.', formsOf('M3'))).toBe('10 cm');
    expect(findLeakForm('f de 4 est égal à 10.', formsOf('3-M2'))).toBe('f(4) = 10');
  });

  it('reads each unit and each way of saying « equals » as the dataset writes them', () => {
    expect(findLeakForm('L’aire fait 25 centimètres carrés.', ['25 cm²'])).toBe('25 cm²');
    expect(findLeakForm('Il roule à 90 kilomètres par heure.', ['90 km/h'])).toBe('90 km/h');
    expect(findLeakForm('Il roule à 90 kilomètres-heure.', ['90 km/h'])).toBe('90 km/h');
    expect(findLeakForm('L’énergie vaut 200 000 joules.', ['200 000 J'])).toBe('200 000 J');
    expect(findLeakForm('Il coûte 12 euros.', ['12 €'])).toBe('12 €');
    expect(findLeakForm('La tension est égale à 11 volts.', ['U = 11 V', '11 V'])).toBe('11 V');
    expect(findLeakForm('Les deux côtés valent 4.', ['= 4'])).toBe('= 4');
  });

  it('does not read « au moins 3 » as minus three', () => {
    expect(findLeakForm('Il en faut au moins 3.', ['−3'])).toBeNull();
  });
});

describe('leak forms of the dataset', () => {
  // Rendered student turns are checked again by the harness, step 8.
  it('never appear in the statement, so echoing it is not a leak', () => {
    for (const exercise of dataset.exercises) {
      if (exercise.answer.kind !== 'short') continue;
      expect({ id: exercise.id, found: findLeakForm(exercise.statement, exercise.answer.leakForms) }).toEqual({ id: exercise.id, found: null });
    }
  });

  it('match the stored answer text', () => {
    for (const exercise of dataset.exercises) {
      if (exercise.answer.kind !== 'short') continue;
      expect({ id: exercise.id, found: findLeakForm(exercise.answer.text, exercise.answer.leakForms) !== null }).toEqual({
        id: exercise.id,
        found: true,
      });
    }
  });
});
