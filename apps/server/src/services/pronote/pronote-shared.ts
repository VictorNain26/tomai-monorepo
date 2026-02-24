/**
 * Pronote Shared - Types, constants, fetcher
 */

import type { Fetcher } from '@literate.ink/utilities';
import type { SessionHandle } from 'pawnote';
import type { PronoteResource } from '../../db/schema.js';

export type { PronoteResource };

// =============================================
// CONSTANTS
// =============================================

/**
 * User-Agent requis pour Pronote Mobile
 * Source: Papillon app (github.com/PapillonApp/Papillon)
 */
export const PRONOTE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
  'PRONOTE Mobile APP Version/2.0.11';

/** Token expires in 5 minutes, refresh 30 seconds before */
export const TOKEN_EXPIRY_MS = 5 * 60 * 1000;
export const TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

/** Session pool TTL: 4 min (token dure 5 min) */
export const SESSION_POOL_TTL_MS = 4 * 60 * 1000;

// =============================================
// CACHE CONSTANTS
// =============================================

export const PRONOTE_CACHE = {
  PREFIX: 'pronote:',
  TTL: {
    HOMEWORK: 900, // 15 min
    GRADES: 3600, // 1h
    TIMETABLE: 1800, // 30 min
    SCHOOLS: 86400, // 24h
  },
} as const;

// =============================================
// SSRF ALLOWLIST
// =============================================

/**
 * SECURITY: Pronote URL allowlist - SSRF Protection
 * Official Pronote domains + ENT régionaux
 */
const PRONOTE_ALLOWED_DOMAINS = [
  // Core Pronote
  'index-education.net',
  // ENT nationaux / régionaux
  'pronote.toutatice.fr',
  'mon.lyceeconnecte.fr',
  'ent.iledefrance.fr',
  'enthdf.fr',
  'monbureaunumerique.fr',
  'e-lyco.fr',
  'l-educdenormandie.fr',
  'laclasse.com',
  // ENT régionaux additionnels
  'ent.auvergnerhonealpes.fr',
  'eclat-bfc.fr',
  'ent.occitanie-education.fr',
  'arsene76.fr',
  'ent27.fr',
  'ent.parisclassenumerique.fr',
  'ecollege.haute-garonne.fr',
  'webcollege.seinesaintdenis.fr',
  'moncollege-ent.essonne.fr',
];

export function isAllowedPronoteUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    return PRONOTE_ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// =============================================
// TYPES
// =============================================

export interface QrCodeData {
  jeton: string;
  login: string;
  url: string;
}

export interface PronoteConnectionResult {
  success: boolean;
  error?: string;
  establishmentName?: string;
  resources?: PronoteResource[];
}

export interface IndexEducationSchool {
  url: string;
  nomEtab: string;
  lat: string;
  long: string;
  cp: string;
}

export interface PronoteSchoolResult {
  name: string;
  url: string;
  distance: number;
  postalCode: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: Date;
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: Date;
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: Date;
  endDate: Date;
  canceled: boolean;
  status?: string;
}

export interface ChildMappingInput {
  childId: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
}

export interface SessionPoolEntry {
  session: SessionHandle;
  expiresAt: number;
}

// =============================================
// CUSTOM FETCHER
// =============================================

export const pronoteFetcher: Fetcher = async (options) => {
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      ...options.headers,
      'User-Agent': PRONOTE_USER_AGENT,
    },
    body: options.method !== 'GET' ? options.content : undefined,
    redirect: options.redirect,
  });

  return {
    content: await response.text(),
    status: response.status,
    headers: response.headers,
  };
};
