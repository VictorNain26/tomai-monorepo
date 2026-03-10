# Pronote Device-First Architecture

Date: 2026-03-10
Status: Approved

## Context

TomAI integrates with Pronote (French school management) via pawnote, a reverse-engineered API wrapper. The current architecture routes all Pronote calls through the TomAI server, making TomAI a data processor of minors' school data under RGPD — high legal risk for a commercial app.

Papillon (600K+ users) proves the device-only approach works with the same library (pawnote ^1.6.2) in React Native/Expo.

## Decisions

1. **Device-first**: All Pronote API calls happen on the mobile device, never on the server
2. **Server = credential vault**: Stores encrypted credentials for multi-device sync only
3. **Age threshold at 15**: Under 15, parent connects Pronote for the child. 15+, student can connect autonomously (CNIL digital majority, art. 45 loi Informatique et Libertes)
4. **School search removed**: QR code contains the instance URL, geolocation search is unnecessary
5. **Chat context from device**: Mobile sends Pronote data (homework, grades, timetable) as part of the chat message body. Server passes it to Gemini, never stores it.

## Architecture

```
MOBILE (device)
  pawnote ──► Pronote servers (direct)
  SecureStore (token) + MMKV/Zustand (metadata + cache)
  ├── Dashboard (homework, grades, timetable)
  └── Chat: sends pronoteContext in message body ──►

SERVER (TomAI)
  PostgreSQL: encrypted credentials (sync only)
  Chat endpoint: receives pronoteContext, injects into Gemini prompt
  NEVER calls Pronote
```

## Server changes

### Deleted (entire Pronote server-side layer)

- `services/pronote/pronote-auth.service.ts`
- `services/pronote/pronote-data.service.ts`
- `services/pronote/pronote-search.service.ts`
- `services/pronote/pronote-session-pool.ts`
- `services/pronote/pronote-shared.ts`
- `services/pronote/index.ts`
- `services/pronote.service.ts`
- `routes/pronote/pronote-parent.routes.ts`
- `routes/pronote/pronote-student.routes.ts`
- `routes/pronote/pronote-public.routes.ts`
- `routes/pronote.routes.ts`
- `tests/pronote-auth.test.ts`

### Modified

- `app.ts` — remove old Pronote routes, add credential sync route
- `config/prompts/core/tools.ts` — remove server-side Pronote tool declarations
- `services/chat/tool-executor.ts` — remove server-side Pronote tool execution

### New

- `routes/pronote-sync.routes.ts` — PUT/GET/DELETE for encrypted credential sync
- `tests/pronote-sync.test.ts` — TDD tests for sync endpoints

### DB migration

Replace 2 tables (`pronote_connections` + `pronote_child_mappings`) with 1:

```typescript
pronote_credentials = pgTable('pronote_credentials', {
  id: uuid().primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull().unique(),
  encryptedToken: text('encrypted_token').notNull(),
  encryptedMetadata: text('encrypted_metadata').notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Mobile changes

### Deleted

- `hooks/useParentPronote.ts`
- `hooks/useStudentPronote.ts`

### New

```
mobile/src/
├── services/pronote/
│   ├── pronote-session.ts        # pawnote: createSession, refreshSession
│   ├── pronote-data.ts           # fetchHomework, fetchGrades, fetchTimetable
│   ├── pronote-types.ts          # Single source of truth for types
│   └── pronote-credentials.ts    # Sync encrypted credentials with server
├── stores/
│   └── pronote-store.ts          # Zustand + MMKV persist
├── hooks/
│   └── usePronote.ts             # Unified hook (replaces useParentPronote + useStudentPronote)
```

### Storage strategy

| Data | Storage | Reason |
|------|---------|--------|
| Refresh token | expo-secure-store | Sensitive, OS-level encryption |
| Instance URL, username, deviceUUID | MMKV (Zustand) | Non-sensitive, fast access |
| Homework/grades/timetable cache | MMKV (Zustand) | Offline support, performance |
| Resource index mappings | MMKV (Zustand) | Parent maps Pronote children locally |

### Modified

- `components/parent/PronoteQrScanner.tsx` — keep, adapt to device-first flow
- `components/parent/PronotePinEntry.tsx` — keep, adapt
- `components/parent/PronoteChildSelectorModal.tsx` — keep, adapt to local store
- `app/(parent)/(profile)/pronote-connect.tsx` — rewrite for device-first
- `app/(student)/(profile)/pronote/` — add connect button for age >= 15

## Connection flows

### Parent connects for child (< 15 years)

1. Parent logged into app → child profile → "Connect Pronote"
2. Scan QR (Pronote parent space) + enter PIN
3. pawnote `loginQrCode()` on device
4. Token → SecureStore, metadata → MMKV
5. Credentials encrypted and synced to server (backup)
6. Parent selects which Pronote resource maps to which TomAI child

### Student connects autonomously (>= 15 years)

1. Student logged in → Profile → "Connect Pronote"
2. Same QR + PIN flow
3. Same storage + sync

### Multi-device sync

1. User logs in on new device
2. App fetches encrypted credentials from server
3. Decrypts and stores locally
4. pawnote `loginToken()` to restore session

## Chat integration

Message body includes optional Pronote context:

```typescript
interface ChatMessage {
  message: string;
  pronoteContext?: {
    homework: PronoteHomework[];
    recentGrades: PronoteGrade[];
    todayTimetable: PronoteTimetableEntry[];
  };
}
```

Server injects into Gemini prompt, never persists Pronote data.

## TDD approach

All new code follows Red-Green-Refactor:

1. Server: test credential sync endpoints (PUT/GET/DELETE + auth + encryption)
2. Mobile: test pronote-session (mock pawnote), pronote-data (mock pawnote), pronote-store (Zustand), usePronote hook
3. Mobile: test age-gating logic (< 15 vs >= 15)
