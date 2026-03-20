# Maestro E2E Testing — Spec

**Date** : 2026-03-20
**Scope** : apps/mobile
**Objectif** : Mettre en place des tests E2E automatises avec Maestro pour les flows critiques de l'app mobile, integres au CI via EAS Workflows.

---

## Contexte

- Zero `testID` dans le projet actuellement — il faut en ajouter sur les elements critiques
- App ID : `fr.tomia.mobile`
- Build preview : APK Android (`eas.json` profile `preview`)
- API staging : `https://api-staging.tomia.fr`
- EAS Workflow preview existant : `.eas/workflows/preview-android.yml`
- Tab labels : **Accueil**, **Tom** (chat), **Revisions** (learning), **Profil**

---

## Prerequis

### Compte test E2E

Creer **avant la premiere execution** un compte test dedie sur l'API staging :
- **Etudiant** : username `e2e_student_test`, password stocke en secret EAS
- **Parent** : email `e2e-parent@test.tomia.fr`, password stocke en secret EAS
- Le compte parent a un enfant avec un deck de flashcards pre-rempli (au moins 1 carte)

### API staging

L'API staging doit etre en ligne et fonctionnelle. Les tests E2E dependent du reseau — ils sont un **signal**, pas un gate de merge (ne pas bloquer le CI dessus).

### Secrets EAS

Configurer dans EAS Dashboard > Secrets :
- `E2E_STUDENT_USERNAME` = `e2e_student_test`
- `E2E_STUDENT_PASSWORD` = (mot de passe du compte test)
- `E2E_PARENT_EMAIL` = `e2e-parent@test.tomia.fr`
- `E2E_PARENT_PASSWORD` = (mot de passe du compte test)

Maestro accede aux secrets EAS via la syntaxe `${VAR_NAME}` dans les flows YAML. Les secrets sont injectes automatiquement par l'environnement EAS Workflows.

---

## 1. Installation et configuration

### 1.1 Structure des fichiers

```
apps/mobile/
  e2e/
    auth-student.yaml         # Login etudiant → dashboard
    auth-parent.yaml          # Login parent → child list
    chat-send-message.yaml    # Envoi message + reponse
    learning-flashcard.yaml   # Deck → carte → reponse
  .maestro/
    config.yaml               # Config globale Maestro
```

### 1.2 Config Maestro

`.maestro/config.yaml` :
```yaml
appId: fr.tomia.mobile
```

### 1.3 Ajout de `testID` sur les elements critiques

Les `testID` sont plus stables que le matching par texte (resistant aux changements de libelle). Ajouter des `testID` sur :

**Login screen** (`src/app/(auth)/login.tsx`) :
- Toggle Parent : `testID="login-toggle-parent"`
- Toggle Eleve : `testID="login-toggle-student"`
- Input identifiant : `testID="login-identifier-input"`
- Input mot de passe : `testID="login-password-input"`
- Bouton "Se connecter" : `testID="login-submit-button"`
- Message d'erreur : `testID="login-error-message"`

**Student dashboard** (`src/app/(student)/(home)/index.tsx`) :
- Container principal : `testID="student-dashboard"`

**Chat** (`src/app/(student)/(chat)/chat.tsx`) :
- Input message : `testID="chat-input"`
- Bouton envoyer : `testID="chat-send-button"`

**Learning** (`src/app/(student)/(learning)/index.tsx`) :
- Liste des decks : `testID="deck-list"`

**Parent dashboard** (`src/app/(parent)/(home)/index.tsx`) :
- Container principal : `testID="parent-dashboard"`

---

## 2. Flows E2E

### 2.1 Auth etudiant (`e2e/auth-student.yaml`)

```yaml
appId: fr.tomia.mobile
---
- launchApp:
    clearState: true
- assertVisible: "Tom"
- tapOn:
    id: "login-toggle-student"
- tapOn:
    id: "login-identifier-input"
- inputText: "${E2E_STUDENT_USERNAME}"
- tapOn:
    id: "login-password-input"
- inputText: "${E2E_STUDENT_PASSWORD}"
- tapOn:
    id: "login-submit-button"
- extendedWaitUntil:
    visible:
      id: "student-dashboard"
    timeout: 10000
```

### 2.2 Auth parent (`e2e/auth-parent.yaml`)

Le toggle "Parent" est l'etat par defaut, mais on le tape explicitement pour la robustesse.

```yaml
appId: fr.tomia.mobile
---
- launchApp:
    clearState: true
- assertVisible: "Tom"
- tapOn:
    id: "login-toggle-parent"
- tapOn:
    id: "login-identifier-input"
- inputText: "${E2E_PARENT_EMAIL}"
- tapOn:
    id: "login-password-input"
- inputText: "${E2E_PARENT_PASSWORD}"
- tapOn:
    id: "login-submit-button"
- extendedWaitUntil:
    visible:
      id: "parent-dashboard"
    timeout: 10000
```

### 2.3 Chat send message (`e2e/chat-send-message.yaml`)

```yaml
appId: fr.tomia.mobile
---
# Login as student
- launchApp:
    clearState: true
- tapOn:
    id: "login-toggle-student"
- tapOn:
    id: "login-identifier-input"
- inputText: "${E2E_STUDENT_USERNAME}"
- tapOn:
    id: "login-password-input"
- inputText: "${E2E_STUDENT_PASSWORD}"
- tapOn:
    id: "login-submit-button"
- extendedWaitUntil:
    visible:
      id: "student-dashboard"
    timeout: 10000

# Navigate to chat (tab label = "Tom")
- tapOn: "Tom"

# Send message
- tapOn:
    id: "chat-input"
- inputText: "Bonjour, explique-moi le theoreme de Pythagore"
- tapOn:
    id: "chat-send-button"

# Wait for AI response (SSE streaming, generous timeout)
# Assert on generic text that any math response would contain
- extendedWaitUntil:
    visible: "triangle"
    timeout: 30000
```

### 2.4 Learning flashcard (`e2e/learning-flashcard.yaml`)

Prerequis : le compte e2e_student_test a au moins un deck avec des cartes.

```yaml
appId: fr.tomia.mobile
---
# Login as student
- launchApp:
    clearState: true
- tapOn:
    id: "login-toggle-student"
- tapOn:
    id: "login-identifier-input"
- inputText: "${E2E_STUDENT_USERNAME}"
- tapOn:
    id: "login-password-input"
- inputText: "${E2E_STUDENT_PASSWORD}"
- tapOn:
    id: "login-submit-button"
- extendedWaitUntil:
    visible:
      id: "student-dashboard"
    timeout: 10000

# Navigate to learning (tab label = "Revisions")
- tapOn: "Révisions"

# Wait for deck list
- extendedWaitUntil:
    visible:
      id: "deck-list"
    timeout: 10000

# Tap first visible deck
- tapOn:
    index: 0
    id: "deck-list"
```

---

## 3. Integration CI — EAS Workflows

### 3.1 Modifier le workflow preview Android

Ajouter un job `e2e` apres le build/repack dans `.eas/workflows/preview-android.yml`.

**Note** : Le type `maestro-test` est un type de job EAS Workflows pour l'execution de tests Maestro sur les builds. Si ce type n'est pas disponible dans votre version d'EAS CLI, utiliser un job custom avec `npx maestro test` a la place.

```yaml
e2e:
  name: Run E2E Tests (Maestro)
  after: [repack, build]
  type: maestro-test
  params:
    build_id: ${{ needs.build.outputs.build_id || needs.repack.outputs.build_id }}
    flow_path: e2e/
```

**Fallback si `maestro-test` n'est pas disponible** :

```yaml
e2e:
  name: Run E2E Tests (Maestro)
  after: [repack, build]
  type: custom
  image: ubuntu-latest
  steps:
    - run:
        name: Install Maestro
        command: curl -Ls "https://get.maestro.mobile.dev" | bash
    - run:
        name: Run E2E flows
        command: |
          export PATH="$PATH:$HOME/.maestro/bin"
          maestro test e2e/ --format junit
```

### 3.2 Workflow dedie E2E (optionnel, pour plus tard)

```yaml
name: E2E Tests
on:
  workflow_dispatch: {}
jobs:
  build:
    name: Build Preview APK
    type: build
    params:
      platform: android
      profile: preview
  e2e:
    name: Maestro E2E
    needs: [build]
    type: maestro-test
    params:
      build_id: ${{ needs.build.outputs.build_id }}
      flow_path: e2e/
```

---

## 4. Contraintes et risques

- **SSE chat timeout** : les reponses AI peuvent prendre 10-30s. Timeout genereux (30s) sur le flow chat.
- **Flakiness** : les E2E sur reseau reel sont inherement fragiles. Ne pas bloquer le merge sur les E2E — les utiliser comme **signal**, pas comme gate.
- **Assertion chat** : on verifie un mot generique ("triangle") plutot qu'un mot exact. L'IA peut varier ses reponses.
- **Google OAuth** : non testable en E2E automatise. Exclus du scope.
- **Pronote QR** : dependance externe, exclus du scope.
- **testID ajout** : changement mineur sur les ecrans existants, zero impact fonctionnel.
- **Compte test** : doit etre cree manuellement sur l'API staging avant la premiere execution. Si le compte est supprime, tous les tests E2E echouent.
- **API down** : si l'API staging est indisponible, les tests echouent. C'est attendu et acceptable.

---

## 5. Hors scope

- Tests E2E iOS (necessite simulateur Apple, a ajouter plus tard)
- Google OAuth E2E
- Pronote QR E2E
- Tests de performance (Flashlight / autre outil)
- Mocking API (on teste contre le vrai staging)
