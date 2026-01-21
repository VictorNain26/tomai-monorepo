# Plan de Migration Mobile-Only - Tom

> **Contexte** : Migration de l'app web (apps/app) vers mobile-only (apps/mobile).
> **Landing page** : Reste en Next.js (apps/landing) - site vitrine inchangé.
> **Timeline** : Flexible, qualité > vitesse.

---

## 1. Architecture Cible

### Structure finale du monorepo

```
tomai-monorepo/
├── apps/
│   ├── landing/          # Next.js 16 - Site vitrine (INCHANGÉ)
│   ├── mobile/           # Expo SDK 54 - App principale (MIGRÉ)
│   ├── server/           # Bun + Elysia - Backend API (INCHANGÉ)
│   └── app/              # React web (ARCHIVÉ puis SUPPRIMÉ)
├── packages/
│   ├── api/              # Client API partagé (ENRICHI)
│   ├── shared-types/     # Types TypeScript (ENRICHI)
│   └── ui-primitives/    # Composants partagés (NOUVEAU - optionnel)
└── ...
```

### Stack Mobile 2026

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| **Framework** | Expo SDK 54+ | Production-proven (Discord, Shopify) |
| **Runtime** | React Native 0.83 | New Architecture (Fabric + TurboModules) |
| **Navigation** | Expo Router 6 | File-based routing, deep linking |
| **Styling** | NativeWind 4 | TailwindCSS natif, cohérent avec landing |
| **State** | TanStack Query 5 | Déjà en place, cache optimisé |
| **Forms** | TanStack Form | Validation type-safe |
| **UI** | React Native Reusables | shadcn/ui adapté RN |
| **Auth** | Better Auth | Déjà intégré via @repo/api |
| **Storage** | expo-secure-store | Tokens sécurisés |
| **Camera** | expo-camera | QR code Pronote |
| **Offline** | Legend-State ou MMKV | Local-first (optionnel) |

---

## 2. Design System Mobile - Guide Complet

> **Philosophie** : Un design qui aide à apprendre, pas qui distrait.
> Inspiré de la recherche UX éducative + landing page Tom + tendances 2025-2026.

### 2.1 Fondements Scientifiques

#### Théorie de la Charge Cognitive (John Sweller)

Le cerveau humain a une capacité limitée de traitement (5-7 éléments en mémoire de travail).
Notre design doit **minimiser la charge extrinsèque** (distractions) pour **maximiser la charge germane** (apprentissage).

| Type de charge | Description | Action design |
|----------------|-------------|---------------|
| **Intrinsèque** | Difficulté naturelle du contenu | Découper en étapes, méthode socratique |
| **Extrinsèque** | Overhead causé par le design | Éliminer : animations flashy, menus complexes |
| **Germane** | Effort productif d'apprentissage | Encourager : patterns familiers, feedback clair |

**Règles appliquées** :
- Maximum 3-4 actions par écran
- Navigation prévisible (pas de surprises)
- Feedback immédiat sur chaque action
- Progression visible à tout moment

#### Psychologie des Couleurs pour l'Apprentissage

Basé sur recherches University of British Columbia et études e-learning :

| Couleur | Effet cognitif | Utilisation Tom |
|---------|----------------|-----------------|
| **Bleu** | Concentration, confiance, calme | Couleur principale, backgrounds chat |
| **Vert** | Réduit fatigue visuelle, concentration longue | Succès, validation, Pronote sync |
| **Orange** | Énergie créative, confort | CTA secondaires, encouragements |
| **Violet** | Créativité, programmes officiels | Tags curriculum, sujets littéraires |
| **Rouge** | Attention aux détails (usage limité) | Erreurs uniquement, jamais dominant |
| **Jaune** | Stimule mémoire (avec parcimonie) | Highlights, accents |

**Principe clé** : Le vert sur les tâches de concentration (étude Dr. Kate Lee - 150 étudiants ont montré moins d'erreurs après exposition au vert).

### 2.2 Inspirations Analysées

#### Ce qu'on prend de Duolingo
- ✅ Sessions courtes (micro-learning)
- ✅ Feedback immédiat et encourageant
- ✅ Personnage/mascotte sympathique
- ❌ On évite : compétition, notifications agressives, gamification excessive

#### Ce qu'on prend de Khan Academy
- ✅ Parcours d'apprentissage adaptatif
- ✅ Pas de streaks (ils les ont supprimés : 99% des élèves ne les utilisaient pas)
- ✅ Focus sur la maîtrise, pas la vitesse
- ✅ Interface épurée, focus sur le contenu

#### Ce qu'on prend de Linear/Notion
- ✅ Minimalisme fonctionnel (pas décoratif)
- ✅ Raccourcis et efficacité
- ✅ Animations subtiles et rapides
- ✅ Dark mode bien pensé

#### Notre différenciateur : Méthode Socratique
- L'IA pose des questions, ne donne pas les réponses
- Design qui encourage la réflexion (pauses visuelles)
- Indicateur "Tom réfléchit..." qui modélise la pensée

### 2.3 Identité Visuelle Tom

#### Personnalité de marque

| Attribut | Expression design |
|----------|-------------------|
| **Bienveillant** | Coins arrondis, couleurs douces, messages encourageants |
| **Intelligent** | Typographie claire, espaces généreux, pas de fioritures |
| **Fiable** | Cohérence stricte, pas de surprises, feedback prévisible |
| **Français** | Respect des programmes Éduscol, vocabulaire adapté |

#### Mascotte : Tom le Cerveau

Inspiration landing page (Brain icon) mais **avec personnalité** :
- Expression neutre par défaut
- Souriant quand l'élève progresse
- Pensif (yeux vers le haut) quand il "réfléchit"
- Jamais triste ou négatif

```
États de Tom :
😊 Neutre      → Accueil, navigation
🤔 Réfléchit   → Génération réponse IA
😄 Encourage   → Bonne réponse, progression
💡 Aide        → Indice, suggestion
```

### 2.4 Palette de Couleurs

#### Mode Clair (Principal)

```typescript
const lightColors = {
  // === FOND & SURFACES ===
  background: '#FAFBFC',        // Gris très léger (pas blanc pur - réduit fatigue)
  surface: '#FFFFFF',           // Cartes, modals
  surfaceElevated: '#FFFFFF',   // Éléments surélevés

  // === PRIMAIRE : Bleu Éducation ===
  // Bleu = confiance + concentration (recherche UBC)
  primary: {
    50: '#EFF6FF',              // Backgrounds très légers
    100: '#DBEAFE',             // Hover states
    200: '#BFDBFE',             // Borders actifs
    300: '#93C5FD',             // Icons secondaires
    400: '#60A5FA',             // Links hover
    500: '#3B82F6',             // Links, icons actifs
    600: '#2563EB',             // PRIMARY - Boutons, CTA
    700: '#1D4ED8',             // Hover boutons
    800: '#1E40AF',             // Pressed states
    900: '#1E3A8A',             // Text sur fond clair
  },

  // === SUCCÈS : Vert Concentration ===
  // Vert = concentration prolongée, validation (étude Dr. Lee)
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',             // Icons, badges
    600: '#16A34A',             // Boutons succès
    700: '#15803D',             // Texte succès
  },

  // === AVERTISSEMENT : Orange Énergie ===
  // Orange = énergie créative, attention douce
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',             // Icons warning
    600: '#D97706',             // Badges, highlights
  },

  // === ERREUR : Rouge Minimal ===
  // Rouge uniquement pour erreurs (jamais dominant)
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',             // Icons erreur
    600: '#DC2626',             // Messages erreur
  },

  // === TEXTE ===
  text: {
    primary: '#0F172A',         // Titres, contenu principal
    secondary: '#475569',       // Descriptions, labels
    muted: '#94A3B8',           // Placeholders, hints
    inverse: '#FFFFFF',         // Sur fond coloré
  },

  // === BORDURES ===
  border: {
    light: '#E2E8F0',           // Séparateurs
    medium: '#CBD5E1',          // Inputs au repos
    focus: '#3B82F6',           // Focus state
  },

  // === MATIÈRES (accents par discipline) ===
  subjects: {
    mathematics: '#3B82F6',     // Bleu - logique
    french: '#8B5CF6',          // Violet - créativité littéraire
    sciences: '#22C55E',        // Vert - nature, expérimentation
    history: '#F59E0B',         // Ambre - archives, temps
    languages: '#EC4899',       // Rose - communication
    arts: '#F97316',            // Orange - créativité
  },
}
```

#### Mode Sombre

```typescript
const darkColors = {
  // === FOND & SURFACES ===
  background: '#0F172A',        // Slate 900 (pas noir pur)
  surface: '#1E293B',           // Slate 800
  surfaceElevated: '#334155',   // Slate 700

  // === PRIMAIRE ===
  primary: {
    // Valeurs inversées pour contraste
    500: '#60A5FA',             // Plus clair en dark mode
    600: '#3B82F6',
    // ... reste adapté
  },

  // === TEXTE ===
  text: {
    primary: '#F8FAFC',         // Slate 50
    secondary: '#CBD5E1',       // Slate 300
    muted: '#64748B',           // Slate 500
  },

  // === BORDURES ===
  border: {
    light: '#334155',           // Slate 700
    medium: '#475569',          // Slate 600
  },
}
```

### 2.5 Typographie

#### Fonts

| Usage | Font | Poids | Raison |
|-------|------|-------|--------|
| **Titres** | Plus Jakarta Sans | 600-700 | Moderne, friendly, lisible |
| **Corps** | Inter | 400-500 | Optimisé écrans, excellente lisibilité |
| **Code/Math** | JetBrains Mono | 400 | Monospace clair pour formules |

#### Échelle Typographique

```typescript
const typography = {
  // === TITRES ===
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans-Bold',
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans-Bold',
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },

  // === CORPS ===
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,        // 1.55 ratio - confort lecture
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
  },
  body: {
    fontSize: 16,
    lineHeight: 26,        // Généreux pour lisibilité mobile
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
  },

  // === UTILITAIRES ===
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
}
```

### 2.6 Espacement & Layout

#### Système 8pt

Tous les espacements sont multiples de 8 pour cohérence visuelle :

```typescript
const spacing = {
  '0': 0,
  '1': 4,      // Micro-ajustements
  '2': 8,      // Entre éléments liés
  '3': 12,     // Padding icons
  '4': 16,     // Padding standard
  '5': 20,     // Gap éléments
  '6': 24,     // Sections internes
  '8': 32,     // Séparation sections
  '10': 40,    // Grande séparation
  '12': 48,    // Entre sections majeures
  '16': 64,    // Haut/bas de page
}
```

#### Safe Areas & Touch Targets

```typescript
const layout = {
  // Minimum touch target (Apple HIG + Material)
  touchTarget: 44,

  // Padding écran
  screenPadding: 16,
  screenPaddingLarge: 24,

  // Cards
  cardPadding: 16,
  cardRadius: 16,

  // Inputs
  inputHeight: 48,
  inputRadius: 12,

  // Boutons
  buttonHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Bottom navigation
  tabBarHeight: 64,

  // Header
  headerHeight: 56,
}
```

### 2.7 Composants UI

#### Hiérarchie des Boutons

```typescript
const buttons = {
  // === PRIMARY === (1 par écran max)
  primary: {
    background: 'primary.600',
    text: 'white',
    shadow: 'md',
    // Gradient subtil pour premium feel
    gradient: ['primary.600', 'primary.700'],
  },

  // === SECONDARY ===
  secondary: {
    background: 'primary.50',
    text: 'primary.700',
    border: 'primary.200',
  },

  // === OUTLINE ===
  outline: {
    background: 'transparent',
    text: 'primary.600',
    border: 'primary.300',
  },

  // === GHOST ===
  ghost: {
    background: 'transparent',
    text: 'text.secondary',
  },

  // === DESTRUCTIVE ===
  destructive: {
    background: 'error.600',
    text: 'white',
  },
}
```

#### Cards (3 niveaux d'élévation)

```typescript
const cards = {
  // Niveau 1 : Surface standard
  flat: {
    background: 'surface',
    border: 'border.light',
    shadow: 'none',
    radius: 16,
  },

  // Niveau 2 : Légèrement élevé
  elevated: {
    background: 'surface',
    border: 'none',
    shadow: 'sm',
    radius: 16,
  },

  // Niveau 3 : Modal/overlay
  floating: {
    background: 'surfaceElevated',
    border: 'none',
    shadow: 'lg',
    radius: 20,
  },

  // Interactive (hover/press)
  interactive: {
    pressedScale: 0.98,
    pressedOpacity: 0.95,
    transition: '150ms ease-out',
  },
}
```

#### Chat Bubbles (Design conversationnel)

```typescript
const chatBubbles = {
  // Message utilisateur
  user: {
    background: 'primary.600',
    text: 'white',
    borderRadius: [20, 20, 4, 20],  // Coin bas-droite pointu
    maxWidth: '80%',
    align: 'right',
  },

  // Message Tom (assistant)
  assistant: {
    background: 'surface',
    text: 'text.primary',
    borderRadius: [20, 20, 20, 4],  // Coin bas-gauche pointu
    maxWidth: '85%',
    align: 'left',
    // Icône Tom à gauche
    avatar: true,
  },

  // Indicateur "Tom réfléchit"
  thinking: {
    background: 'primary.50',
    animation: 'pulse',
    dots: 3,
    dotColor: 'primary.400',
  },
}
```

### 2.8 Animations & Micro-interactions

#### Principes

1. **Purposeful** : Chaque animation a un but (feedback, orientation, continuité)
2. **Quick** : 150-300ms max (sauf transitions de page)
3. **Subtle** : Jamais distrayant du contenu
4. **Consistent** : Mêmes easings partout

#### Bibliothèque d'animations (Reanimated 4)

```typescript
const animations = {
  // === ENTRÉES ===
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: 200,
    easing: 'easeOut',
  },

  fadeInUp: {
    from: { opacity: 0, translateY: 16 },
    to: { opacity: 1, translateY: 0 },
    duration: 300,
    easing: 'easeOut',
  },

  fadeInScale: {
    from: { opacity: 0, scale: 0.95 },
    to: { opacity: 1, scale: 1 },
    duration: 250,
    easing: 'easeOut',
  },

  // === LISTES (stagger) ===
  staggerChildren: {
    delayBetween: 50,  // 50ms entre chaque item
    maxDelay: 300,     // Cap pour longues listes
  },

  // === INTERACTIONS ===
  press: {
    scale: 0.97,
    duration: 100,
    easing: 'easeInOut',
  },

  // === FEEDBACK ===
  success: {
    sequence: [
      { scale: 1.1, duration: 100 },
      { scale: 1, duration: 150 },
    ],
  },

  shake: {
    sequence: [
      { translateX: -8, duration: 50 },
      { translateX: 8, duration: 50 },
      { translateX: -4, duration: 50 },
      { translateX: 0, duration: 50 },
    ],
  },

  // === CHAT SPÉCIFIQUE ===
  messageAppear: {
    from: { opacity: 0, translateY: 8, scale: 0.98 },
    to: { opacity: 1, translateY: 0, scale: 1 },
    duration: 200,
  },

  thinkingDots: {
    // Animation des 3 points
    type: 'sequence',
    stagger: 150,
    animation: {
      scale: [1, 1.3, 1],
      opacity: [0.5, 1, 0.5],
      duration: 600,
    },
  },

  // === FLASHCARD ===
  cardFlip: {
    duration: 400,
    easing: 'easeInOut',
    // Rotation 3D sur axe Y
  },

  // === PROGRESS ===
  progressFill: {
    duration: 500,
    easing: 'easeOut',
  },
}
```

### 2.9 États UI Complets

#### Loading States

```typescript
const loadingStates = {
  // Skeleton pour contenu
  skeleton: {
    animation: 'pulse',
    baseColor: 'border.light',
    highlightColor: 'background',
    duration: 1500,
  },

  // Spinner pour actions
  spinner: {
    size: 24,
    color: 'primary.500',
    strokeWidth: 3,
  },

  // Chat thinking
  thinking: {
    message: "Tom réfléchit...",
    animation: 'dots',
  },

  // Progress déterminé
  progress: {
    showPercentage: true,
    animated: true,
  },
}
```

#### Empty States

```typescript
const emptyStates = {
  // Structure commune
  layout: {
    illustration: true,       // Image/animation
    title: true,              // Titre court
    description: true,        // Explication
    action: true,             // CTA principal
  },

  // Exemples
  noChats: {
    illustration: 'tom-waving',
    title: "Pas encore de conversation",
    description: "Pose ta première question à Tom !",
    action: "Commencer",
  },

  noDecks: {
    illustration: 'cards-stack',
    title: "Aucun deck de révision",
    description: "Crée ton premier deck avec l'aide de l'IA",
    action: "Créer un deck",
  },

  pronoteDisconnected: {
    illustration: 'link-broken',
    title: "Pronote non connecté",
    description: "Connecte-toi pour voir tes devoirs et notes",
    action: "Se connecter",
  },
}
```

#### Error States

```typescript
const errorStates = {
  // Erreur générique
  generic: {
    illustration: 'error-cloud',
    title: "Oups, quelque chose s'est mal passé",
    description: "Réessaie dans quelques instants",
    actions: ["Réessayer", "Retour"],
  },

  // Erreur réseau
  network: {
    illustration: 'wifi-off',
    title: "Pas de connexion",
    description: "Vérifie ta connexion internet",
    actions: ["Réessayer"],
  },

  // Erreur Pronote
  pronote: {
    illustration: 'school-error',
    title: "Impossible de contacter Pronote",
    description: "L'établissement est peut-être en maintenance",
    actions: ["Réessayer", "Aide"],
  },
}
```

### 2.10 Accessibilité

#### Contrastes minimums

| Élément | Ratio minimum | Notre ratio |
|---------|---------------|-------------|
| Texte normal | 4.5:1 | 7:1+ |
| Texte large | 3:1 | 4.5:1+ |
| Composants UI | 3:1 | 4:1+ |

#### Tailles de texte

- Minimum : 14px (jamais moins)
- Corps : 16px (standard)
- Support Dynamic Type (iOS) et Font Scaling (Android)

#### Touch targets

- Minimum : 44×44 points
- Espacement minimum entre targets : 8pt

#### Support lecteur d'écran

```typescript
// Tous les composants interactifs ont :
accessibilityLabel="Description de l'action"
accessibilityHint="Ce qui va se passer"
accessibilityRole="button|link|tab|etc"
```

### 2.11 Composants à Créer

| Composant | Priorité | Complexité | Notes |
|-----------|----------|------------|-------|
| **Button** | ✅ Existe | - | Ajouter variants gradient + loading |
| **Input** | ✅ Existe | - | Ajouter error/success states, icons |
| **Text** | ✅ Existe | - | Ajouter variants, fonts custom |
| **Card** | ✅ Existe | - | Ajouter pressed state, variants |
| **Avatar** | P0 | Low | User + Tom (avec états) |
| **Badge** | P0 | Low | Statut, matières, niveaux |
| **Progress** | P0 | Low | Linear + circular |
| **Skeleton** | P0 | Medium | Animated, responsive |
| **Toast** | P1 | Medium | Success/error/info + queue |
| **BottomSheet** | P1 | High | Snap points, gestures |
| **Tabs** | P1 | Medium | Animated indicator |
| **Alert** | P1 | Low | Inline alerts |
| **Accordion** | P2 | Medium | Animated expand |
| **Checkbox** | P2 | Low | Animated check |
| **Radio** | P2 | Low | Group support |
| **Switch** | P2 | Low | Animated toggle |
| **Slider** | P2 | Medium | Pour settings |

---

## 3. Structure des Fichiers Mobile

### Architecture proposée (Clean Architecture adaptée RN)

```
apps/mobile/src/
├── app/                          # Expo Router (routes)
│   ├── _layout.tsx              # Root layout + providers
│   ├── index.tsx                # Welcome/splash
│   ├── (auth)/                  # Auth screens (non-protégés)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (student)/               # Student tabs
│   │   ├── _layout.tsx          # Tab navigation
│   │   ├── index.tsx            # Dashboard
│   │   ├── chat/
│   │   │   ├── index.tsx        # Chat list/new
│   │   │   └── [sessionId].tsx  # Chat conversation
│   │   ├── learning/
│   │   │   ├── index.tsx        # Decks list
│   │   │   ├── new.tsx          # Create deck (AI)
│   │   │   └── [deckId].tsx     # Flashcard viewer
│   │   ├── pronote/
│   │   │   ├── index.tsx        # Status + connect
│   │   │   ├── homework.tsx
│   │   │   ├── grades.tsx
│   │   │   └── timetable.tsx
│   │   └── profile.tsx
│   └── (parent)/                # Parent tabs
│       ├── _layout.tsx
│       ├── index.tsx            # Dashboard
│       ├── children/
│       │   ├── index.tsx        # Children list
│       │   └── [childId]/
│       │       ├── index.tsx    # Child view
│       │       ├── homework.tsx
│       │       ├── grades.tsx
│       │       └── timetable.tsx
│       ├── pronote/
│       │   └── connect.tsx      # QR scanner
│       ├── subscription/
│       │   ├── index.tsx        # Manage
│       │   └── pricing.tsx
│       └── profile.tsx
│
├── components/
│   ├── ui/                      # Primitives (React Native Reusables)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── text.tsx
│   │   ├── card.tsx
│   │   ├── avatar.tsx           # NOUVEAU
│   │   ├── badge.tsx            # NOUVEAU
│   │   ├── skeleton.tsx         # NOUVEAU
│   │   ├── toast.tsx            # NOUVEAU
│   │   ├── bottom-sheet.tsx     # NOUVEAU
│   │   ├── progress.tsx         # NOUVEAU
│   │   ├── alert.tsx            # NOUVEAU
│   │   └── index.ts
│   ├── chat/                    # Chat feature
│   │   ├── message-bubble.tsx
│   │   ├── message-list.tsx
│   │   ├── chat-input.tsx
│   │   ├── thinking-indicator.tsx
│   │   ├── file-attachment.tsx
│   │   └── voice-input.tsx
│   ├── learning/                # Learning feature
│   │   ├── deck-card.tsx
│   │   ├── flashcard-viewer.tsx
│   │   ├── generation-wizard.tsx
│   │   └── topic-selector.tsx
│   ├── pronote/                 # Pronote feature
│   │   ├── qr-scanner.tsx
│   │   ├── homework-card.tsx
│   │   ├── grade-card.tsx
│   │   ├── timetable-day.tsx
│   │   └── connection-status.tsx
│   ├── dashboard/               # Dashboard feature
│   │   ├── subject-grid.tsx
│   │   ├── stats-card.tsx
│   │   ├── quick-actions.tsx
│   │   └── usage-card.tsx
│   ├── subscription/            # Subscription feature
│   │   ├── plan-card.tsx
│   │   ├── child-selector.tsx
│   │   └── usage-progress.tsx
│   └── common/                  # Shared
│       ├── auth-guard.tsx
│       ├── error-boundary.tsx
│       ├── loading-screen.tsx
│       └── empty-state.tsx
│
├── hooks/                       # Custom hooks
│   ├── useChat.ts              # Chat SSE streaming
│   ├── useVoiceInput.ts        # Speech-to-text
│   ├── usePronote.ts           # Pronote client-side
│   ├── usePresignedUpload.ts   # File upload
│   ├── useLearning.ts          # Flashcards
│   ├── useSubscription.ts      # Subscription state
│   ├── useTokenUsage.ts        # Token limits
│   └── useEducation.ts         # Levels/subjects
│
├── services/                    # Business logic
│   ├── pronote/
│   │   ├── client.ts           # Pawnote wrapper (CLIENT-SIDE)
│   │   ├── storage.ts          # Token storage (expo-secure-store)
│   │   └── types.ts
│   ├── audio/
│   │   ├── speech-to-text.ts   # Expo Speech
│   │   └── text-to-speech.ts   # ElevenLabs (optionnel)
│   └── notifications/
│       └── push.ts             # Expo Notifications
│
├── lib/
│   ├── api.ts                  # API client init
│   ├── query-client.ts         # TanStack Query
│   ├── storage.ts              # Secure storage utils
│   └── utils.ts                # cn(), formatters
│
├── constants/
│   ├── subjects.ts             # Matières par niveau
│   ├── levels.ts               # Niveaux scolaires
│   └── messages.ts             # UI strings (i18n ready)
│
├── types/
│   └── index.ts                # Types locaux
│
└── assets/
    ├── fonts/
    │   ├── PlusJakartaSans-*.ttf
    │   └── Inter-*.ttf
    └── images/
        └── ...
```

---

## 4. Features à Migrer (Checklist Exhaustive)

### 4.1 Authentification

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| Login email/password | ✅ | ✅ Existe | - |
| Register avec role | ✅ | ✅ Existe | - |
| Google OAuth | ✅ | 🟡 Partiel | P1 |
| Forgot password | ✅ | 🟡 API manque | P1 |
| Reset password | ✅ | ❌ | P1 |
| Session persistence | ✅ | ✅ Existe | - |
| Token refresh | ✅ | ❌ | P1 |
| 401 handling | ✅ | 🟡 Incomplet | P1 |

### 4.2 Chat (Streaming SSE)

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| Session create/fetch | ✅ | ❌ | P0 |
| Message streaming SSE | ✅ | ❌ | P0 |
| Message history | ✅ | ❌ | P0 |
| Thinking indicator | ✅ | ❌ | P1 |
| File attachments | ✅ | ❌ | P1 |
| Presigned upload | ✅ | ❌ | P1 |
| Voice input | ✅ | ❌ | P2 |
| Stop generation | ✅ | ❌ | P1 |
| Subject selection | ✅ | ❌ | P0 |
| Session list | ✅ | ❌ | P2 |

### 4.3 Learning (Flashcards)

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| List decks | ✅ | 🟡 UI only | P1 |
| Create deck manual | ✅ | ❌ | P2 |
| Create deck AI | ✅ | ❌ | P1 |
| Topic selector (RAG) | ✅ | ❌ | P1 |
| Flashcard viewer | ✅ | ❌ | P1 |
| Card flip animation | ✅ | ❌ | P1 |
| FSRS algorithm | ✅ | ❌ | P2 |
| QCM / Vrai-Faux | ✅ | ❌ | P2 |
| Delete deck/card | ✅ | ❌ | P2 |

### 4.4 Pronote (CLIENT-SIDE)

| Feature | Web (backend) | Mobile | Priorité |
|---------|---------------|--------|----------|
| QR code scanner | ✅ | ❌ | P0 |
| PIN input | ✅ | ❌ | P0 |
| Connect (Pawnote) | Backend | Client-side | P0 |
| Token storage | DB | expo-secure-store | P0 |
| Token refresh | Backend | Client-side | P0 |
| Homework fetch | ✅ | ❌ | P1 |
| Grades fetch | ✅ | ❌ | P1 |
| Timetable fetch | ✅ | ❌ | P1 |
| Child mapping | ✅ | ❌ | P1 |
| Connection status | ✅ | ❌ | P1 |
| Disconnect | ✅ | ❌ | P2 |

### 4.5 Subscription (RevenueCat)

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| Status check | ✅ | ✅ RevenueCat | - |
| Paywall display | N/A | ✅ RevenueCatUI | - |
| IAP purchase | N/A | ✅ RevenueCat | - |
| Manage subscription | N/A | ✅ CustomerCenter | - |
| Add/remove children | ✅ | ❌ | P2 |
| Cancel/resume | N/A | ✅ (via stores) | - |
| Token usage display | ✅ | ❌ | P1 |

### 4.6 Dashboard

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| Student dashboard | ✅ | 🟡 Basic | P1 |
| Subject grid | ✅ | 🟡 Hardcoded | P1 |
| Quick actions | ✅ | 🟡 Basic | P1 |
| Usage card | ✅ | ❌ | P1 |
| Recent sessions | ✅ | ❌ | P2 |
| Parent dashboard | ✅ | 🟡 Basic | P1 |
| Children list | ✅ | 🟡 UI only | P1 |
| Child progress | ✅ | ❌ | P2 |

### 4.7 UI/UX

| Feature | Web | Mobile | Priorité |
|---------|-----|--------|----------|
| Dark mode | ✅ | ❌ | P2 |
| Loading skeletons | ✅ | ❌ | P1 |
| Error states | ✅ | ❌ | P1 |
| Empty states | ✅ | 🟡 Basic | P1 |
| Toast notifications | ✅ | ❌ | P1 |
| Pull to refresh | N/A | ❌ | P1 |
| Haptic feedback | N/A | ❌ | P2 |

---

## 5. Pronote Client-Side Architecture

### Pourquoi client-side ?

Certains établissements bloquent les requêtes venant de serveurs (Koyeb).
Solution : les requêtes Pronote partent directement du mobile.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MOBILE                               │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │ expo-camera  │────▶│ QR Scanner   │───▶│ PIN Input    │ │
│  └──────────────┘     └──────────────┘    └──────┬───────┘ │
│                                                   │         │
│                                            ┌──────▼───────┐ │
│                                            │   Pawnote    │ │
│                                            │ (loginQrCode)│ │
│                                            └──────┬───────┘ │
│                                                   │         │
│           ┌───────────────────────────────────────┤         │
│           │                                       │         │
│    ┌──────▼───────┐                       ┌──────▼───────┐ │
│    │ expo-secure  │                       │   Pronote    │ │
│    │   -store     │◀── Token              │   Server     │ │
│    │  (encrypted) │    backup             │   (direct)   │ │
│    └──────────────┘                       └──────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ Sync token hash (optional)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│  - Auth Better Auth (inchangé)                               │
│  - Chat Gemini streaming (inchangé)                          │
│  - RAG Qdrant (inchangé)                                     │
│  - Pronote: stocke UNIQUEMENT hash pour recovery             │
└──────────────────────────────────────────────────────────────┘
```

### Implémentation Pawnote client-side

```typescript
// services/pronote/client.ts
import {
  loginQrCode,
  loginToken,
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  type SessionHandle,
} from 'pawnote';
import * as SecureStore from 'expo-secure-store';

const PRONOTE_TOKEN_KEY = 'pronote_session_token';
const PRONOTE_REFRESH_KEY = 'pronote_refresh_info';

export class PronoteClient {
  private session: SessionHandle | null = null;

  // Connexion via QR code (depuis le téléphone)
  async connectWithQR(qrData: QRCodeData, pin: string): Promise<void> {
    const session = await loginQrCode({
      qrCodeData: qrData,
      pin,
      deviceUUID: await this.getDeviceUUID(),
    });

    this.session = session;
    await this.saveSession(session);
  }

  // Refresh token
  async refreshSession(): Promise<void> {
    const refreshInfo = await this.getRefreshInfo();
    if (!refreshInfo) throw new Error('No refresh info');

    this.session = await loginToken({
      ...refreshInfo,
      deviceUUID: await this.getDeviceUUID(),
    });

    await this.saveSession(this.session);
  }

  // Récupérer les devoirs
  async getHomework(weekOffset = 0): Promise<Homework[]> {
    if (!this.session) await this.refreshSession();

    const now = new Date();
    const start = startOfWeek(addWeeks(now, weekOffset));
    const end = endOfWeek(start);

    const assignments = await assignmentsFromIntervals(this.session!, {
      from: start,
      to: end,
    });

    return this.mapHomework(assignments);
  }

  // Stockage sécurisé
  private async saveSession(session: SessionHandle): Promise<void> {
    const tokenData = JSON.stringify({
      token: session.token,
      instanceUrl: session.instanceUrl,
      // ... autres données nécessaires
    });

    await SecureStore.setItemAsync(PRONOTE_TOKEN_KEY, tokenData);
  }
}
```

### Modifications backend

Le backend n'a plus besoin de faire les appels Pronote. Il peut optionnellement :
- Stocker un hash du token pour recovery cross-device
- Logger les connexions pour analytics
- Garder le mapping parent→enfants

```typescript
// routes/pronote.routes.ts (simplifié)
app.post('/api/pronote/sync-token-hash', async ({ body, user }) => {
  // Stocke uniquement le hash pour recovery (optionnel)
  await db.update(pronoteConnections)
    .set({ tokenHash: body.hash, lastSyncAt: new Date() })
    .where(eq(pronoteConnections.userId, user.id));
});
```

---

## 6. Phases de Migration

### Phase 0 : Préparation (1 semaine)

**Objectif** : Setup propre, cleanup, foundations

- [ ] Supprimer `/app/login.tsx` (duplicate)
- [ ] Installer fonts (Plus Jakarta Sans, Inter)
- [ ] Configurer Reanimated 4 pour animations
- [ ] Créer composants UI manquants (Skeleton, Toast, Badge, etc.)
- [ ] Setup error boundary global
- [ ] Configurer expo-camera pour QR
- [ ] Ajouter pawnote au mobile
- [ ] Créer structure dossiers (hooks/, services/, etc.)

### Phase 1 : Auth complet (1 semaine)

**Objectif** : Auth robuste sans régression

- [ ] Fixer OAuth callback route
- [ ] Implémenter reset password screen
- [ ] Ajouter token refresh logic
- [ ] Implémenter 401 handler avec redirect
- [ ] Ajouter loading states auth
- [ ] Tester tous les flows auth

### Phase 2 : Chat streaming (2 semaines)

**Objectif** : Feature principale fonctionnelle

- [ ] Créer hook `useChat` avec SSE
- [ ] Implémenter message list avec FlatList optimisée
- [ ] Créer message bubble (user/assistant)
- [ ] Ajouter thinking indicator animé
- [ ] Implémenter subject selector
- [ ] Ajouter stop generation
- [ ] Créer session management
- [ ] Tester streaming long messages

### Phase 3 : File upload (1 semaine)

**Objectif** : Attachments fonctionnels

- [ ] Créer hook `usePresignedUpload`
- [ ] Implémenter file picker (images, PDF, audio)
- [ ] Ajouter preview attachments
- [ ] Intégrer avec chat input
- [ ] Tester upload large files

### Phase 4 : Pronote client-side (2 semaines)

**Objectif** : Pronote sans blocage établissements

- [ ] Créer QR scanner avec expo-camera
- [ ] Implémenter PIN input screen
- [ ] Créer PronoteClient service (Pawnote)
- [ ] Stocker token dans expo-secure-store
- [ ] Implémenter token refresh
- [ ] Créer screens homework/grades/timetable
- [ ] Implémenter child mapping (parent)
- [ ] Tester avec différents établissements

### Phase 5 : Learning (1.5 semaines)

**Objectif** : Flashcards fonctionnels

- [ ] Connecter API list decks
- [ ] Créer deck card component
- [ ] Implémenter AI generation wizard
- [ ] Créer topic selector (RAG)
- [ ] Implémenter flashcard viewer
- [ ] Ajouter flip animation
- [ ] (Optionnel) FSRS algorithm

### Phase 6 : Subscription RevenueCat (1 semaine) ✅

**Objectif** : Monétisation via IAP (App Store / Play Store)

- [x] Installer RevenueCat SDK
- [x] Créer `useSubscription` hook
- [x] Implémenter Paywall (RevenueCatUI)
- [x] Implémenter CustomerCenter (gestion abo)
- [x] Créer RevenueCatProvider (sync Better Auth)
- [x] Backend webhook handler (lifecycle events)
- [ ] Ajouter token usage display

### Phase 7 : Dashboard & Polish (1.5 semaines)

**Objectif** : UX complète

- [ ] Connecter subjects API au dashboard
- [ ] Implémenter usage card
- [ ] Ajouter pull to refresh
- [ ] Créer loading skeletons partout
- [ ] Implémenter error states
- [ ] Ajouter empty states
- [ ] Toast notifications
- [ ] (Optionnel) Dark mode
- [ ] (Optionnel) Haptic feedback

### Phase 8 : Testing & Store (1 semaine)

**Objectif** : Production-ready

- [ ] Tests E2E critiques (Detox ou Maestro)
- [ ] Test sur vrais devices (iOS + Android)
- [ ] Performance profiling
- [ ] App Store assets (screenshots, description)
- [ ] Play Store assets
- [ ] Soumission stores
- [ ] Deep linking setup

---

## 7. Estimation Totale

| Phase | Durée | Dépendances |
|-------|-------|-------------|
| Phase 0 : Préparation | 1 semaine | - |
| Phase 1 : Auth | 1 semaine | Phase 0 |
| Phase 2 : Chat | 2 semaines | Phase 1 |
| Phase 3 : File upload | 1 semaine | Phase 2 |
| Phase 4 : Pronote | 2 semaines | Phase 1 |
| Phase 5 : Learning | 1.5 semaines | Phase 2 |
| Phase 6 : Subscription | 1 semaine | Phase 1 |
| Phase 7 : Polish | 1.5 semaines | Phase 2-6 |
| Phase 8 : Store | 1 semaine | Phase 7 |

**Total : ~12 semaines** (flexible, qualité > vitesse)

Note : Phases 4, 5, 6 peuvent être parallélisées après Phase 2.

---

## 8. Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Pronote client-side ne fonctionne pas partout | Élevé | Moyenne | Tester 5+ établissements avant validation |
| SSE streaming instable sur mobile | Moyen | Faible | Fallback polling, reconnect auto |
| Apple rejection | Élevé | Faible | Respecter guidelines, pas de WebView cachée |
| Performance chat long messages | Moyen | Moyenne | FlatList virtualisée, pagination |
| expo-camera permissions refusées | Moyen | Faible | Fallback saisie manuelle token |
| Token Pronote expire fréquemment | Moyen | Moyenne | Refresh proactif, UX reconnexion simple |

---

## 9. Critères de Succès

### MVP (Fin Phase 4)

- [ ] Auth complet (login, register, OAuth, reset)
- [ ] Chat streaming fonctionnel
- [ ] Pronote client-side (QR + devoirs/notes)
- [ ] Navigation fluide

### V1.0 (Fin Phase 7)

- [ ] Toutes features web migrées
- [ ] Flashcards AI generation
- [x] Subscription RevenueCat (IAP)
- [ ] UX polish (loading, errors, empty)
- [ ] Dark mode (optionnel)

### V1.1+ (Post-launch)

- [ ] Push notifications
- [ ] Offline mode (local-first)
- [ ] Voice input
- [ ] TTS messages
- [ ] Analytics

---

## 10. Suppression du Web

Après validation mobile en production :

1. Rediriger `app.tomia.fr` vers stores (App Store / Play Store)
2. Archiver `apps/app/` dans branche `archive/web-app`
3. Supprimer du monorepo actif
4. Garder `apps/landing/` (site vitrine)
5. Garder `apps/server/` (backend API)

---

## Annexe A : Hooks à créer/porter

```typescript
// Liste des hooks à implémenter

// Auth (améliorer existant)
useAuthErrorHandler()

// Chat (nouveau)
useChat(sessionId?: string)
useChatSessions()
useStreamingSSE()

// Files (nouveau)
usePresignedUpload()
useFilePicker()

// Pronote (nouveau - client-side)
usePronoteClient()
usePronoteHomework()
usePronoteGrades()
usePronoteTimetable()

// Learning (nouveau)
useLearning()
useDecks()
useDeck(deckId)
useGenerateDeck()
useTopics(level, subject)

// Subscription RevenueCat (✅ implémenté)
useSubscription()      // RevenueCat SDK
useIsPro()             // Entitlement check
useTokenUsage()

// Dashboard (nouveau)
useStudentDashboard()
useParentDashboard()
useChildProgress()

// Education (améliorer)
useEducation()
useSubjects(level)
useLevels()
```

---

## Annexe B : API Endpoints utilisés

```typescript
// Auth (Better Auth)
POST /api/auth/sign-in
POST /api/auth/sign-up
POST /api/auth/sign-out
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/session

// Chat
POST /api/chat/session
POST /api/chat/stream (SSE)
GET  /api/chat/session/:sessionId/history

// Files
GET  /api/upload/presign
POST /api/upload/confirm/:fileId

// Learning
GET  /api/learning/decks
POST /api/learning/decks
GET  /api/learning/decks/:deckId
DELETE /api/learning/decks/:deckId
POST /api/learning/generate
GET  /api/learning/topics/:level/:subject

// Subscription (RevenueCat webhooks)
POST /webhooks/revenuecat  # Lifecycle events
GET  /api/tokens/usage

// Education
GET  /api/education/levels
GET  /api/subjects/:level

// Pronote (simplifié - client-side maintenant)
POST /api/pronote/sync-token-hash (optionnel)
GET  /api/pronote/child-mappings
POST /api/pronote/child-mappings
```

---

## Annexe C : Sources & Références Design

### Théorie de la Charge Cognitive
- [Cognitive Load Theory in UI Design - Aufait UX](https://www.aufaitux.com/blog/cognitive-load-theory-ui-design/)
- [Laws of UX - Cognitive Load](https://lawsofux.com/cognitive-load/)
- [14 Cognitive Principles for UX Designers - LogRocket](https://blog.logrocket.com/ux-design/cognitive-principles-for-ux-designers/)

### Psychologie des Couleurs en Éducation
- [How Do Colors Influence Learning - Shift E-learning](https://www.shiftelearning.com/blog/how-do-colors-influence-learning)
- [Color Psychology for Education - Art Co Bell](https://www.artcobell.com/en-us/blog/color-psychology-for-education)
- [Color Psychology in Study Spaces - Colourlovers](https://www.colourlovers.com/blog/2025/03/22/the-psychology-of-colors-in-study-spaces-how-to-boost-focus-and-creativity/)

### Apps Éducatives - Études de Cas
- [UX Case Study: Duolingo - Usability Geek](https://usabilitygeek.com/ux-case-study-duolingo/)
- [Decoding Duolingo - Medium](https://medium.com/gdg-vit/decoding-duolingo-how-technology-design-can-shape-learning-journeys-8a37f48138fc)
- [Education App Design Trends 2025 - Lollypop](https://lollypop.design/blog/2025/august/top-education-app-design-trends-2025/)

### Tendances UI Mobile 2025-2026
- [Mobile App Design Trends 2026 - Natively](https://natively.dev/blog/best-mobile-app-design-trends-2026)
- [UX Trends 2026 - Medium](https://medium.com/@mohitphogat/the-ux-trends-2026-designers-need-to-know-not-just-guess-3269d023b0b7)
- [Neumorphism vs Glassmorphism - CC Creative](https://www.cccreative.design/blogs/differences-in-ui-design-trends-neumorphism-glassmorphism-and-neubrutalism)

### Chatbot UI Design
- [31 Chatbot UI Examples - Eleken](https://www.eleken.co/blog-posts/chatbot-ui-examples)
- [15 Chatbot UI Examples - Sendbird](https://sendbird.com/blog/chatbot-ui)

### React Native & Expo
- [Five Years of React Native at Shopify](https://shopify.engineering/five-years-of-react-native-at-shopify)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [React Native New Architecture 2025](https://globaldev.tech/blog/react-native-architecture)

---

**Document créé le** : 2026-01-07
**Dernière mise à jour** : 2026-01-07
**Auteur** : Claude (migration plan)
**Version** : 2.0 (avec Design System complet)
