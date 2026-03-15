# Refonte Auth Pages — "Warm Minimal Auth"

**Date** : 2026-03-15
**Scope** : `apps/mobile/src/app/(auth)/` + `src/components/auth/`
**Inspirations** : Pi (chaleur, simplicité), Linear (polish dark-first), Perplexity (espace)
**Principe** : Épurer, unifier, rendre premium — sans toucher à la logique auth

---

## 1. Composant partagé `AuthScreen`

**Fichier** : `src/components/auth/auth-screen.tsx`

Encapsule le pattern répété dans les 4 écrans formulaire :

```
KeyboardAvoidingView (flex-1, bg)
  └─ ScrollView (flexGrow: 1, keyboardShouldPersistTaps)
       └─ View (flex-1, justify-center, px-6, py-12)
            └─ {children}
```

**Props** :
- `children: ReactNode`

Pas de header, pas de back button — chaque écran gère son propre contenu. Le composant ne fait que DRY-er le wrapper clavier/scroll.

---

## 2. Login (`login.tsx`)

### Suppressions
- **Card wrapper** autour du formulaire → les inputs flottent directement sur le fond
- **`CARD_COLORS` hardcodé** (`#374151`) → supprimé entièrement
- **`TouchableOpacity`** → remplacé par `Pressable` partout
- **`<Text>` manuel dans Button** → utiliser le children string directement (Button sait styler)

### Segmented control raffiné

Remplacement du style actuel (bgColors.muted[50] + shadow + hardcoded colors) par :

- Fond du container : `bg-stone-200/50 dark:bg-stone-800/50` (NativeWind classes)
- Segment actif : `bg-white dark:bg-stone-700` avec `rounded-lg` (NativeWind classes, pas de shadow)
- Segment inactif : transparent
- Texte actif : `text-stone-800 dark:text-stone-100 font-semibold`
- Texte inactif : `text-stone-500 dark:text-stone-400`

Supprime l'import de `shadows` et `bgColors` pour le segmented control (reste utilisé pour l'error box et info box).

### Google OAuth avec icône

Ajouter une icône Google (SVG component) dans le bouton outline :
- Créer `src/components/icons/google-icon.tsx` — SVG simple du "G" Google multicolore
- Utilisé dans : `<Button variant="outline"><GoogleIcon size={20} /><Text>Continuer avec Google</Text></Button>`

### Structure résultante login

```
AuthScreen
  ├─ Header (TomAvatar + titre + sous-titre)
  ├─ Segmented control (Parent / Élève)
  ├─ Error alert (si erreur)
  ├─ Input (email ou username)
  ├─ Input (password)
  ├─ Forgot password link (parent only)
  ├─ Button "Se connecter"
  ├─ Divider "ou" (parent only)
  ├─ Button outline Google (parent only)
  ├─ Register link (parent only)
  └─ Info box élève (student only)
```

---

## 3. Register (`register.tsx`)

### Suppressions
- **Card wrapper** → inputs directement sur le fond
- **`TouchableOpacity`** → `Pressable`
- **`<Text>` manuel dans Button** → string children

### Password strength indicator

Remplacement de la validation séquentielle par erreur (qui affiche un seul message à la fois) par un indicateur progressif en temps réel :

4 critères affichés sous le champ mot de passe, chacun avec une icône :
- ✓ (emerald) ou ○ (stone-400) : "8 caractères minimum"
- ✓ ou ○ : "Une majuscule"
- ✓ ou ○ : "Une minuscule"
- ✓ ou ○ : "Un chiffre"

Implémenté directement dans register.tsx (pas de composant séparé — usage unique).

La validation au submit reste identique (même règles), mais l'UX montre le progrès en temps réel.

### Structure résultante register

```
AuthScreen
  ├─ Header (TomAvatar + titre + sous-titre)
  ├─ Error alert (si erreur)
  ├─ Input nom
  ├─ Input email
  ├─ Input mot de passe
  ├─ Password strength (4 critères inline)
  ├─ Input confirmer mot de passe
  ├─ Button "Créer mon compte"
  ├─ Divider "ou"
  ├─ Button outline Google
  └─ Login link
```

---

## 4. Forgot password (`forgot-password.tsx`)

### Changements
- **Utiliser `AuthScreen`** au lieu du pattern manuel
- **`TouchableOpacity`** → `Pressable`
- **`<Text>` manuel dans Button** → string children
- Le success state garde son layout propre (pas de AuthScreen — c'est un état différent sans clavier)

### Aucun changement de design
L'écran est déjà bien : header icon, form simple, success state propre.

---

## 5. Reset password (`reset-password.tsx`)

### Changements
- **Utiliser `AuthScreen`** pour le form state
- **`TouchableOpacity`** → `Pressable`
- **`<Text>` manuel dans Button** → string children
- Les états success et invalid token gardent leur layout propre

### Aucun changement de design majeur
Les 3 états (form, success, invalid) sont déjà bien structurés.

---

## 6. Callback (`callback.tsx`)

**Aucun changement.** L'écran est un simple spinner + texte, déjà minimal.

---

## 7. Google Icon

**Fichier** : `src/components/icons/google-icon.tsx`

SVG du "G" Google multicolore, exposé comme composant React Native avec prop `size`.

Utilisé dans login.tsx et register.tsx.

---

## 8. Hors scope

| Élément | Raison |
|---------|--------|
| Logique auth (signIn, signUp, etc.) | Fonctionne bien |
| Structure des routes (auth) | Correcte |
| callback.tsx | Déjà minimal |
| Accessibilité existante | Conservée et renforcée |
| Navigation stack (_layout.tsx) | Inchangé |

---

## 9. Bilan

| Métrique | Avant | Après |
|----------|-------|-------|
| Card wrappers | 2 (login, register) | 0 |
| Hardcoded hex | `#374151` (CARD_COLORS) | 0 |
| TouchableOpacity dans auth | 6 | 0 (→ Pressable) |
| Pattern KAV/ScrollView dupliqué | 4× | 1 (AuthScreen) |
| Password validation UX | Erreur séquentielle | 4 critères progressifs |
| Google icon | Absent | SVG multicolore |
| Lignes de code estimées | ~540 (4 écrans) | ~480 (4 écrans + AuthScreen) |
| Fonctionnalités perdues | — | 0 |
