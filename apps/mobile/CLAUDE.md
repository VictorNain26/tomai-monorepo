# Mobile Tom

App Expo Router pour parents et élèves. Stack et versions : `README.md` racine.
Device physique, rebuild du dev client, WSL2, Metro : skill `/mobile-device`.

## Commandes

```bash
pnpm dev              # Metro + dev client
pnpm build:dev        # rebuild du dev client Android (saute si l'empreinte native n'a pas bougé)
pnpm typecheck        # strict, zéro `any`
pnpm lint             # zéro warning
pnpm test             # jest-expo
pnpm bundle:check     # export de bundle Metro — ce que la CI vérifie
```

EAS Workflows : `pnpm workflow:preview:android|ios`, `pnpm workflow:prod:android|ios`.
OTA via EAS Update, `runtimeVersion: fingerprint` en prod et `1.0.0-dev` en preview
— cette divergence est volontaire, elle évite un décalage d'empreinte entre
Windows et Linux.

## Contraintes

- **UI exclusivement React Native Reusables** (`@/components/ui/`), jamais de
  `StyleSheet` custom quand NativeWind suffit.
- **`@repo/ui` (DOM) n'entre jamais ici** — ses composants rendent du DOM, pas des vues natives.
- **État** : TanStack Query pour le server state, Zustand pour le client state.
  Ne jamais mélanger les deux.
- **TypeScript strict, zéro `any`**, vérifié en CI.
- **400 lignes maximum par fichier.**
- `testID` obligatoire sur tout élément que l'E2E doit atteindre : formulaire de
  connexion, dashboards, saisie et envoi du chat, liste de decks.

## Patterns React 19 / Expo

- **Pas de `forwardRef`** : `ref` est une prop. `use()` remplace `useContext()`,
  `<Ctx value={}>` remplace `<Ctx.Provider>`.
- **React Compiler bloqué** par une incompatibilité Expo Router (issue #35100) :
  mémoriser à la main où c'est utile, laisser faire le runtime ailleurs.
- `experiments.typedRoutes` est actif → utiliser les types générés pour
  `<Link href>` et `router.push`.

## Intégration serveur

Eden Treaty via `@repo/api` donne la type-safety de bout en bout. Le client est
initialisé dans `src/lib/api.ts` : `EXPO_PUBLIC_API_URL`, `cookieProvider`
injectant la session Better Auth, timeouts 30 s / 60 s upload / 120 s chat.

- **Auth** : Better Auth + `@better-auth/expo`, session en `expo-secure-store`
  (Keychain / Keystore), deep links `tomia://` pour le retour OAuth.
- **Chat** : `useChat` de `@ai-sdk/react` avec `DefaultChatTransport`, historique
  porté par le serveur. Traiter explicitement 429 `QUOTA_EXCEEDED` et 409
  `CONCURRENT_STREAM` — ce sont des états produit, pas des erreurs réseau.
- **Upload** : présigné Scaleway (`presign` → PUT S3 direct → `confirm`).
- **Cache** : TanStack Query + persister AsyncStorage, NetInfo pour
  `onlineManager`. Purger le cache au signOut : isolation des données par
  utilisateur, exigence RGPD mineurs.

## Tests

Unitaires jest-expo dans `__tests__/<path>/<name>.test.ts`. E2E Maestro dans
`e2e/*.yaml` — quatre flows : auth élève, auth parent, envoi de message,
flashcard. Ils exigent un compte de test staging et les secrets EAS.

## Observabilité

`Sentry.init` est conditionné strictement à `EXPO_PUBLIC_SENTRY_DSN`
(`src/lib/sentry.ts`) : no-op en dev local, actif seulement sur les builds EAS où
le secret existe. **Ni session replay ni capture d'écran** — RGPD mineurs, c'est
une décision produit, pas un oubli de configuration.
