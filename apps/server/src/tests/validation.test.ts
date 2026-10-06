import { describe, it, expect } from 'bun:test';
import { createChildSchema, updateChildSchema } from '../modules/family/parent.validation';

const validChild = {
  firstName: 'Lucas',
  lastName: 'Martin',
  username: 'lucas_6e',
  password: 'ChildPass123',
  schoolLevel: 'sixieme' as const,
  dateOfBirth: '2015-03-15',
};

function issues(result: { success: boolean; error?: { issues: { message: string }[] } }): string {
  return result.error?.issues.map((i) => i.message).join('; ') ?? '';
}

describe('createChildSchema', () => {
  it('accepts a complete child', () => {
    const result = createChildSchema.safeParse(validChild);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validChild);
  });

  it('normalizes the username to lowercase', () => {
    const result = createChildSchema.safeParse({ ...validChild, username: 'LUCAS_6E' });
    expect(result.data?.username).toBe('lucas_6e');
  });

  it('rejects a username with other characters', () => {
    const result = createChildSchema.safeParse({ ...validChild, username: 'élève@cp' });
    expect(issues(result)).toContain('lettres, chiffres, points, underscores');
  });

  it('rejects a short password', () => {
    const result = createChildSchema.safeParse({ ...validChild, password: 'Ab1' });
    expect(issues(result)).toContain('Mot de passe minimum 8 caractères');
  });

  it('requires lowercase, uppercase and a digit in the password', () => {
    const result = createChildSchema.safeParse({ ...validChild, password: 'alllowercase123' });
    expect(issues(result)).toContain('minuscule, majuscule, chiffre');
  });

  it('accepts every collège level', () => {
    for (const schoolLevel of ['sixieme', 'cinquieme', 'quatrieme', 'troisieme']) {
      expect(createChildSchema.safeParse({ ...validChild, schoolLevel }).success).toBe(true);
    }
  });

  it('rejects a level outside the collège, and an unknown one', () => {
    for (const schoolLevel of ['cm2', 'seconde', 'CM3']) {
      expect(issues(createChildSchema.safeParse({ ...validChild, schoolLevel }))).toContain('Niveau scolaire invalide');
    }
  });

  it('rejects a child younger than 5 or older than 19', () => {
    for (const dateOfBirth of ['2022-01-01', '2000-01-01']) {
      const result = createChildSchema.safeParse({ ...validChild, dateOfBirth });
      expect(issues(result)).toContain('Âge doit être entre 5 et 19 ans');
    }
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    const result = createChildSchema.safeParse({ ...validChild, dateOfBirth: '15/03/2015' });
    expect(issues(result)).toContain('Format date invalide');
  });

  it('requires the date of birth', () => {
    expect(createChildSchema.safeParse({ ...validChild, dateOfBirth: undefined }).success).toBe(false);
  });
});

describe('updateChildSchema', () => {
  it('accepts a single field', () => {
    expect(updateChildSchema.safeParse({ firstName: 'Léa' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    const result = updateChildSchema.safeParse({});
    expect(issues(result)).toContain('Au moins un champ doit être fourni');
  });

  it('rejects an update whose fields are all undefined', () => {
    const result = updateChildSchema.safeParse({ firstName: undefined });
    expect(issues(result)).toContain('Au moins un champ doit être fourni');
  });

  it('applies the same password rule as creation', () => {
    expect(updateChildSchema.safeParse({ password: 'weak' }).success).toBe(false);
  });
});
