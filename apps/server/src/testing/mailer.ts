/** The emails a test's app sends, kept in memory, and a wait for the next one to an address. */

import type { Email, Mailer } from '../platform/email/mailer';

export function memoryMailer() {
  const sent: Email[] = [];
  const waiting: { to: string; resolve: (email: Email) => void }[] = [];
  const mailer: Mailer = (email) => {
    sent.push(email);
    for (const waiter of waiting.filter(({ to }) => to === email.to)) {
      waiting.splice(waiting.indexOf(waiter), 1);
      waiter.resolve(email);
    }
    return Promise.resolve();
  };

  /**
   * The next email to `to`, sent after this call: wait for it before the request that sends it,
   * since the auth sends in the background, once its answer is out.
   */
  const next = (to: string) => new Promise<Email>((resolve) => waiting.push({ to, resolve }));

  /** The sign-in code an email carries in its subject. */
  const codeIn = ({ subject }: Email) => {
    const code = /\b\d{6}\b/.exec(subject)?.[0];
    if (!code) throw new Error(`No code in "${subject}"`);
    return code;
  };

  return { mailer, sent, next, codeIn };
}
