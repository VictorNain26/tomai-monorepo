# Pronote Onboarding + Profile Selection

**Date:** 2026-03-23
**Status:** Reviewed
**Scope:** Mobile app — parent onboarding, child import via Pronote, profile-based access

## Summary

Replace manual child creation with Pronote-based import. Replace student username/password login with a profile selection screen (Netflix-like) where children tap their name and enter a PIN. Pronote data stays 100% on-device (no server sync) for legal protection.

## Context

### Current flow (removed)
1. Parent creates child manually (form: name, DOB, level, username, password)
2. Optionally connects Pronote later
3. Child logs in separately with username + password

### New flow
1. Parent signs up → forced Pronote onboarding (first connection)
2. QR code scan + PIN → select children to import
3. Set PIN/password per child
4. Child opens app → profile selection → PIN → dashboard

## Architecture

### Flow: First-time parent (0 children)

```
Sign up → Auto-login → Detect 0 children
  → Onboarding Pronote screen (full screen, no skip)
  → Instructions: "Ouvrez Pronote sur un ordinateur → QR code"
  → Scan QR (existing PronoteQrScanner component)
  → Enter 4-digit Pronote PIN (existing PronotePinEntry component)
  → pawnote returns user.resources (children)
  → Multi-select children to import (new PronoteChildImport component)
  → For each selected child:
      - Create TomAI account (server POST /api/children, returns {id, username, password})
      - Map Pronote resource (setResourceMapping)
      - Set PIN or password (parent chooses per child)
  → Redirect to profile selection screen
```

### Flow: Returning parent (has children)

```
Login → Detect children exist
  → Profile selection screen
  → Tap "Parent" → parent PIN → Parent dashboard
  → Tap child name → child PIN → launchChildSession(childId) → Student dashboard
```

### Flow: Add more children later

```
Parent dashboard → Pronote section
  → Same QR flow → PronoteChildImport filters out already-imported children
  → (children whose name matches existing TomAI children are pre-excluded)
```

### Flow: App reinstall / new device

```
Login → Children exist on server (Better Auth accounts)
  → Profile selection shows children from server
  → PINs are lost (device-only) → parent must re-set PINs
  → Pronote must be reconnected (QR scan) → device-only token
  → In-app notice: "Pronote non connecté sur cet appareil. Reconnectez pour accéder aux devoirs et notes."
```

## Screens

### 1. Onboarding Pronote (`onboarding-pronote.tsx`)

Full-screen onboarding shown when parent has 0 children. Cannot be skipped.

**Content:**
- Tom avatar + "Bienvenue ! Pour commencer, connectons Pronote"
- Visual instructions: screenshot/illustration of Pronote QR code menu
- Disclaimer: "TomAI n'est pas affilié à Index Education. Vos données Pronote restent sur votre appareil."
- Button "Scanner le QR code" → opens existing QR scanner
- After successful scan + PIN → transitions to child import

### 2. Child Import (`PronoteChildImport.tsx`)

Shown after successful Pronote connection. Displays children from `user.resources`.

**Content:**
- Header: "Sélectionnez les enfants à ajouter"
- List of children with checkboxes: name + class + establishment
- Already-imported children shown as disabled/greyed (when adding more children later)
- "Tout sélectionner" toggle
- Button "Continuer" (disabled until ≥1 selected)

### 3. Child PIN Setup (`ChildPinSetup.tsx`)

Shown for each selected child sequentially.

**Content:**
- Avatar initial + child name
- School level picker (pre-filled from Pronote `className` inference, editable fallback)
- Toggle: PIN (4-6 digits) or Password
- Input field with confirmation
- Button "Suivant" / "Terminer" (last child)

### 4. Profile Selection (`profile-select.tsx`)

First screen after parent login (when children exist). Netflix-like grid.

**Content:**
- Header: "Qui utilise Tom ?"
- Grid of profile cards: avatar initial + name + class
- "Parent" profile card (distinct style, outlined)
- Tap → PIN prompt → session switch → navigate to dashboard

**Child tap flow:**
1. Show PinPrompt for selected child
2. Validate PIN hash
3. Call `launchChildSession(childId)` (Better Auth impersonation)
4. Call `refetchSession()` to sync React state
5. Stack.Protected guard flips → router navigates to `(student)` automatically

**Parent tap flow:**
1. Show PinPrompt for parent (parent sets their own PIN during first onboarding)
2. Validate PIN hash
3. Navigate to `(parent)/(home)` (session is already parent)

### 5. PIN Prompt (`PinPrompt.tsx`)

Modal shown when tapping a profile.

**Content:**
- "Entrez le code de [Prénom]"
- PIN input (numeric keypad) or password input (based on credential type)
- Error shake animation on wrong code (max 5 attempts, then lock 30s)
- Cancel button → back to profile selection
- "Code oublié ?" link → parent can reset child PIN from parent dashboard

### 6. Forgot PIN flow

Accessible from parent dashboard (child settings) or from PinPrompt.

**Flow:**
- Parent re-authenticates (re-enter parent PIN)
- Select child → set new PIN/password
- Device-only operation (no server call)

## Data Model

### New store: `child-access-store.ts`

Dedicated Zustand+MMKV store for profile access credentials. Separate from pronote-store (different domain).

```typescript
interface ChildAccessCredential {
  childId: string;
  type: 'pin' | 'password';
  hash: string;   // PBKDF2-SHA256 hex output
  salt: string;   // random hex, per-credential
}

interface ParentAccessCredential {
  type: 'pin';
  hash: string;
  salt: string;
}

interface ChildAccessStore {
  credentials: ChildAccessCredential[];
  parentCredential: ParentAccessCredential | null;
  setCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
  setParentCredential: (value: string) => Promise<void>;
  verifyCredential: (childId: string, value: string) => Promise<boolean>;
  verifyParentCredential: (value: string) => Promise<boolean>;
  removeCredential: (childId: string) => void;
  resetCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
}
```

**Hashing:** Use `expo-crypto` (already in Expo SDK 55, no native rebuild):
- `Crypto.getRandomBytes(16)` → salt (hex)
- `Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + value)` → hash
- 4-digit PINs are low-entropy but acceptable for device-local access (not network auth)

### Modified: Child creation

Server generates username + password. Client sends Pronote-derived data:

```typescript
// Request
POST /api/children
{
  name: "Marie Dupont",         // from UserResource.name
  schoolLevel: "troisieme",     // inferred from className, validated by parent
}

// Response
{
  id: "child-uuid",
  username: "marie.d-abc123",   // server-generated, unique
  password: "auto-generated",   // server-generated, never shown to user
}
```

### schoolLevel inference

Parse `UserResource.className` with regex patterns:

```typescript
const LEVEL_PATTERNS: [RegExp, string][] = [
  [/\bCP\b/i, 'cp'],
  [/\bCE1\b/i, 'ce1'],
  [/\bCE2\b/i, 'ce2'],
  [/\bCM1\b/i, 'cm1'],
  [/\bCM2\b/i, 'cm2'],
  [/\b6[eè]me?\b/i, 'sixieme'],
  [/\b5[eè]me?\b/i, 'cinquieme'],
  [/\b4[eè]me?\b/i, 'quatrieme'],
  [/\b3[eè]me?\b/i, 'troisieme'],
  [/\b2n?de?\b/i, 'seconde'],
  [/\b1[eè]re?\b/i, 'premiere'],
  [/\bT(er)?m?(inale)?\b/i, 'terminale'],
];

function inferSchoolLevel(className: string): string | null {
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(className)) return level;
  }
  return null; // fallback: parent picks manually in ChildPinSetup
}
```

If inference fails → `ChildPinSetup` screen shows a level picker (pre-existing `LevelPickerSheet` pattern).

## Legal Protections

### Device-only Pronote data

**Remove `pronoteCredentialsSync` (server sync).** All Pronote data stays on-device:
- Token: SecureStore (existing)
- Metadata + resources + mappings: MMKV Zustand store (existing)
- Homework, grades, timetable: MMKV Zustand store (existing)
- No `PUT /api/pronote/credentials` calls
- No `GET /api/pronote/credentials` calls

**Trade-off:** On app reinstall, Pronote must be reconnected (QR scan). Children still exist on the server, only Pronote connection + PINs need re-setup. An in-app notice guides the parent.

**Rationale:** Same architecture as Papillon (device-only, user-initiated). The Pronote feature is free (freemium model). Premium only increases AI tokens. No commercial exploitation of Pronote data.

### Consent
- QR scan is user-initiated (existing)
- Disclaimer on onboarding screen

### AI context
- `getChatContext()` stays — data is on-device, user consents by using the app
- Pronote data is never sent to TomAI server; it's injected client-side into the AI prompt

## Routing

The `(parent)/_layout.tsx` must be restructured from a flat MaterialTopTabs to a Stack wrapping the tabs:

```
(parent)/
├── _layout.tsx              → Stack navigator (replaces MaterialTopTabs at root)
│                              Routes: onboarding-pronote, profile-select, tabs
├── onboarding-pronote.tsx   → forced Pronote setup (0 children)
├── profile-select.tsx       → Netflix-like profile grid
├── tabs/                    → NEW route group for the tab shell
│   ├── _layout.tsx          → MaterialTopTabs (moved from parent _layout)
│   ├── (home)/              → parent dashboard
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── child/
│   │   └── pronote-connect.tsx
│   └── (profile)/           → parent settings
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── settings.tsx
│       └── pronote-connect.tsx
```

**`(parent)/_layout.tsx` logic:**
```typescript
export default function ParentLayout() {
  const { children, isLoading } = useParentDashboard();

  if (isLoading) return null; // splash still visible

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="profile-select" />
      <Stack.Screen name="onboarding-pronote" />
      <Stack.Screen name="tabs" />
    </Stack>
  );
}
```

**`profile-select.tsx` redirects to onboarding if 0 children:**
```typescript
if (children.length === 0) return <Redirect href="/(parent)/onboarding-pronote" />;
```

## Files to Create

| File | Purpose |
|---|---|
| `src/app/(parent)/onboarding-pronote.tsx` | Onboarding screen (forced for 0 children) |
| `src/app/(parent)/profile-select.tsx` | Profile selection screen (Netflix-like) |
| `src/app/(parent)/tabs/_layout.tsx` | MaterialTopTabs (moved from current parent _layout) |
| `src/components/parent/PronoteChildImport.tsx` | Multi-select children from Pronote resources |
| `src/components/parent/ChildPinSetup.tsx` | PIN/password + level setup per child |
| `src/components/parent/ProfileCard.tsx` | Individual profile card (avatar + name) |
| `src/components/parent/PinPrompt.tsx` | PIN entry modal for profile access |
| `src/stores/child-access-store.ts` | Zustand+MMKV store for PIN hashes |
| `src/lib/infer-school-level.ts` | className → schoolLevel regex mapper |

## Files to Modify

| File | Change |
|---|---|
| `src/app/(parent)/_layout.tsx` | Replace MaterialTopTabs with Stack (tabs moved to tabs/) |
| `src/app/(parent)/(home)/pronote-connect.tsx` | After connection → show PronoteChildImport; filter already-imported children |
| `src/services/pronote/pronote-session.ts` | Remove calls to pronoteCredentialsSync |
| `src/hooks/usePronote.ts` | Remove server sync (pushToServer/pullFromServer) |

## Files to Delete

| File | Reason |
|---|---|
| `src/services/pronote/pronote-credentials.ts` | Server sync removed (device-only) |
| `src/components/parent/PronoteChildSelectorModal.tsx` | Replaced by PronoteChildImport |

## Dependencies to Add

| Package | Purpose |
|---|---|
| `expo-crypto` | PIN hashing (PBKDF2-SHA256) — already in SDK 55, no native rebuild |

## Out of Scope

- Teacher/class flow (future — same architecture, `AccountKind = 8`)
- Multi-device Pronote sync (removed for legal reasons)
- EcoleDirecte / Skolengo support (future)
- Biometric unlock for profiles (future enhancement)
- Server-side Pronote endpoints cleanup (separate PR)
