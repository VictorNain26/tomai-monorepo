/**
 * Sending an email: one function, passed to whoever sends. Scaleway Transactional Email in
 * production (docs/etudes/2026-10-07/email-transactionnel.md), through Scaleway's own SDK; in
 * development, the email is logged so that its link can be followed; the tests pass their own.
 */

import { createClient } from '@scaleway/sdk-client';
import { Temv1alpha1 } from '@scaleway/sdk-tem';
import type { Logger } from 'pino';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export type Mailer = (email: Email) => Promise<void>;

export interface ScalewayMail {
  accessKey: string;
  secretKey: string;
  projectId: string;
  from: string;
  /** Scaleway's API by default; the tests point it at their own server. */
  apiURL?: string | undefined;
}

// Past it, the email is abandoned and reported, instead of holding a background task.
const SEND_TIMEOUT_MS = 10_000;

export function scalewayMailer({ accessKey, secretKey, projectId, from, apiURL }: ScalewayMail): Mailer {
  const client = createClient({
    accessKey,
    secretKey,
    defaultProjectId: projectId,
    defaultRegion: 'fr-par',
    ...(apiURL === undefined ? {} : { apiURL }),
  });
  const tem = new Temv1alpha1.API(client);
  return async ({ to, subject, text }) => {
    await tem.createEmail(
      {
        from: { email: from, name: 'Tom' },
        to: [{ email: to }],
        subject,
        text,
        // The SDK requires an HTML part: the same text, escaped, one paragraph per line.
        html: Bun.escapeHTML(text)
          .split('\n')
          .map((line) => `<p>${line}</p>`)
          .join(''),
      },
      { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
    );
  };
}

/** Development only: the email in the log, its link to follow by hand. */
export function logMailer(logger: Logger): Mailer {
  return (email) => {
    logger.info({ email }, 'Email not sent (development)');
    return Promise.resolve();
  };
}
