---
description: Défauts marketing — chargés sur la landing, le SEO, le copywriting et l'acquisition
paths:
  - "apps/landing/**"
---

# Marketing lead — défauts landing / SEO / acquisition

Cadre edtech FR (familles, élèves mineurs, RGPD strict). Doc-first : chaque règle cite sa source ; vérifier la source avant d'appliquer un seuil daté.

## Règle qui prime : on n'affirme que ce qu'on peut prouver

Source : `docs/vision.md`, qui fixe aussi la promesse, la cible et le prix.

- **Chaque chiffre public a une source primaire datée** ; chaque différence revendiquée face à un concurrent est **mesurée** (harnais du lot 1, protocole publié) ; ce qui n'est pas construit ne se promet pas.
- **Pas de promesse de progrès scolaire ni de meilleures notes** : rien ne la mesure aujourd'hui. Pas de « le seul ».
- **Preuve sociale réelle uniquement** : témoignages de vraies familles, avec leur accord, et chiffres sourcés ou mesures publiées. Jamais de témoignage, d'avis, de logo ni de compteur d'utilisateurs inventé ou anticipé.
- Une phrase de la landing qu'on ne peut adosser à une source ou à une mesure se retire : c'est le seul type de changement admis tant que la landing est gelée (lot 4).
- **Jamais** : « conforme au cadre d'usage de l'IA du ministère », « agréé » ou « recommandé par l'Éducation nationale », « aligné sur les programmes » sans la métrique publiée, « fait les devoirs » (`docs/etudes/2026-10-01/education-nationale.md`, c).

## SEO technique & contenu

- **Core Web Vitals au 75ᵉ percentile du terrain (CrUX), mobile + desktop** : `LCP < 2,5 s`, `INP < 200 ms`, `CLS < 0,1` — les trois simultanément. INP a remplacé FID (mars 2024) : c'est la pire interaction de la session, pas la première — optimiser tout le parcours. ([Google — Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals))
- **`<title>` + meta description uniques par page**, écrits pour l'utilisateur (Google peut les réécrire). HTML sémantique = pour l'a11y/lecteurs d'écran, pas un facteur de ranking. ([Google — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide))
- **Données structurées JSON-LD** : `Organization`, `FAQPage`, `Course`/`LearningResource` — cible SEO + visibilité dans les réponses IA. ([schema.org/Course](https://schema.org/Course))
- **Sitemap XML** soumis à Search Console + `rel="canonical"` sur les variantes (UTM…) pour éviter la dilution. ([Google — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide))
- **Images WebP/AVIF**, `loading="lazy"` partout SAUF l'image LCP (elle, préchargée `<link rel="preload">`), `alt` descriptif. ([web.dev — LCP](https://web.dev/articles/lcp))

## Conversion (CRO) landing

- **Proposition de valeur above-the-fold, comprise en < 5 s** : H1 court (≈ < 8 mots) + sous-titre bénéfice. ([CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/))
- **Un seul CTA primaire par page**, même destination répétée — plusieurs CTA divergents = paralysie décisionnelle. ([Unbounce — CRO](https://unbounce.com/conversion-rate-optimization/cro-best-practices/))
- **Preuve juste avant le CTA** — là où le doute est maximal — et seulement une preuve réelle (règle ci-dessus). ([CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/))
- **Inscription minimale** : ne demander que ce qui sert à ouvrir le compte ; collecter le reste après. Sur une landing de campagne dédiée, **retirer la nav** pour supprimer les fuites. ([Unbounce — CRO](https://unbounce.com/conversion-rate-optimization/cro-best-practices/))
- **Prix et abonnement sans piège** : prix TTC affiché, mensuel, sans engagement, résiliable en un clic, prélèvement annoncé à l'avance (vision, « Offre et prix ») ; c'est le premier reproche des parents dans les avis.

## Copywriting

- **Clarté > cleverness** : un non-expert saisit l'offre en 5 s. **Bénéfice avant fonctionnalité**, à partir du besoin que les parents expriment : soirées mangées par les devoirs, disputes, sentiment d'être dépassé (vision, « Pour qui »). ([CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/))
- **Zéro jargon IA** dans le copy public (pas de « LLM/RAG/embeddings ») — on décrit ce qui se passe le soir (l'élève est aidé à trouver, l'IA ne fait pas l'exercice), pas un résultat scolaire ; le lexique tech reste pour la presse et la page des mesures.
- **Voix cohérente pour les deux audiences** : le parent cherche sécurité et soirées apaisées, l'élève de l'aide sans être jugé.
- **Pas de promotion déguisée** sur les forums de parents : la communauté la rejette (vision, « Distribution »).

## Analytics privacy-first

- **Mesure sans pistage abusif** : Matomo auto-hébergé en mode cookieless (exemption CNIL) ou Plausible EU (cookieless, < 1 ko, n'alourdit pas le LCP) pour du web analytics pur — mesurer 100 % des visites sans bandeau. Quand le produit a besoin de plus (product analytics, feature flags, session replay) : PostHog Cloud EU (hébergement Francfort). C'est la cible tranchée sur Tom. ([Matomo](https://matomo.org/blog/2025/06/privacy-friendly-analytics/), [Plausible](https://plausible.io), [PostHog EU](https://posthog.com/docs/privacy/gdpr-compliance))
- **Définir 3–5 événements de conversion** (`inscription_démarrée`/`terminée`, `premier_échange`, `passage_complet`) avant tout A/B test — mesurer la transformation, pas les pages vues.
- **A/B test : une hypothèse à la fois**, conclure seulement à significativité (p < 0,05, puissance > 80 %). ([CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/))

## RGPD / consentement (EU, mineurs)

- **Pas de dark pattern sur le bandeau cookies** : « Refuser » aussi visible que « Accepter » (même taille/poids). Aucun cookie non essentiel avant consentement ; au retrait, les cookies s'arrêtent réellement. ([CNIL — dark patterns, déc. 2024](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers))
- **Majorité numérique FR = 15 ans** : sous 15 ans, traitement fondé sur le consentement = **double consentement conjoint enfant + parent**. ([CNIL — recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans))
- **Privacy by default** pour le compte élève (profil privé, pas de partage tiers) et **aucune publicité comportementale ciblant un mineur**, même avec accord parental. ([CNIL — droits numériques des mineurs](https://www.cnil.fr/fr/enjeux-numeriques/les-droits-numeriques-des-mineurs))
- **Information adaptée à l'âge** (pas le même pavé juridique pour un parent et un élève de 12 ans). ([CNIL — recommandation 6](https://www.cnil.fr/fr/recommandation-6-renforcer-linformation-et-les-droits-des-mineurs-par-le-design))
