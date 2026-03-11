# Parent Redesign — Design Spec

## Goal

Refonte complete des ecrans parent TomIA. Cible : parents non-tech qui veulent voir en 1 coup d'oeil les notes, devoirs et activite de leurs enfants.

## Navigation

2 tabs uniquement :
- **Accueil** : Dashboard avec cartes enfants enrichies
- **Profil** : Compte, abonnement, Pronote, preferences

## Ecran 1 — Accueil (Dashboard)

**Route** : `/(parent)/(home)/index.tsx`

**Header** : "Bonjour [Prenom]" + bouton "+" ajouter enfant

**Corps** : Liste de cartes enfants. Chaque carte affiche :
- Avatar + Prenom + Niveau scolaire
- Moyenne Pronote (ou "—" si pas connecte)
- Nombre de devoirs a venir cette semaine
- Temps d'etude sur Tom cette semaine
- Streak (jours consecutifs d'etude)
- Badge Pronote connecte/non connecte

**Tap carte** → push vers detail enfant

**Empty state** : illustration + "Ajoutez votre premier enfant" + bouton CTA

**1 seul enfant** : carte pleine largeur, plus aeree

**Donnees** :
- `useParentDashboard()` → children, metrics (sessions, studyTime)
- `usePronote(userId)` → grades (pour moyenne), homework (pour count), isConnected

## Ecran 2 — Detail Enfant

**Route** : `/(parent)/(home)/child/[id]/index.tsx`

**Header** : Bouton retour + Prenom + bouton modifier

**Sections** :

### Resume semaine
Bandeau horizontal : Moyenne | Devoirs | Temps Tom

### Dernieres notes (3 max)
- Matiere : note/20 + tendance (fleche haut/bas/egal vs note precedente)
- Lien "Voir toutes" → push `grades.tsx` (existant)

### Devoirs a venir (3 max)
- Date + Matiere + Description courte
- Lien "Voir tous" → push `homework.tsx` (existant)

### Activite Tom
- Barre de progression temps d'etude semaine
- Nombre de sessions + streak

### Action
- Bouton "Lancer Tom pour [Prenom]" → impersonation (existant)

**Donnees** :
- `useParentDashboard()` → child info, metrics
- `usePronote(userId)` → grades, homework
- `useChildTokenUsage()` → supprime, remplace par metrics.studyTime

## Ecran 3 — Profil

**Route** : `/(parent)/(profile)/index.tsx`

**Sections** :
- User card : Avatar + nom + email + badge plan
- Abonnement : lien vers pricing (existant)
- Pronote : statut connexion + lien vers pronote-connect (existant)
- Preferences : theme (existant)
- Deconnexion

**Simplifie vs actuel** : suppression des placeholders (notifications, privacy, support)

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `(parent)/(home)/index.tsx` | Rewrite — nouveau dashboard cartes enrichies |
| `(parent)/(home)/child/[id]/index.tsx` | Rewrite — nouveau detail avec notes/devoirs/activite |
| `(parent)/(profile)/index.tsx` | Simplifier — supprimer placeholders |
| `components/parent/ChildCard.tsx` | Rewrite — carte enrichie avec donnees Pronote |

## Fichiers supprimes

| Fichier | Raison |
|---------|--------|
| `(parent)/(home)/child/[id]/timetable.tsx` | Pas utile pour le parent |
| `components/parent/ChildUsageCard.tsx` | Remplace par activite dans la carte |

## Fichiers conserves

- `grades.tsx`, `homework.tsx`, `edit.tsx` — drill-down existants
- `pricing.tsx`, `pronote-connect.tsx`, `settings.tsx` — profil existants
- `CreateChildModal.tsx`, `DeleteChildModal.tsx` — modales existantes
- `useParentDashboard.ts`, `usePronote.ts` — hooks existants

## Contraintes

- NativeWind uniquement (pas de StyleSheet)
- React Native Reusables pour les composants UI
- Fichiers < 400 lignes
- TypeScript strict, zero `any`
- Donnees Pronote device-first (Zustand/MMKV)
