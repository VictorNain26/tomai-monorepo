import Bowser from 'bowser';

/** A device as a person names it, from its browser's user agent: « iOS · Safari ». */
export function deviceName(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Appareil inconnu';
  const { os, browser } = Bowser.parse(userAgent);
  const name = [os.name, browser.name].filter(Boolean).join(' · ');
  return name || 'Appareil inconnu';
}

const day = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const hour = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

/** « 7 octobre 2026 à 14:32 » */
export const formatDay = (date: string | Date) => day.format(new Date(date));

/** « 14:32 » */
export const formatHour = (date: string | Date) => hour.format(new Date(date));
