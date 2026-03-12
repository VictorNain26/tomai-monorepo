import {
  createChildFormSchema,
  updateChildFormSchema,
  formatDateInput,
  toIsoDate,
  toDisplayDate,
  generateUsername,
  generatePassword,
} from '@/lib/child-form-schema';

// ============================================================================
// HELPERS
// ============================================================================

describe('formatDateInput', () => {
  it('formats digits as DD/MM/YYYY progressively', () => {
    // Simulates real RN TextInput flow: each call gets the full current text
    expect(formatDateInput('2', '')).toBe('2');
    expect(formatDateInput('25', '2')).toBe('25');
    expect(formatDateInput('250', '25')).toBe('25/0');
    expect(formatDateInput('25/03', '25/0')).toBe('25/03');
    expect(formatDateInput('25/032', '25/03')).toBe('25/03/2');
    expect(formatDateInput('25/03/2015', '25/03/201')).toBe('25/03/2015');
  });

  it('allows backspace (shorter input)', () => {
    expect(formatDateInput('25/0', '25/03')).toBe('25/0');
    expect(formatDateInput('', '2')).toBe('');
  });

  it('caps at 8 digits (DD/MM/YYYY)', () => {
    // User tries to type more after complete date
    expect(formatDateInput('25/03/20151', '25/03/2015')).toBe('25/03/2015');
  });

  it('strips non-digit characters', () => {
    expect(formatDateInput('2a5b', '2a')).toBe('25');
  });
});

describe('toIsoDate', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(toIsoDate('25/03/2015')).toBe('2015-03-25');
    expect(toIsoDate('01/12/2010')).toBe('2010-12-01');
  });
});

describe('toDisplayDate', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(toDisplayDate('2015-03-25')).toBe('25/03/2015');
  });

  it('returns empty string for undefined/invalid', () => {
    expect(toDisplayDate(undefined)).toBe('');
    expect(toDisplayDate('')).toBe('');
    expect(toDisplayDate('invalid')).toBe('');
  });
});

describe('generateUsername', () => {
  it('generates lowercase normalized username with 3-digit suffix', () => {
    const username = generateUsername('Émilie', 'Dupont');
    expect(username).toMatch(/^emilied\d{3}$/);
  });

  it('strips special characters', () => {
    const username = generateUsername("Jean-Pierre", "O'Connor");
    expect(username).toMatch(/^jeanpierreo\d{3}$/);
  });
});

describe('generatePassword', () => {
  it('generates password matching backend requirements (uppercase, lowercase, digit)', () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generatePassword();
      expect(pwd.length).toBeGreaterThanOrEqual(8);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/\d/);
    }
  });
});

// ============================================================================
// CREATE SCHEMA
// ============================================================================

describe('createChildFormSchema', () => {
  const validData = {
    firstName: 'Emma',
    lastName: 'Dupont',
    dateOfBirth: '25/03/2015',
    schoolLevel: 'cm2' as const,
    username: 'emmad123',
    password: 'SuperLion42!',
  };

  it('accepts valid complete data', () => {
    const result = createChildFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  // firstName
  it('rejects empty firstName', () => {
    const result = createChildFormSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects firstName with numbers', () => {
    const result = createChildFormSchema.safeParse({ ...validData, firstName: 'Emma3' });
    expect(result.success).toBe(false);
  });

  it('accepts accented firstName', () => {
    const result = createChildFormSchema.safeParse({ ...validData, firstName: 'Émilie' });
    expect(result.success).toBe(true);
  });

  // dateOfBirth
  it('rejects invalid date format', () => {
    const result = createChildFormSchema.safeParse({ ...validData, dateOfBirth: '2015-03-25' });
    expect(result.success).toBe(false);
  });

  it('rejects non-existent date (31/02/2015)', () => {
    const result = createChildFormSchema.safeParse({ ...validData, dateOfBirth: '31/02/2015' });
    expect(result.success).toBe(false);
  });

  it('rejects child too young (age < 5)', () => {
    const now = new Date();
    const tooYoung = `01/01/${now.getFullYear() - 3}`;
    const result = createChildFormSchema.safeParse({ ...validData, dateOfBirth: tooYoung });
    expect(result.success).toBe(false);
  });

  it('rejects child too old (age > 19)', () => {
    const result = createChildFormSchema.safeParse({ ...validData, dateOfBirth: '01/01/2000' });
    expect(result.success).toBe(false);
  });

  // schoolLevel
  it('rejects invalid school level', () => {
    const result = createChildFormSchema.safeParse({ ...validData, schoolLevel: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid school levels', () => {
    const levels = ['cp', 'ce1', 'ce2', 'cm1', 'cm2', 'sixieme', 'cinquieme', 'quatrieme', 'troisieme', 'seconde', 'premiere', 'terminale'];
    for (const level of levels) {
      const result = createChildFormSchema.safeParse({ ...validData, schoolLevel: level });
      expect(result.success).toBe(true);
    }
  });

  // username
  it('rejects username shorter than 3 chars', () => {
    const result = createChildFormSchema.safeParse({ ...validData, username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects username with spaces', () => {
    const result = createChildFormSchema.safeParse({ ...validData, username: 'emma d' });
    expect(result.success).toBe(false);
  });

  // password
  it('rejects password without uppercase', () => {
    const result = createChildFormSchema.safeParse({ ...validData, password: 'superlion42!' });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = createChildFormSchema.safeParse({ ...validData, password: 'SuperLion!' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = createChildFormSchema.safeParse({ ...validData, password: 'Su1!' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// UPDATE SCHEMA
// ============================================================================

describe('updateChildFormSchema', () => {
  const validData = {
    firstName: 'Emma',
    lastName: 'Dupont',
    dateOfBirth: '25/03/2015',
    schoolLevel: 'cm2' as const,
    newPassword: '',
  };

  it('accepts valid data without password change', () => {
    const result = updateChildFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('accepts valid data with new password', () => {
    const result = updateChildFormSchema.safeParse({
      ...validData,
      newPassword: 'NewPass42!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects weak new password', () => {
    const result = updateChildFormSchema.safeParse({
      ...validData,
      newPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty newPassword (no change)', () => {
    const result = updateChildFormSchema.safeParse({
      ...validData,
      newPassword: '',
    });
    expect(result.success).toBe(true);
  });
});
