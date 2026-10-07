/** The emails a test's app sends, kept in memory, and the link each one carries. */

import type { Email, Mailer } from '../platform/email/mailer';

export function memoryMailer() {
  const sent: Email[] = [];
  const mailer: Mailer = (email) => {
    sent.push(email);
    return Promise.resolve();
  };

  /** The link of the last email sent to `to` whose subject contains `subject`. */
  const linkTo = (to: string, subject: string) => {
    const email = sent.findLast((each) => each.to === to && each.subject.includes(subject));
    const link = email?.text.match(/https?:\/\/\S+/)?.[0];
    if (!link) throw new Error(`No email to ${to} about "${subject}"`);
    return link;
  };

  return { mailer, sent, linkTo };
}
