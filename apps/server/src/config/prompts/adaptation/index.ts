/**
 * Adaptation exports
 */

export {
  generateLevelAdaptation,
  getCycleFromLevel,
  needsSimplifiedKaTeX,
  type CycleType
} from './by-level.js';

export {
  generateSubjectSpecifics,
  generateAllSubjectSpecifics,
  normalizeSubject,
  requiresKaTeX,
  type SubjectType
} from './by-subject.js';
