import {
  createSessionHandle,
  loginToken,
  loginQrCode,
  geolocation,
  gradesOverview,
  assignmentsFromIntervals,
  timetableFromIntervals,
  use,
  GradeKind,
  TabLocation,
  type AccountKind,
  type SessionHandle,
} from 'pawnote';
import type {
  PronoteProvider,
  ProviderSession,
  NormalizedGrade,
  NormalizedHomework,
  NormalizedLesson,
} from './provider.types';
import { assertAllowedPronoteUrl } from '../../lib/pronote-url-allowlist.js';
export { PronoteUrlNotAllowedError } from '../../lib/pronote-url-allowlist.js';

// ============================================
// Typed error — caller must re-auth from scratch
// ============================================

export class PronoteReauthRequired extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super('Pronote token rejected — full re-authentication required');
    this.name = 'PronoteReauthRequired';
    this.cause = cause;
  }
}

// ============================================
// Internal session carrying the live handle.
// connect() returns this; read methods reuse the handle without a second login.
// ============================================

export interface AdapterSession extends ProviderSession {
  handle: SessionHandle;
}

// ============================================
// Fetcher — spoofed mobile UA required by Pronote
// ============================================

export const PRONOTE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
  'PRONOTE Mobile APP Version/2.0.11';

// Pawnote expects a custom Response shape: { status, content, headers }
export function createServerFetcher() {
  return async (request: {
    url: URL;
    method?: 'GET' | 'POST';
    headers?: Record<string, string> | Headers;
    content?: string;
    redirect?: 'follow' | 'manual';
  }) => {
    assertAllowedPronoteUrl(request.url);
    const res = await fetch(request.url, {
      method: request.method ?? 'GET',
      headers: {
        ...(request.headers instanceof Headers
          ? Object.fromEntries(request.headers.entries())
          : request.headers),
        'User-Agent': PRONOTE_USER_AGENT,
      },
      body: request.method === 'POST' ? (request.content ?? undefined) : undefined,
      redirect: request.redirect,
    });

    const content = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { status: res.status, content, headers };
  };
}

// ============================================
// Helpers
// ============================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Narrows a ProviderSession to AdapterSession (which carries a live handle).
 * Sessions rebuilt from DB/cache (Task 5) will not have a handle, so this
 * guard makes the failure explicit rather than crashing deep inside pawnote.
 */
function assertAdapterSession(session: ProviderSession): AdapterSession {
  if (!('handle' in session) || session.handle == null) {
    throw new Error(
      'AdapterSession expected: session has no live handle. Call connect() before read methods.',
    );
  }
  return session as AdapterSession;
}

function getCurrentPeriod(handle: SessionHandle) {
  const gradesTab = handle.userResource.tabs.get(TabLocation.Grades);
  if (gradesTab?.defaultPeriod) return gradesTab.defaultPeriod;
  if (gradesTab?.periods && gradesTab.periods.length > 0) return gradesTab.periods[0];
  return null;
}

// ============================================
// Adapter
// ============================================

export class PawnoteServerAdapter implements PronoteProvider {
  async connect(input: {
    url: string;
    kind: number;
    username: string;
    token: string;
    deviceUuid: string;
  }): Promise<AdapterSession> {
    const handle = createSessionHandle(createServerFetcher());
    try {
      const info = await loginToken(handle, {
        url: input.url,
        kind: input.kind as AccountKind,
        username: input.username,
        token: input.token,
        deviceUUID: input.deviceUuid,
      });
      return { token: info.token, username: info.username, handle };
    } catch (cause) {
      throw new PronoteReauthRequired(cause);
    }
  }

  // resourceId identifies the child resource index on the Pronote account.
  // pawnote.use(handle, index) selects the active resource before each read.
  // Multi-child real-account validation is deferred to a parent integration test.
  async getGrades(session: ProviderSession, resourceId: number): Promise<NormalizedGrade[]> {
    const { handle } = assertAdapterSession(session);
    use(handle, resourceId);
    const period = getCurrentPeriod(handle);
    if (!period) return [];

    const overview = await gradesOverview(handle, period);
    return overview.grades.map((gr) => ({
      subject: gr.subject?.name ?? '',
      value: gr.value.kind === GradeKind.Grade ? gr.value.points : null,
      scale: gr.outOf.points,
      date: gr.date.toISOString().slice(0, 10),
      comment: gr.comment.length > 0 ? gr.comment : null,
      coefficient: gr.coefficient,
      classAverage: gr.average?.points ?? null,
      max: gr.max?.points ?? null,
      min: gr.min?.points ?? null,
    }));
  }

  async getHomework(session: ProviderSession, resourceId: number): Promise<NormalizedHomework[]> {
    const { handle } = assertAdapterSession(session);
    use(handle, resourceId);

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(now);
    to.setDate(to.getDate() + 14);

    const assignments = await assignmentsFromIntervals(handle, from, to);
    return assignments.map((a) => ({
      subject: a.subject?.name ?? '',
      description: stripHtml(a.description),
      dueDate: a.deadline.toISOString().slice(0, 10),
      done: a.done,
    }));
  }

  async getTimetable(
    session: ProviderSession,
    resourceId: number,
    day: string,
  ): Promise<NormalizedLesson[]> {
    const { handle } = assertAdapterSession(session);
    use(handle, resourceId);

    const from = new Date(day);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(day);
    to.setUTCHours(23, 59, 59, 999);

    const result = await timetableFromIntervals(handle, from, to);
    return result.classes
      .filter((c): c is typeof c & { is: 'lesson' } => c.is === 'lesson')
      .map((e) => ({
        subject: e.subject?.name ?? '',
        start: e.startDate.toISOString(),
        end: e.endDate.toISOString(),
        room: e.classrooms?.[0] ?? null,
        canceled: e.canceled,
      }));
  }

  async connectWithQrPayload(input: {
    qr: { jeton: string; login: string; url: string };
    pin: string;
  }): Promise<{
    session: AdapterSession;
    metadata: { instanceUrl: string; username: string; kind: number; deviceUuid: string };
    resources: { resourceId: number; name: string; className: string | null; establishmentName: string }[];
  }> {
    const deviceUuid = crypto.randomUUID();
    const handle = createSessionHandle(createServerFetcher());

    const info = await loginQrCode(handle, {
      deviceUUID: deviceUuid,
      pin: input.pin,
      qr: input.qr,
    });

    const resources = handle.user.resources.map((res, index) => ({
      resourceId: index,
      name: res.name,
      className: res.className ?? null,
      establishmentName: res.establishmentName,
    }));

    return {
      session: { token: info.token, username: info.username, handle },
      metadata: {
        instanceUrl: info.url,
        username: info.username,
        kind: info.kind as number,
        deviceUuid,
      },
      resources,
    };
  }

  async searchEstablishments(
    latitude: number,
    longitude: number,
  ): Promise<{ name: string; url: string; postalCode: number; distance: number }[]> {
    const instances = await geolocation({ latitude, longitude }, createServerFetcher());
    return instances
      .map((inst) => ({
        name: inst.name,
        url: inst.url,
        postalCode: inst.postalCode,
        distance: inst.distance,
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  async disconnect(_session: ProviderSession): Promise<void> {
    // Pawnote sessions are stateless server-side; nothing to close.
  }
}

export const pawnoteServerAdapter = new PawnoteServerAdapter();
