import { describe, it, expect } from 'bun:test';
import { programmeFor, programmes } from '.';
import { PROGRAMME_SOURCES } from './sources';

describe('referential texts', () => {
  it('load one file per source, each matching its pinned PDF', () => {
    expect(programmes.map(({ source }) => source.id).sort()).toEqual(PROGRAMME_SOURCES.map((s) => s.id).sort());
  });

  it('give every entry a unique id across all texts', () => {
    const ids = programmes.flatMap(({ entries }) => entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only hold classes the source applies to', () => {
    for (const { source, entries } of programmes) {
      for (const level of new Set(entries.map((e) => e.level))) {
        expect({ source: source.id, level, applies: source.appliesFrom[level] !== undefined }).toEqual({
          source: source.id,
          level,
          applies: true,
        });
      }
    }
  });
});

describe('programmeFor', () => {
  it('gives the 2026 cycle 4 text in 5e from 2026-2027', () => {
    const programme = programmeFor('cinquieme', 'mathematiques', 2026);
    expect(programme?.source.id).toBe('mathematiques-c4-2026');
    expect(programme?.entries.every((e) => e.level === 'cinquieme')).toBe(true);
    expect(programme?.entries.some((e) => e.text === 'Connaitre et utiliser les priorités opératoires.')).toBe(true);
  });

  it('gives the 2025 cycle 3 text in 6e', () => {
    expect(programmeFor('sixieme', 'francais', 2026)?.source.id).toBe('francais-c3-2025');
  });

  it('gives the 2019 end-of-year expectations in 4e and 3e until the 2026 text applies', () => {
    expect(programmeFor('quatrieme', 'mathematiques', 2026)?.source.id).toBe('mathematiques-attendus-4e-2019');
    expect(programmeFor('troisieme', 'francais', 2026)?.source.id).toBe('francais-attendus-3e-2019');
    expect(programmeFor('quatrieme', 'mathematiques', 2027)?.source.id).toBe('mathematiques-c4-2026');
    expect(programmeFor('troisieme', 'mathematiques', 2027)?.source.id).toBe('mathematiques-attendus-3e-2019');
    expect(programmeFor('troisieme', 'mathematiques', 2028)?.source.id).toBe('mathematiques-c4-2026');
  });

  it('gives nothing before a text applies', () => {
    expect(programmeFor('sixieme', 'mathematiques', 2024)).toBeNull();
  });

  it('gives nothing for a subject without an extracted text', () => {
    expect(programmeFor('cinquieme', 'svt', 2026)).toBeNull();
  });
});
