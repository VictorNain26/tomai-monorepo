import { inferSchoolLevel } from '@/lib/infer-school-level';

describe('inferSchoolLevel', () => {
  it.each([
    ['CP A', 'cp'],
    ['CE1 B', 'ce1'],
    ['CE2', 'ce2'],
    ['CM1 A', 'cm1'],
    ['CM2 B', 'cm2'],
    ['6ème A', 'sixieme'],
    ['6eme B', 'sixieme'],
    ['5ème 3', 'cinquieme'],
    ['4ème C', 'quatrieme'],
    ['3ème A', 'troisieme'],
    ['2nde 5', 'seconde'],
    ['2de A', 'seconde'],
    ['1ère S', 'premiere'],
    ['1ere ES', 'premiere'],
    ['Terminale S', 'terminale'],
    ['Term STI2D', 'terminale'],
  ])('should infer "%s" as "%s"', (className, expected) => {
    expect(inferSchoolLevel(className)).toBe(expected);
  });

  it('should return null for unrecognized class names', () => {
    expect(inferSchoolLevel('Division 3A')).toBeNull();
    expect(inferSchoolLevel('Groupe Alpha')).toBeNull();
    expect(inferSchoolLevel('')).toBeNull();
  });
});
