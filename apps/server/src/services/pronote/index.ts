/**
 * Pronote Module - Barrel exports
 */

export { pronoteAuthService } from './pronote-auth.service.js';
export { pronoteDataService } from './pronote-data.service.js';
export { pronoteSearchService } from './pronote-search.service.js';

export type {
  QrCodeData,
  PronoteConnectionResult,
  PronoteResource,
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
  PronoteSchoolResult,
  ChildMappingInput,
  IndexEducationSchool,
} from './pronote-shared.js';
