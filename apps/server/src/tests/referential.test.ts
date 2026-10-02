import { describe, it, expect } from 'bun:test';
import { programmeFor, programmes } from '../referential';
import { PROGRAMME_SOURCES } from '../referential/sources';

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
          source: source.id, level, applies: true,
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

  it('gives nothing in 4e for 2026-2027, when the 2026 text does not apply yet, and gives it from 2027', () => {
    expect(programmeFor('quatrieme', 'mathematiques', 2026)).toBeNull();
    expect(programmeFor('quatrieme', 'mathematiques', 2027)?.source.id).toBe('mathematiques-c4-2026');
  });

  it('gives nothing for a subject without an extracted text', () => {
    expect(programmeFor('cinquieme', 'svt', 2026)).toBeNull();
  });
});
