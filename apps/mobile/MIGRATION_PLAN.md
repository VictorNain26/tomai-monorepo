# Plan de Migration Mobile - TomIA

Migration de l'app web vers mobile-only (Expo SDK 54).

## Stack

- **Framework**: Expo SDK 54, React Native 0.81
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind (TailwindCSS)
- **UI**: React Native Reusables
- **State**: TanStack Query (server), React state (UI)
- **Auth**: Better Auth

---

## Phases Complétées

### ✅ Phase 0: Foundation
- Design system (NativeWind + React Native Reusables)
- Navigation tabs (student/parent)
- 401 handler avec redirect

### ✅ Phase 1: Auth
- Login dual (parent=email, student=username)
- Register (parent only)
- Forgot password (redirect Google OAuth)

### ✅ Phase 2: Student Dashboard
- `useStudentDashboard` hook
- `SubjectsGrid` component
- `TokenUsageCard` component
- Navigation vers chat avec subject

### ✅ Phase 3: Chat Core
- `useChat` hook avec SSE streaming
- `usePresignedUpload` hook (presign → S3 → confirm)
- `ChatMessage` et `ChatInput` components
- Pending attachments support

### ✅ Phase 4: Learning Decks
- `useLearning` hook (decks CRUD)
- `DeckCard` component
- `CardViewer` avec 13 types de cartes
- Deck play screen avec navigation

### ✅ Phase 5: Parent Dashboard
- `useParentDashboard` hook (children, stats, CRUD)
- `ChildCard` component
- `CreateChildModal` component
- Dashboard avec stats overview
- Children list avec gestion

### ✅ Phase 6: Child Details + Pronote
- `useParentPronote` hook (status, mappings, data)
- Child detail screen (`child/[id].tsx`)
- Pronote section avec status connecté/non connecté
- Navigation vers notes/devoirs/EDT (placeholder)

### ✅ Phase 7: Student Pronote
- `useStudentPronote` hook (status, homework, grades, timetable)
- `StudentPronoteCard` component (status + quick stats)
- Student dashboard avec section Pronote
- Pronote data screens complets :
  - `pronote/homework.tsx` - Liste devoirs groupés par date
  - `pronote/grades.tsx` - Notes par matière avec moyennes
  - `pronote/timetable.tsx` - EDT hebdomadaire avec navigation

### ✅ Phase 9: Profile & Settings
- `useTheme` hook (light/dark/system avec AsyncStorage)
- `ThemeProvider` component (NativeWind dark mode support)
- Settings screens (student + parent) avec theme toggle
- Student profile info screen (read-only niveau/LV2)
- Edit Child screen pour parents (modifier niveau/LV2)
- Menu profile simplifié avec navigation

---

## Phases Restantes

### ✅ Phase 8: Subscription (RevenueCat)
- [x] RevenueCat SDK integration
- [x] `useSubscription` hook (purchase, restore, status)
- [x] `Paywall` component (RevenueCatUI)
- [x] `CustomerCenter` component (manage subscription)
- [x] `RevenueCatProvider` (sync with Better Auth)
- [x] Backend webhook handler (lifecycle events)

---

## Architecture

```
src/
├── app/                    # Expo Router pages
│   ├── (auth)/             # Auth screens
│   ├── (student)/          # Student screens
│   └── (parent)/           # Parent screens
├── components/
│   ├── ui/                 # React Native Reusables
│   ├── chat/               # Chat components
│   ├── dashboard/          # Dashboard components
│   └── learning/           # Learning components
│       └── viewers/        # Card type viewers (by category)
├── hooks/                  # Custom hooks
└── lib/                    # Config (auth, api)
```

## Notes Techniques

### SSE Streaming
- `fetch` avec `ReadableStream`
- Parser: `data: {...}\n\n` format

### Key Prop Pattern
- Reset état viewer: `<CardViewer key={card.id} />`
- Évite props navigation complexes

### File Upload
- 3-step: presign → upload S3 → confirm
- Max 10MB, types: images, PDF, audio, documents
