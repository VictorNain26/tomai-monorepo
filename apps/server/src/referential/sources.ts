import type { CollegeLevel } from './schema.js';
import type { SUBJECT_SLUGS } from '../lib/subjects.js';

export interface ProgrammeSource {
  id: string;
  subject: (typeof SUBJECT_SLUGS)[number];
  title: string;
  /** Arrêté, NOR and Bulletin officiel that publish the text. */
  reference: string;
  url: string;
  /** Fingerprint of the PDF the entries were extracted from; a new BO changes it. */
  sha256: string;
  /** First school year (its September) in which the text applies, per class. */
  appliesFrom: Partial<Record<CollegeLevel, number>>;
}

const BO_16_2025 = 'Arrêté du 10-4-2025, NOR MENE2504620A, BO n° 16 du 17 avril 2025';
const BO_10_2026 = 'Arrêté du 18-2-2026, NOR MENE2602912A, BO n° 10 du 5 mars 2026';

export const PROGRAMME_SOURCES: readonly ProgrammeSource[] = [
  {
    id: 'mathematiques-c3-2025',
    subject: 'mathematiques',
    title: 'Programme de mathématiques pour le cycle 3',
    reference: BO_16_2025,
    url: 'https://www.education.gouv.fr/sites/default/files/programme-de-math-matiques-pour-le-cycle-3-439827.pdf',
    sha256: 'f3f79a75ca8be7f54409b8b7cee3eafd769c23d12e6c822a253454e2c703b508',
    appliesFrom: { sixieme: 2025 },
  },
  {
    id: 'francais-c3-2025',
    subject: 'francais',
    title: 'Programme de français pour le cycle 3',
    reference: BO_16_2025,
    url: 'https://www.education.gouv.fr/sites/default/files/programme-de-fran-ais-pour-le-cycle-3-439824.pdf',
    sha256: 'e7c27f55c212b5ebb92ba8b60b6b1b0761a2301e7c0d0d780171c4cfb6e121ae',
    appliesFrom: { sixieme: 2025 },
  },
  {
    id: 'mathematiques-c4-2026',
    subject: 'mathematiques',
    title: 'Programme de mathématiques pour le cycle 4, annexe 2',
    reference: BO_10_2026,
    url: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%202%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20pour%20le%20cycle%204-480716.pdf',
    sha256: 'e20a05da6c68a08c4487fc63a3345c902f5249b4bf6e950765bfb9c2da0aadb9',
    appliesFrom: { cinquieme: 2026, quatrieme: 2027, troisieme: 2028 },
  },
  {
    id: 'francais-c4-2026',
    subject: 'francais',
    title: 'Programme de français pour le cycle 4, annexe 1',
    reference: BO_10_2026,
    url: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%201%20%E2%80%93%20Programme%20de%20fran%C3%A7ais%20pour%20le%20cycle%204-480713.pdf',
    sha256: '19359a2d376f73f4d41ceb1098bff9ea4f69ab2abb63dc486e67ea30cd338187',
    appliesFrom: { cinquieme: 2026, quatrieme: 2027, troisieme: 2028 },
  },
];
