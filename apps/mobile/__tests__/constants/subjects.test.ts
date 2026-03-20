/**
 * Subject Metadata Tests
 */

import {
  enrichSubjectKey,
  getSubjectStyles,
  SUBJECT_METADATA,
  type SubjectColor,
} from '../../src/constants/subjects';

describe('enrichSubjectKey', () => {
  describe('direct key lookup', () => {
    it('should return metadata for exact key match', () => {
      const result = enrichSubjectKey('mathematiques');
      expect(result.name).toBe('Mathematiques');
      expect(result.icon).toBe('Calculator');
      expect(result.color).toBe('blue');
    });

    it('should return metadata for all known subjects', () => {
      const knownSubjects = Object.keys(SUBJECT_METADATA);
      for (const subject of knownSubjects) {
        const result = enrichSubjectKey(subject);
        expect(result.name).toBeTruthy();
        expect(result.icon).toBeTruthy();
        expect(result.color).toBeTruthy();
      }
    });
  });

  describe('normalized key lookup', () => {
    it('should normalize histoire-geo to histoire_geo', () => {
      const result = enrichSubjectKey('histoire-geo');
      expect(result.name).toBe('Histoire-Geographie');
    });

    it('should normalize physique-chimie to physique_chimie', () => {
      const result = enrichSubjectKey('physique-chimie');
      expect(result.name).toBe('Physique-Chimie');
    });

    it('should handle uppercase keys', () => {
      const result = enrichSubjectKey('MATHEMATIQUES');
      expect(result.name).toBe('Mathematiques');
    });
  });

  describe('alias resolution', () => {
    it('should resolve maths alias', () => {
      expect(enrichSubjectKey('maths').name).toBe('Mathematiques');
    });

    it('should resolve sciences alias', () => {
      expect(enrichSubjectKey('sciences').name).toBe('SVT');
    });

    it('should resolve lv1 alias', () => {
      expect(enrichSubjectKey('lv1').name).toBe('Anglais');
    });

    it('should resolve techno alias', () => {
      expect(enrichSubjectKey('techno').name).toBe('Technologie');
    });
  });

  describe('prefix matching', () => {
    it('should match mathematiques-algebre', () => {
      expect(enrichSubjectKey('mathematiques-algebre').name).toBe('Mathematiques');
    });
  });

  describe('fallback', () => {
    it('should return fallback for unknown subjects', () => {
      const result = enrichSubjectKey('unknown-subject');
      expect(result.name).toBe('Unknown Subject');
      expect(result.icon).toBe('GraduationCap');
      expect(result.color).toBe('gray');
    });
  });
});

describe('getSubjectStyles', () => {
  it('should return NativeWind classes for blue', () => {
    const styles = getSubjectStyles('blue');
    expect(styles.bg).toContain('bg-blue');
    expect(styles.text).toContain('text-blue');
    expect(styles.border).toContain('border-blue');
    expect(styles.iconColor.light).toBe('#3B82F6');
    expect(styles.iconColor.dark).toBe('#60A5FA');
  });

  it('should return valid styles for all colors', () => {
    const colors: SubjectColor[] = ['blue', 'violet', 'purple', 'emerald', 'amber', 'rose', 'yellow', 'slate', 'teal', 'gray'];
    for (const color of colors) {
      const styles = getSubjectStyles(color);
      expect(styles.bg).toBeTruthy();
      expect(styles.text).toBeTruthy();
      expect(styles.border).toBeTruthy();
      expect(styles.iconColor.light).toBeTruthy();
      expect(styles.iconColor.dark).toBeTruthy();
    }
  });
});

describe('SUBJECT_METADATA', () => {
  it('should contain all 10 subjects', () => {
    const required = [
      'mathematiques', 'francais', 'physique_chimie', 'svt',
      'histoire_geo', 'anglais', 'espagnol', 'allemand',
      'italien', 'technologie',
    ];
    for (const s of required) {
      expect(SUBJECT_METADATA[s]).toBeDefined();
    }
  });

  it('should have valid structure', () => {
    for (const m of Object.values(SUBJECT_METADATA)) {
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('description');
      expect(m).toHaveProperty('icon');
      expect(m).toHaveProperty('color');
    }
  });

  it('should have unique colors for similar subjects', () => {
    expect(SUBJECT_METADATA['francais'].color).not.toBe(SUBJECT_METADATA['anglais'].color);
    expect(SUBJECT_METADATA['svt'].color).not.toBe(SUBJECT_METADATA['italien'].color);
  });
});
