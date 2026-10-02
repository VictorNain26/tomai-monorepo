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
  /** For a text that covers one class only: its headings carry domains, not classes. */
  level?: CollegeLevel;
}

const BO_16_2025 = 'Arrêté du 10-4-2025, NOR MENE2504620A, BO n° 16 du 17 avril 2025';
const BO_10_2026 = 'Arrêté du 18-2-2026, NOR MENE2602912A, BO n° 10 du 5 mars 2026';
const BO_22_2019 = 'Note de service n° 2019-072 du 28-5-2019, BOEN n° 22 du 29 mai 2019';

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
  // The open dataset « Compléments aux programmes du second degré » links these annexes to
  // the wrong classes; each class below is read from the rendered header of its PDF.
  {
    id: 'mathematiques-attendus-4e-2019',
    subject: 'mathematiques',
    title: 'Attendus de fin d’année de 4e, mathématiques (annexe 16)',
    reference: BO_22_2019,
    url: 'https://cache.media.education.gouv.fr/file/20/33/7/ensel283_annexe16_1120337.pdf',
    sha256: 'a046b660270013016787589ee16d0f373cf6ef0eff6eb5d3e7118efc2e739f95',
    appliesFrom: { quatrieme: 2019 },
    level: 'quatrieme',
  },
  {
    id: 'mathematiques-attendus-3e-2019',
    subject: 'mathematiques',
    title: 'Attendus de fin d’année de 3e, mathématiques (annexe 18)',
    reference: BO_22_2019,
    url: 'https://cache.media.education.gouv.fr/file/20/34/1/ensel283_annexe18_1120341.pdf',
    sha256: 'b60079ef0c070eb55101bf4aff12ac22d1f37eea16eb96fe3b049806a4a33228',
    appliesFrom: { troisieme: 2019 },
    level: 'troisieme',
  },
  {
    id: 'francais-attendus-4e-2019',
    subject: 'francais',
    title: 'Attendus de fin d’année de 4e, français (annexe 15)',
    reference: BO_22_2019,
    url: 'https://cache.media.education.gouv.fr/file/20/33/3/ensel283_annexe15_1120333.pdf',
    sha256: '454501dd629b24918a6d2c0d028a9429ef80534157f7fe9ff3377bbf9e7c238a',
    appliesFrom: { quatrieme: 2019 },
    level: 'quatrieme',
  },
  {
    id: 'francais-attendus-3e-2019',
    subject: 'francais',
    title: 'Attendus de fin d’année de 3e, français (annexe 17)',
    reference: BO_22_2019,
    url: 'https://cache.media.education.gouv.fr/file/20/33/9/ensel283_annexe17_1120339.pdf',
    sha256: 'c4d6abe4c077f0dfba549d6c4e7e0eb1320d240c96d913ec45546edbc362b75d',
    appliesFrom: { troisieme: 2019 },
    level: 'troisieme',
  },
];
