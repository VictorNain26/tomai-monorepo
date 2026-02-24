/**
 * Pronote Service - Rétrocompatible facade
 *
 * Délègue vers les 3 sous-services (auth, data, search).
 * Zéro changement requis dans pronote.routes.ts et tool-executor.ts.
 */

import { pronoteAuthService } from './pronote/pronote-auth.service.js';
import { pronoteDataService } from './pronote/pronote-data.service.js';
import { pronoteSearchService } from './pronote/pronote-search.service.js';

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
} from './pronote/pronote-shared.js';

class PronoteService {
  // Auth
  connectParentWithQrCode = pronoteAuthService.connectParentWithQrCode.bind(pronoteAuthService);
  createChildMappings = pronoteAuthService.createChildMappings.bind(pronoteAuthService);
  disconnectParent = pronoteAuthService.disconnectParent.bind(pronoteAuthService);
  getParentConnectionStatus =
    pronoteAuthService.getParentConnectionStatus.bind(pronoteAuthService);
  getChildPronoteStatus = pronoteAuthService.getChildPronoteStatus.bind(pronoteAuthService);
  getChildMappings = pronoteAuthService.getChildMappings.bind(pronoteAuthService);

  // Data
  getHomeworkForChild = pronoteDataService.getHomeworkForChild.bind(pronoteDataService);
  getGradesForChild = pronoteDataService.getGradesForChild.bind(pronoteDataService);
  getTimetableForChild = pronoteDataService.getTimetableForChild.bind(pronoteDataService);

  // Search
  searchSchoolsByLocation =
    pronoteSearchService.searchSchoolsByLocation.bind(pronoteSearchService);
}

export const pronoteService = new PronoteService();
