import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { SUBJECT_FAMILIES, SUBJECT_SLUGS, SUBJECTS } from '../lib/subjects';
import { educationApiRoutes } from '../routes/api/education.routes';
import { deckDiscoveryRoutes } from '../modules/learning/deck-discovery.routes';

describe('subject taxonomy', () => {
  it('names the collège subjects, histoire-géo as one, italien included', () => {
    expect(SUBJECT_SLUGS).toContain('histoire-geo');
    expect(SUBJECT_SLUGS).toContain('italien');
    for (const gone of ['histoire', 'geographie', 'ses', 'philosophie', 'nsi']) expect(SUBJECT_SLUGS).not.toContain(gone);
  });

  it('gives each slug a label and a family the turn analysis knows, never general', () => {
    for (const slug of SUBJECT_SLUGS) {
      expect(SUBJECTS[slug].label.length).toBeGreaterThan(0);
      expect(SUBJECT_FAMILIES).toContain(SUBJECTS[slug].family);
      expect(SUBJECTS[slug].family).not.toBe('general');
    }
    expect(SUBJECTS.svt.family).toBe('sciences');
    expect(SUBJECTS.italien.family).toBe('langues');
  });
});

describe('GET /api/education/levels', () => {
  it('lists the four collège levels with their label', async () => {
    const res = await new Hono().route('/api', educationApiRoutes).request('/api/education/levels');
    expect(res.status).toBe(200);
    const { levels } = (await res.json()) as { levels: { key: string; label: string }[] };
    expect(levels.map((level) => level.key)).toEqual(['sixieme', 'cinquieme', 'quatrieme', 'troisieme']);
    expect(levels[0]?.label).toBe('6ème (11 ans)');
  });
});

describe('GET /learning/subjects', () => {
  it('lists every slug with its label', async () => {
    const res = await deckDiscoveryRoutes.request('/subjects');
    expect(res.status).toBe(200);
    const { subjects } = (await res.json()) as { subjects: { id: string; label: string }[] };
    expect(subjects.map((subject) => subject.id)).toEqual([...SUBJECT_SLUGS]);
    expect(subjects.find((subject) => subject.id === 'histoire-geo')?.label).toBe('Histoire-Géographie-EMC');
  });
});
