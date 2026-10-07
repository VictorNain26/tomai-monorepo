/**
 * The student's daily quota (`docs/etudes/2026-10-07/rentabilite.md`, § 1): 2 c a day in the Gratuit plan, every billed call counted, voice included; 10 c in
 * the Complet plan, with the payment. The day starts at 4 a.m. in Paris, so that an evening of
 * homework past midnight is not cut in two; the clocks change between 2 and 3 a.m., never at 4.
 */

/** 2 c, in the micro-euros `ai_cost` counts in. */
export const DAILY_BUDGET_MICRO_EUR = 20_000;

/** The hour, in Paris, the quota day starts at. */
export const QUOTA_RESET_HOUR = 4;
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
  const parts = PARIS.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((each) => each.type === type);
    if (!part) throw new Error(`No ${type} in the Paris time of ${date.toISOString()}`);
    return Number(part.value);
  };
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute') };
}

/** The instant the quota day of `now` started: the last 4 a.m. in Paris. */
export function quotaDayStart(now: Date): Date {
  const paris = parisParts(now);
  // Before 4 a.m., the day is still yesterday's; Date.UTC carries a day 0 back to the month before.
  const day = paris.hour < QUOTA_RESET_HOUR ? paris.day - 1 : paris.day;
  const asIfUtc = Date.UTC(paris.year, paris.month - 1, day, QUOTA_RESET_HOUR);
  // Paris' offset at that hour, read back from the same formatter.
  const there = parisParts(new Date(asIfUtc));
  const offset = Date.UTC(there.year, there.month - 1, there.day, there.hour, there.minute) - asIfUtc;
  return new Date(asIfUtc - offset);
}
