import mathematiquesC3 from './texts/mathematiques-c3-2025.json' with { type: 'json' };
import francaisC3 from './texts/francais-c3-2025.json' with { type: 'json' };
import mathematiquesC4 from './texts/mathematiques-c4-2026.json' with { type: 'json' };
import francaisC4 from './texts/francais-c4-2026.json' with { type: 'json' };
import mathematiquesAttendus4e from './texts/mathematiques-attendus-4e-2019.json' with { type: 'json' };
import mathematiquesAttendus3e from './texts/mathematiques-attendus-3e-2019.json' with { type: 'json' };
import francaisAttendus4e from './texts/francais-attendus-4e-2019.json' with { type: 'json' };
import francaisAttendus3e from './texts/francais-attendus-3e-2019.json' with { type: 'json' };
import type { SchoolLevel } from '../domain/levels';
import { textFileSchema, type Entry, type TextFile } from './schema';
import { PROGRAMME_SOURCES, type ProgrammeSource } from './sources';

export type { Entry };

const texts: readonly TextFile[] = [
  mathematiquesC3,
  francaisC3,
  mathematiquesC4,
  francaisC4,
  mathematiquesAttendus4e,
  mathematiquesAttendus3e,
  francaisAttendus4e,
  francaisAttendus3e,
].map((file) => textFileSchema.parse(file));

/** Each extracted text with its source; a text whose PDF fingerprint changed fails at load. */
export const programmes: readonly { source: ProgrammeSource; entries: readonly Entry[] }[] = texts.map((file) => {
  const source = PROGRAMME_SOURCES.find((s) => s.id === file.sourceId);
  if (!source) throw new Error(`no source for ${file.sourceId}`);
  if (source.sha256 !== file.sha256) throw new Error(`${file.sourceId} was extracted from another PDF than the pinned one`);
  return { source, entries: file.entries };
});

/**
 * The programme in force for a class and a subject in the school year starting in
 * September of `schoolYear`, or null when none of the extracted texts applies yet.
 */
export function programmeFor(
  level: SchoolLevel,
  subject: ProgrammeSource['subject'],
  schoolYear: number,
): { source: ProgrammeSource; entries: Entry[] } | null {
  const applicable = programmes
    .filter(({ source }) => source.subject === subject && (source.appliesFrom[level] ?? Infinity) <= schoolYear)
    .sort((a, b) => (b.source.appliesFrom[level] ?? 0) - (a.source.appliesFrom[level] ?? 0));
  const [latest] = applicable;
  if (!latest) return null;
  return { source: latest.source, entries: latest.entries.filter((entry) => entry.level === level) };
}
