/**
 * The student's daily quota (`docs/etudes/2026-10-07/rentabilite.md`, § 1, retained by Victor on
 * 2026-10-07): 2 c a day in the Gratuit plan, every billed call counted, voice included; 10 c in
 * the Complet plan, with the payment. The day starts at 4 a.m. in Paris, so that an evening of
 * homework past midnight is not cut in two; the clocks change between 2 and 3 a.m., never at 4.
 */

/** 2 c, in the micro-euros `ai_cost` counts in. */
export const DAILY_BUDGET_MICRO_EUR = 20_000;

const RESET_HOUR = 4;
const PARIS = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Paris',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

function parisParts(date: Date) {
  const parts = Object.fromEntries(PARIS.formatToParts(date).map((part) => [part.type, Number(part.value)]));
  return { year: parts['year'] ?? 0, month: parts['month'] ?? 1, day: parts['day'] ?? 1, hour: parts['hour'] ?? 0, minute: parts['minute'] ?? 0 };
}

/** The instant the quota day of `now` started: the last 4 a.m. in Paris. */
export function quotaDayStart(now: Date): Date {
  const paris = parisParts(now);
  // Before 4 a.m., the day is still yesterday's; Date.UTC carries a day 0 back to the month before.
  const day = paris.hour < RESET_HOUR ? paris.day - 1 : paris.day;
  const asIfUtc = Date.UTC(paris.year, paris.month - 1, day, RESET_HOUR);
  // Paris' offset at that hour, read back from the same formatter.
  const there = parisParts(new Date(asIfUtc));
  const offset = Date.UTC(there.year, there.month - 1, there.day, there.hour, there.minute) - asIfUtc;
  return new Date(asIfUtc - offset);
}
