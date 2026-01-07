// Niveaux scolaires français

export const CYCLES = {
  cycle2: {
    label: 'Cycle 2',
    description: 'CP, CE1, CE2',
    levels: ['cp', 'ce1', 'ce2'],
  },
  cycle3: {
    label: 'Cycle 3',
    description: 'CM1, CM2, 6ème',
    levels: ['cm1', 'cm2', '6eme'],
  },
  cycle4: {
    label: 'Cycle 4',
    description: '5ème, 4ème, 3ème',
    levels: ['5eme', '4eme', '3eme'],
  },
  lycee: {
    label: 'Lycée',
    description: '2nde, 1ère, Terminale',
    levels: ['seconde', 'premiere', 'terminale'],
  },
} as const;

export const LEVELS = [
  { id: 'cp', label: 'CP', cycle: 'cycle2' },
  { id: 'ce1', label: 'CE1', cycle: 'cycle2' },
  { id: 'ce2', label: 'CE2', cycle: 'cycle2' },
  { id: 'cm1', label: 'CM1', cycle: 'cycle3' },
  { id: 'cm2', label: 'CM2', cycle: 'cycle3' },
  { id: '6eme', label: '6ème', cycle: 'cycle3' },
  { id: '5eme', label: '5ème', cycle: 'cycle4' },
  { id: '4eme', label: '4ème', cycle: 'cycle4' },
  { id: '3eme', label: '3ème', cycle: 'cycle4' },
  { id: 'seconde', label: '2nde', cycle: 'lycee' },
  { id: 'premiere', label: '1ère', cycle: 'lycee' },
  { id: 'terminale', label: 'Terminale', cycle: 'lycee' },
] as const;

export type LevelId = (typeof LEVELS)[number]['id'];
export type CycleId = keyof typeof CYCLES;
