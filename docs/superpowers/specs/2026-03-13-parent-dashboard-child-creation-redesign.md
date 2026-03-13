# Refonte Dashboard Parent + Creation Enfant + Detail Enfant

**Date :** 2026-03-13
**Scope :** Mobile (`apps/mobile/`) — ecrans parent uniquement
**Approche :** Screen dedie (pas de modal) + carrousel + refonte design

---

## Contexte

Le dashboard parent utilise actuellement une modal plein ecran (322 lignes) avec une modal imbriquee pour le level picker. Ce pattern pose des problemes sur mobile : gestion clavier complexe, pas de navigation native, modales empilees. Le design du dashboard (liste verticale) et du detail enfant manque de polish.

## Decisions de design

- **Modal → Screen dedie** : la creation d'enfant devient une route Expo Router classique avec navigation push. Pattern mobile natif, keyboard handling gratuit, back button standard.
- **Pas de wizard** : 6 champs ne justifient pas un flow multi-etapes. Single page avec sections visuelles.
- **Level picker** : bottom sheet leger (pas de modal imbriquee). Niveaux groupes par cycle.
- **Carrousel** : les ChildCards passent d'une liste verticale a un carrousel horizontal snap-to-card. La derniere card = CTA d'ajout.
- **DeleteChildModal conserve** : le pattern de confirmation par nom fonctionne bien, pas besoin de le refaire.

---

## Section 1 — Dashboard Parent (Home)

**Route :** `/(parent)/(home)/index.tsx` (refonte)

### Header

- Titre H1 : "Bonjour, {prenom}"
- Sous-titre muted : "{n} enfant(s)"
- Pas de bouton "+" dans le header — le CTA est dans le contenu

### Carrousel enfants

- `FlatList` horizontal avec `snapToInterval={cardWidth}` et `decelerationRate="fast"` (PAS `pagingEnabled` — incompatible avec sub-full-width cards sur Android)
- `cardWidth = useWindowDimensions().width * 0.85` — applique a chaque card et a `snapToInterval`
- Chaque card prend 85% de la largeur ecran (la suivante depasse legerement pour inviter au swipe)
- Indicateur de pagination (dots) sous le carrousel

### Contenu d'une ChildCard

- Avatar circulaire avec initiales (couleur generee a partir du prenom)
- Prenom + badge niveau scolaire (ex: "6eme")
- Badge Pronote (connecte/non connecte) discret en haut a droite
- Grille 2x2 de stats :
  - Moyenne generale (icone chart)
  - Devoirs a venir (icone book)
  - Temps d'etude semaine (icone clock)
  - Serie de jours (icone flame)
- Bouton principal "Ouvrir" qui navigue vers le detail enfant

### Derniere card = card d'ajout

- Card meme taille, style dashed border + icone "+" centree
- Texte "Ajouter un enfant"
- Tap → navigation vers `/(parent)/(home)/add-child`

### Empty state (0 enfant)

- Illustration centree (icone Users stylisee)
- "Commencez par ajouter votre premier enfant"
- CTA button "Ajouter un enfant" → meme route add-child

---

## Section 2 — Ecran de creation d'enfant

**Route :** `/(parent)/(home)/add-child.tsx` (nouveau)

### Layout

- Screen pushe, header natif avec back arrow + titre "Nouvel enfant"
- `ScrollView` avec `KeyboardAvoidingView`, padding horizontal confortable

### Section "Identite"

| Champ | Type | Details |
|-------|------|---------|
| Prenom | Input texte | autoFocus, required |
| Nom | Input texte | required |
| Date de naissance | Input masque | DD/MM/YYYY, formatage auto |
| Niveau scolaire | Pressable → bottom sheet | Niveaux groupes : Primaire / College / Lycee |

### Level picker bottom sheet

- Bottom sheet construit avec les primitives React Native Reusables (pas de `@gorhom/bottom-sheet` — respect contrainte "React Native Reusables uniquement")
- Liste de niveaux groupes par cycle avec headers de section
- Selection = ferme le sheet, affiche le niveau choisi dans le champ
- Pas de modal imbriquee

### Section "Identifiants de connexion"

- Texte explicatif : "Ces identifiants permettront a votre enfant de se connecter a Tom."
- Bouton "Generer automatiquement" (style outlined, en haut de section)
  - Au tap : remplit username + password, animation fade-in
- Username : input texte, pre-rempli si genere, editable
- Mot de passe : input texte + toggle show/hide, pre-rempli si genere
- Hint sous password : "Min. 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre"

### Notes d'implementation

- Utiliser `react-hook-form` + `zodResolver(createChildFormSchema)` de `@/lib/child-form-schema`
- Date mask : utiliser `formatDateInput` de `@/lib/child-form-schema`
- Generation credentials : utiliser `generateUsername` / `generatePassword` de `@/lib/child-form-schema` (base sur `secureRandomInt`, pas `Math.random`)
- `add-child.tsx` appelle `useParentDashboard()` directement pour `createChild`, `isCreating`, et `levels`

### Bouton de validation

- Sticky en bas de l'ecran (au-dessus du clavier)
- "Creer le compte" — plein, primary color
- Disabled + opacity reduite tant que formulaire invalide
- Loading spinner pendant la requete

### Apres succes

- Navigation back vers dashboard (refresh via invalidation React Query)
- Toast : "{Prenom} peut maintenant utiliser Tom !"

### Apres erreur

- Toast destructif avec message d'erreur
- Formulaire reste rempli pour correction

---

## Section 3 — Ecran detail enfant

**Route :** `/(parent)/(home)/child/[id]/index.tsx` (refonte)

### Hero header

- Background avec degrade subtil (primary → transparent)
- Grand avatar circulaire centre (initiales, meme couleur que la card)
- Prenom en H1
- Badge niveau scolaire + badge Pronote cote a cote
- Bouton edit (icone crayon) en haut a droite

### Section stats — bande horizontale scrollable

- 3 mini-cards en row : Moyenne | Devoirs | Temps d'etude
- Chaque card : icone + valeur large + label muted
- Si pas de Pronote : cards moyenne/devoirs affichent "—" avec CTA discret "Connecter Pronote"

### Section "Notes recentes"

- Card avec titre + lien "Voir tout →" en haut a droite
- 3 dernieres notes (matiere, note, date)
- Si pas de Pronote : CTA "Connecter Pronote pour voir les notes"

### Section "Devoirs a venir"

- Meme pattern : titre + "Voir tout →"
- 3 prochains devoirs (matiere, intitule court, date)
- Si pas de Pronote : meme CTA

### Section "Activite"

- Card avec mini-stats : sessions cette semaine, temps total, serie de jours
- Barre de progression visuelle pour la semaine (lundi→dimanche, jours actifs colores)

### Bouton principal

- "Lancer Tom" — bouton large, primary, sticky en bas
- Tap → switch vers interface student

### Zone danger

- Lien texte discret "Supprimer ce profil" en destructive/muted (bas du scroll)
- Tap → DeleteChildModal existant (confirmation par nom)

---

## Fichiers impactes

### Nouveaux

| Fichier | Description |
|---------|-------------|
| `src/app/(parent)/(home)/add-child.tsx` | Ecran de creation d'enfant |
| `src/components/parent/LevelPickerSheet.tsx` | Bottom sheet pour selection niveau |
| `src/components/parent/AddChildCard.tsx` | Card d'ajout dans le carrousel |
| `src/components/parent/PaginationDots.tsx` | Indicateur de pagination carrousel |

### Modifies

| Fichier | Changement |
|---------|------------|
| `src/app/(parent)/(home)/index.tsx` | Refonte dashboard : header + carrousel + empty state |
| `src/components/parent/ChildCard.tsx` | Nouveau design card (avatar, stats grid, bouton ouvrir) |
| `src/app/(parent)/(home)/child/[id]/index.tsx` | Refonte detail : hero header, stats, sections, sticky CTA |
| `src/app/(parent)/(home)/_layout.tsx` | Ajouter `<Stack.Screen name="add-child" options={{ title: 'Nouvel enfant' }} />` |
| `src/components/parent/index.ts` | Supprimer exports CreateChildModal/LevelPickerModal, ajouter AddChildCard/PaginationDots/LevelPickerSheet |

### Supprimes

| Fichier | Raison |
|---------|--------|
| `src/components/parent/CreateChildModal.tsx` | Remplace par screen dedie |
| `src/components/parent/LevelPickerModal.tsx` | Remplace par bottom sheet |

### Inchanges

| Fichier | Raison |
|---------|--------|
| `src/components/parent/DeleteChildModal.tsx` | Fonctionne bien, pas de refonte |
| `src/hooks/useParentDashboard.ts` | API layer inchange — `add-child.tsx` l'appelle directement pour `createChild`, `isCreating`, `levels` |
| `src/lib/child-form-schema.ts` | Validation Zod reutilisee telle quelle |
| `apps/server/src/routes/api/parent.routes.ts` | Pas de changement backend |
| `apps/server/src/services/parent.service.ts` | Pas de changement backend |

---

## Hors scope

- Backend / API (aucun changement)
- Ecran edit enfant (`child/[id]/edit.tsx`)
- Pronote connect flow (`pronote-connect.tsx`, QR scanner, PIN entry)
- Ecrans de grades/homework complets (`child/[id]/grades.tsx`, `child/[id]/homework.tsx`)
- Profile parent (`/(parent)/(profile)/`)
- DeleteChildModal (conserve tel quel)
