---
name: mobile-device
description: Faire tourner l'app Expo sur un téléphone réel et la brancher au backend local — quand rebuilder le dev client, pourquoi Expo Go ne suffit pas, réseau WSL2, Metro qui refuse de démarrer. À utiliser dès qu'un device ne joint pas le backend, qu'un module natif manque, ou qu'un changement n'apparaît pas dans l'app.
---

# Device physique et dev client

## Expo Go ne suffit pas

L'app utilise Google Sign-In, RevenueCat, `expo-camera`, `expo-sqlite` et
`expo-crypto` : autant de code natif absent d'Expo Go. Il faut un **dev client**
buildé.

## Quand rebuilder

| Changement | Action |
|---|---|
| Code JS/TS uniquement | Rien — hot reload |
| Nouvelle dépendance native (`expo-crypto`, `op-sqlite`, Sentry…) | `pnpm build:dev` |
| `app.config.ts` | `pnpm build:dev` |

`pnpm build:dev` compare l'empreinte native et **saute le build** si elle n'a pas
bougé. Un changement natif qui « n'apparaît pas » dans l'app est presque toujours
un dev client pas rebuildé.

## Brancher le device au backend local

`pnpm dev` (backend, depuis la racine) puis `pnpm dev:mobile` (Metro). **Rien à
configurer** : l'app dérive l'URL du backend de l'IP par laquelle le device a
joint Metro (`Constants.expoConfig.hostUri`) — device physique → IP LAN, émulateur
Android → `10.0.2.2`, simulateur iOS → `localhost`. L'URL résolue est loggée au
boot sous le préfixe `[API]` : la lire avant de supposer quoi que ce soit.

Si le device ne joint pas le backend : même Wi-Fi, puis pare-feu du poste.

### Sous WSL2

Le backend tourne dans la VM Linux, donc invisible du téléphone par défaut.
Activer le réseau miroir dans `%UserProfile%\.wslconfig` :

```ini
[wsl2]
networkingMode=mirrored
```

puis `wsl --shutdown`, et ouvrir le port côté pare-feu Hyper-V. C'est un réglage
de poste, il ne vit pas dans le dépôt.

## Metro

| Symptôme | Solution |
|---|---|
| Metro ne démarre pas | `npx expo start --dev-client --clear` |
| Port 8081 occupé | `npx kill-port 8081` |
| `className` NativeWind ignoré sur `SafeAreaView` | Utiliser `@/components/ui/safe-area-view` — le polyfill global ne wrappe que `SafeAreaProvider` |
| Erreur `unstable_enablePackageExports` | **Ne pas** l'override : depuis le SDK 53, Metro gère les `conditionNames` correctement. L'override est la cause, pas le remède |

## Vérifier sans device

```bash
pnpm --filter tom-mobile bundle:check
```

C'est l'export de bundle Metro utilisé en CI : il attrape les erreurs de bundling
et d'import, rien de visuel ni d'interactif. Pour un écran, une gesture ou un
module natif, il n'y a pas de substitut au device — passer par `pnpm e2e:local`
(flows Maestro sur émulateur Android).
