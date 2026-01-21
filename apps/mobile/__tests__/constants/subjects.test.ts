/**
 * Subject Metadata Tests
 *
 * Tests for enrichSubjectKey function and subject constants.
 */

import {
  enrichSubjectKey,
  SUBJECT_METADATA,
} from '../../src/constants/subjects';

describe('enrichSubjectKey', () => {
  describe('direct key lookup', () => {
    it('should return metadata for exact key match', () => {
      const result = enrichSubjectKey('mathematiques');
      expect(result.name).toBe('Mathématiques');
      expect(result.emoji).toBe('📐');
      expect(result.color).toBe('blue');
    });

    it('should return metadata for all known subjects', () => {
      const knownSubjects = Object.keys(SUBJECT_METADATA);
      for (const subject of knownSubjects) {
        const result = enrichSubjectKey(subject);
        expect(result.name).toBeTruthy();
        expect(result.emoji).toBeTruthy();
        expect(result.color).toBeTruthy();
      }
    });
  });

  describe('normalized key lookup (tirets to underscores)', () => {
    it('should normalize histoire-geo to histoire_geo', () => {
      const result = enrichSubjectKey('histoire-geo');
      expect(result.name).toBe('Histoire-Géographie');
    });

    it('should normalize physique-chimie to physique_chimie', () => {
      const result = enrichSubjectKey('physique-chimie');
      expect(result.name).toBe('Physique-Chimie');
    });

    it('should handle uppercase keys', () => {
      const result = enrichSubjectKey('MATHEMATIQUES');
      expect(result.name).toBe('Mathématiques');
    });
  });

  describe('alias resolution', () => {
    it('should resolve maths alias to mathematiques', () => {
      const result = enrichSubjectKey('maths');
      expect(result.name).toBe('Mathématiques');
    });

    it('should resolve math alias to mathematiques', () => {
      const result = enrichSubjectKey('math');
      expect(result.name).toBe('Mathématiques');
    });

    it('should resolve sciences alias to svt', () => {
      const result = enrichSubjectKey('sciences');
      expect(result.name).toBe('SVT');
    });

    it('should resolve lv1 alias to anglais', () => {
      const result = enrichSubjectKey('lv1');
      expect(result.name).toBe('Anglais');
    });

    it('should resolve techno alias to technologie', () => {
      const result = enrichSubjectKey('techno');
      expect(result.name).toBe('Technologie');
    });
  });

  describe('prefix matching', () => {
    it('should match mathematiques-algebre to mathematiques', () => {
      const result = enrichSubjectKey('mathematiques-algebre');
      expect(result.name).toBe('Mathématiques');
    });

    it('should match francais-grammaire to francais', () => {
      const result = enrichSubjectKey('francais-grammaire');
      expect(result.name).toBe('Français');
    });
  });

  describe('fallback for unknown subjects', () => {
    it('should return fallback metadata for unknown subjects', () => {
      const result = enrichSubjectKey('unknown-subject');
      expect(result.name).toBe('Unknown Subject');
      expect(result.description).toBe('Cours de unknown subject');
      expect(result.emoji).toBe('📖');
      expect(result.color).toBe('gray');
    });

    it('should format multi-word unknown subjects correctly', () => {
      const result = enrichSubjectKey('arts-plastiques');
      expect(result.name).toBe('Arts Plastiques');
    });
  });
});

describe('SUBJECT_METADATA', () => {
  it('should contain all 10 required subjects', () => {
    const requiredSubjects = [
      'mathematiques',
      'francais',
      'physique_chimie',
      'svt',
      'histoire_geo',
      'anglais',
      'espagnol',
      'allemand',
      'italien',
      'technologie',
    ];

    for (const subject of requiredSubjects) {
      expect(SUBJECT_METADATA[subject]).toBeDefined();
    }
  });

  it('should have valid metadata structure for all subjects', () => {
    for (const metadata of Object.values(SUBJECT_METADATA)) {
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('emoji');
      expect(metadata).toHaveProperty('color');
      expect(typeof metadata.name).toBe('string');
      expect(typeof metadata.description).toBe('string');
      expect(metadata.name.length).toBeGreaterThan(0);
    }
  });
});
