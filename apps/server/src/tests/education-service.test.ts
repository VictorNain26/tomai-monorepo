/**
 * Tests unitaires - Education Service (services/education.service.ts)
 */

import { describe, it, expect } from 'bun:test';
import { educationService } from '../services/education.service';

describe('Education Service', () => {
  describe('getAvailableLevels', () => {
    it('should return the 12 school levels', () => {
      const levels = educationService.getAvailableLevels();
      expect(levels.length).toBe(12);
    });

    it('should mark collège levels available and the others not', () => {
      const levels = educationService.getAvailableLevels();
      expect(levels.find(l => l.key === 'troisieme')?.available).toBe(true);
      expect(levels.find(l => l.key === 'cp')?.available).toBe(false);
      expect(levels.find(l => l.key === 'terminale')?.available).toBe(false);
    });

    it('should report a subjects count consistent with getSubjectsForLevel', () => {
      for (const level of educationService.getAvailableLevels()) {
        expect(level.subjectsCount).toBe(educationService.getSubjectsForLevel(level.key).length);
      }
    });
  });

  describe('getSubjectsForLevel', () => {
    it('should return the collège subjects for a collège level', () => {
      const subjects = educationService.getSubjectsForLevel('sixieme');
      expect(subjects).toContain('mathematiques');
      expect(subjects).toContain('francais');
      expect(subjects.length).toBe(10);
    });

    it('should return an empty list for an uncovered level', () => {
      expect(educationService.getSubjectsForLevel('cm1')).toEqual([]);
      expect(educationService.getSubjectsForLevel('seconde')).toEqual([]);
    });

    it('should return the same subjects for every collège level', () => {
      const sixieme = educationService.getSubjectsForLevel('sixieme');
      for (const level of ['cinquieme', 'quatrieme', 'troisieme'] as const) {
        expect(educationService.getSubjectsForLevel(level)).toEqual(sixieme);
      }
    });
  });
});
