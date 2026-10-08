# Plan — Le profil de l'enfant reste sur l'appareil

## Problème

Victor, en testant le staging le 2026-10-08 : un enfant déconnecté ne revient qu'avec un nouveau
code du parent. Trois familles le vivent :

1. Léa a sa tablette, reliée en septembre ; après une semaine de vacances sans l'ouvrir, sa session
   a expiré (7 jours, défaut de better-auth) et elle redemande un code.
2. Un seul téléphone pour la famille : chaque passage du parent à Léa coûte un code, chaque retour
   une déconnexion.
3. Léa touche « Me déconnecter » par erreur : elle attend le parent.

Le constat de marché de `etudes/2026-10-07/foyer-eleve-age.md` : au collège, code à usage unique et
bascule de profil sur l'appareil du parent.

## Critères d'acceptation

- [ ] Une session dure 90 jours sans usage, renouvelée à l'usage (`session.expiresIn`) : un été
      sans ouvrir la tablette ne la délie pas. Le parent délie un appareil depuis son foyer.
- [ ] Plugin `multiSession` de better-auth : un appareil garde la session de l'enfant quand le
      parent y entre par sa clé d'accès ou un code ; le garde du foyer laisse à une session
      d'élève les routes d'entrée du parent.
- [ ] Quand la session d'un enfant devient active sur un appareil (jumelage, bascule), toute
      session de parent qu'il tient est supprimée : revenir au parent demande sa clé ou un code.
- [ ] Sur `/foyer/$studentId`, « Ouvrir l'espace de Léa sur cet appareil » : la bascule si sa
      session y est, sinon un jumelage fait par l'app, sans code à recopier.
- [ ] L'enfant n'a plus de déconnexion : « Changer de profil » mène à l'entrée du parent, qui dit à
      qui l'appareil est relié.
- [ ] En TDD : chaque critère a son test rouge avant le code (serveur sur vraie base, e2e).

## Hors périmètre

- La bascule d'un enfant à son frère ou sa sœur sans le parent.
- Le style des écrans (lot 3, retours de Victor du 2026-10-08).

## Vérification de bout en bout

`bun run test`, la suite `tooling/playwright-web`, puis sur le staging dans Chrome : le parent
ouvre l'espace de Léa sur son téléphone, Léa change de profil, le parent rentre par sa clé, rouvre
l'espace de Léa sans code.

## Décision humaine

Validé par Victor le 2026-10-08 (« go ») ; 90 jours glissants plutôt que « jusqu'au 31 août » :
le cookie de better-auth suit la durée globale, deux durées demanderaient un contournement.
