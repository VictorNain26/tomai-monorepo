import { minutesText, questionFor, subjectLabel, type WeekSummary as Week } from '../lib/summary';

/**
 * The summary of the week (`docs/decisions.md`): the subjects and the time, what resists with the
 * help given, a question for the parent. The same content for the guardian and the student, said
 * to each; never a mark nor a progress.
 */
export function WeekSummary({ week, name, reader }: { week: Week; name: string; reader: 'guardian' | 'student' }) {
  const [first] = week.resisting;
  const sessions = `${String(week.sessions)} séance${week.sessions > 1 ? 's' : ''}`;
  const title = reader === 'guardian' ? 'Sa semaine' : 'Ta semaine';

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {week.sessions === 0 ? (
        <p className="text-muted-foreground">
          {reader === 'guardian' ? `${name} n’a pas ouvert de séance ces sept derniers jours.` : 'Pas de séance ces sept derniers jours.'}
        </p>
      ) : (
        <>
          <p>
            {reader === 'guardian' ? `${name} a travaillé` : 'Tu as travaillé'} {minutesText(week.minutes)}, en {sessions}.
          </p>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {week.subjects.map(({ subject, minutes }) => (
              <li key={subject}>
                {subjectLabel(subject)} : {minutesText(minutes)}
              </li>
            ))}
          </ul>
          <h3 className="font-bold text-foreground">Ce qui résiste</h3>
          {week.resisting.length === 0 ? (
            <p className="text-muted-foreground">Rien qui résiste cette semaine.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {week.resisting.map((notion) => (
                <li key={notion.notionId} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
                  <span className="font-bold">{notion.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {notion.lastSolved ? `Résolue ${notion.lastHelp}.` : `Pas encore résolue, ${notion.lastHelp}.`}
                    {notion.watch && ` À surveiller : ${notion.watch}.`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {first && (
            <p>
              {reader === 'guardian' ? 'Une question à poser : ' : 'La question proposée à ton parent : '}
              {questionFor(name, first.label)}
            </p>
          )}
        </>
      )}
      {reader === 'student' && <p className="text-sm text-muted-foreground">Ton parent voit ce même résumé.</p>}
    </section>
  );
}
