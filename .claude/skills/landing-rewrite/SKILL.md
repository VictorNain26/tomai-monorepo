---
name: landing-rewrite
description: Défauts SEO, conversion, copywriting et mesure d'audience pour réécrire la landing au lot 4. À utiliser quand on conçoit ou réécrit une page publique de la landing, pas pour un correctif pendant le gel.
---

# Réécrire la landing (lot 4)

Les interdits de la landing (affirmations, preuve sociale, RGPD) restent dans
`.claude/rules/marketing.md` et priment. Vérifier la source avant d'appliquer un seuil daté.

## SEO technique & contenu

- **Core Web Vitals au 75ᵉ percentile du terrain (CrUX), mobile + desktop** : `LCP < 2,5 s`, `INP < 200 ms`, `CLS < 0,1` — les trois simultanément. INP a remplacé FID (mars 2024) : c'est la pire interaction de la session, pas la première — optimiser tout le parcours. ([Google — Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals))
- **`<title>` + meta description uniques par page**, écrits pour l'utilisateur (Google peut les réécrire). HTML sémantique = pour l'a11y/lecteurs d'écran, pas un facteur de ranking. ([Google — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide))
- **Données structurées JSON-LD** : `Organization`, `FAQPage`, `Course`/`LearningResource` — cible SEO + visibilité dans les réponses IA. ([schema.org/Course](https://schema.org/Course))
- **Sitemap XML** soumis à Search Console + `rel="canonical"` sur les variantes (UTM…) pour éviter la dilution. ([Google — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide))
- **Images WebP/AVIF**, `loading="lazy"` partout SAUF l'image LCP (elle, préchargée `<link rel="preload">`), `alt` descriptif. ([web.dev — LCP](https://web.dev/articles/lcp))

## Conversion, copywriting, mesure

- **Conversion** : proposition de valeur comprise en moins de 5 s, un seul CTA primaire, preuve réelle juste avant lui, inscription minimale ([CXL](https://cxl.com/blog/how-to-build-a-high-converting-landing-page/), [Unbounce — CRO](https://unbounce.com/conversion-rate-optimization/cro-best-practices/)) ; prix TTC, mensuel, sans engagement, résiliable en un clic (vision, « Offre et prix »).
- **Copywriting** : bénéfice avant fonctionnalité, à partir du besoin que les parents expriment (vision, « Pour qui ») ; zéro jargon IA dans le copy public ; on décrit ce qui se passe le soir, pas un résultat scolaire ; pas de promotion déguisée sur les forums de parents (vision, « Distribution »).
- **Mesure d'audience** : aucun outil choisi ni installé. Préférer une mesure sans cookie qui se passe de bandeau (exemption CNIL) : Matomo auto-hébergé en mode cookieless ou Plausible EU ([Matomo](https://matomo.org/blog/2025/06/privacy-friendly-analytics/), [Plausible](https://plausible.io)). Définir 3 à 5 événements de conversion avant tout A/B test, une hypothèse à la fois, conclusion seulement à significativité.

