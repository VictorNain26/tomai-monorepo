# Hébergement — préproduction et production (2026-10-07)

Pour l'étape 7 de la refonte (`refonte-architecture.md`), avec les critères de l'e-mail
transactionnel (`email-transactionnel.md`) : une société européenne, des données dans l'UE, aucun
sous-traitant américain qui touche les données hébergées (CLOUD Act). À héberger :
- l'image Docker (environ 260 Mo, Bun et Hono), qui sert aussi le web ;
- des tours en flux SSE de 30 à 60 s, avec un keep-alive toutes les 10 s ;
- Postgres 18 avec ses sauvegardes et son PITR ;
- un domaine avec TLS, une sonde `/health/ready`, un arrêt propre au SIGTERM ;
- un déploiement depuis GitHub Actions.

Sources lues le jour même. Prix HT ; « indirect » marque un fait déduit ou lu chez un tiers.

## Écartés

| Service | Raison |
|---|---|
| Fly, Render, Railway, AWS, GCP, Azure, Vercel | Sociétés américaines : CLOUD Act |
| Scaleway | Postgres managé en 17 au plus ([versions](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/reference-content/pg-version-updates/)), PITR non trouvé, délai de grâce non documenté ; son HDS ne couvre ni les conteneurs serverless ni les bases ([HDS](https://www.scaleway.com/en/security-and-resilience/hds/)). Reste le fournisseur de l'e-mail |
| Koyeb | Rejoint Mistral AI (2026-02-17, [blog](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure)) ; AWS, GCP et Slack parmi ses sous-traitants ([DPA](https://www.koyeb.com/docs/legal/data-processing-agreement)) ; Postgres chez Neon (Databricks) |
| Alwaysdata | Docker en Private Cloud seulement, 369 €/mois ([doc](https://help.alwaysdata.com/en/docs/development/docker/)) ; sous-traitants non publiés |
| Hetzner, VPS nu ou Coolify | Société allemande, sans sous-traitant hors UE pour un site UE ([annexe 3](https://www.hetzner.com/AV/subunternehmer.pdf)). Mais rien de managé : archivage WAL, restaurations, bascule et patchs reviennent à un développeur seul. Coolify ne sauvegarde qu'en `pg_dump` ([doc](https://coolify.io/docs/databases/backups)) et a publié 16 alertes critiques en 2026 ([advisories](https://github.com/coollabsio/coolify/security/advisories)) ; pas de HDS |

## Finalistes

| | Clever Cloud | OVHcloud (Managed Kubernetes, Public Cloud Databases) |
|---|---|---|
| Société | SAS française, sans filiale aux États-Unis ([sovereign](https://www.clever.cloud/sovereign-cloud/)) ; Paris | OVH SAS, Roubaix ; OVH US est une filiale séparée ([blog](https://blog.ovhcloud.com/cloud-data-act/)) |
| Sous-traitants américains | Twilio (support téléphonique) et Pipedrive (CRM), pour le compte client, pas pour les données hébergées ([liste v1.5](https://cdn.clever-cloud.com/uploads/2026/02/clever-clouds-sub-processors.pdf)) | Aucun ([liste du 2025-10-16](https://contract.eu.ovhapis.com/1.0/pdf/OVH_Sub_processors-fr.pdf)) |
| Postgres | 18.4 sur les offres dédiées ; sauvegarde quotidienne gardée 7 jours ; PITR par pgBackRest, sur demande au support ([doc](https://www.clever.cloud/developers/doc/deploy/databases/postgresql/)) ; la CA des connexions TLS n'est pas documentée | 15 à 18 ([capabilities](https://docs.ovhcloud.com/en/guides/public-cloud/databases/postgresql-capabilities)) ; PITR continu dans la rétention du plan, de 2 à 30 jours ([backups](https://docs.ovhcloud.com/en/guides/public-cloud/databases/backups)) |
| Flux longs | Sōzu : « 180-second timeout for all backend operations » ([doc](https://www.clever.cloud/developers/doc/find-help/troubleshooting/)) | Load Balancer : 50 s par défaut, réglable |
| Arrêt et sonde | Délai de grâce non documenté ; déploiement blue-green ; la sonde (`CC_HEALTH_CHECK_PATH`) ne sert qu'au déploiement | `terminationGracePeriodSeconds` et `readinessProbe` de Kubernetes, réglés par nous |
| X-Forwarded-For | Le client en premier ; un saut à faire confiance (indirect, d'après le code de Sōzu) | Proxy Protocol ou Ingress nécessaires |
| Préproduction / environ 1 000 élèves | Environ 21 € (instance XS et `xxs_sml`) / environ 105 € (2 × S et `s_sml`), PITR en plus ([grille](https://api.clever-cloud.com/v4/billing/price-system?zone_id=par)) | Environ 76 € / environ 199 € |
| Certifications | ISO 27001 ; HDS sur ses 6 activités, jusqu'au 2027-12-19, en zone HDS et contrat dédié ; SecNumCloud en cours | ISO 27001 ; HDS sur Kubernetes, le registre et les bases |

## HDS : non tranché

L'article L.1111-8 du Code de la santé publique vise l'hébergement de « données de santé à
caractère personnel recueillies à l'occasion d'activités de prévention, de diagnostic, de soins ou
de suivi social et médico-social » ([Légifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902)).
L'ANS vise les traitements « ayant pour finalité la prévention, la prise en charge sanitaire (soins
et diagnostic) ou la prise en charge sociale et médico-sociale » ([FAQ](https://esante.gouv.fr/faq/securite-des-donnees-qui-est-concerne-par-lhebergement-de-donnees-de-sante)).
La CNIL demande une analyse au cas par cas ([donnée de santé](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)).

La finalité de Tom est l'aide aux devoirs. Mais un événement de détresse est une donnée de santé
(art. 9 du RGPD), et sa détection, relue par un humain avant d'alerter un parent, peut se lire
comme de la « prévention ». Aucune source ne tranche ce cas.

**Le coût de la zone HDS chez Clever Cloud** : « a fixed monthly subscription of €200, plus a 1.4
multiplier on the standard rate applied to the resources consumed », et un contrat dédié
([health-hds](https://www.clever.cloud/health-hds/)). Environ 230 € par mois en préproduction au
lieu de 21 €, et 350 € en production au lieu de 105 €. La préproduction ne la prend pas : elle ne
reçoit aucun vrai élève, donc aucune donnée de santé réelle. La production la prend si la CNIL le
demande, sans migration, et l'étude de rentabilité intègre alors ce coût fixe. Autre voie à peser
avec la réponse de la CNIL : moins de données de santé, par exemple le texte d'un message de
détresse effacé après sa relecture humaine.

## Recommandation et décisions de Victor (2026-10-07)

1. **Clever Cloud** pour la préproduction, en région Paris : une instance XS et un Postgres 18
   dédié. Pour la production, Clever Cloud si les tests de préproduction passent, sinon OVHcloud.
2. **Twilio et Pipedrive acceptés** : ils servent au support et au CRM, donc aux données du compte
   de Victor, jamais aux données des élèves. C'est la différence avec Brevo, écarté parce que ses
   sous-traitants touchent les e-mails envoyés. À inscrire dans l'AIPD.
3. **HDS** : Victor pose la question par écrit à la CNIL ; la réponse entre dans l'AIPD. D'ici là,
   aucun vrai élève, ce que la porte avant ouverture impose déjà. Clever Cloud passe en zone HDS
   sans migration si la réponse l'exige.

## À tester en préproduction

- Un tour SSE de 60 s à travers Sōzu.
- Le délai de grâce réel au SIGTERM pendant un redéploiement : `SHUTDOWN_DEADLINE_MS` vaut 25 s
  (`apps/server/src/main.ts`), alors qu'un tour de chat dure jusqu'à 60 s.
- `verify-full` contre la CA du Postgres de Clever Cloud.
- Le PITR auprès du support : son activation et son prix.
- Le nombre de sauts à faire confiance dans X-Forwarded-For, pour la clé du rate limit et
  `trustedProxies` de better-auth.

## Déploiement

La CI pousse déjà l'image sur GHCR, par son SHA, depuis `main`. Elle ne contient ni donnée d'élève
ni secret ; GHCR ne touche donc pas la promesse « données en Europe ». Clever Cloud construit à
partir d'un Dockerfile poussé par git ([doc](https://www.clever.cloud/developers/doc/deploy/applications/docker/)) :
un Dockerfile d'une ligne `FROM ghcr.io/…@sha256:…`, déployé par `clever deploy` depuis GitHub
Actions ([CLI](https://www.clever.cloud/developers/doc/manage/cli/)), fait tourner l'image que la CI
a construite et vérifiée. Aucune procédure de ce type n'est documentée : à vérifier.

## Question à la CNIL (texte proposé)

> Nous développons un service d'aide aux devoirs par une IA pour des collégiens, vendu aux familles.
> Quand un élève écrit un message qui laisse penser qu'il est en détresse, le service lui répond par
> un message fixe avec les numéros d'aide, et enregistre l'événement (sa date et ce qui l'a
> détecté, sans score), pour qu'un humain le relise avant d'en informer éventuellement un parent ;
> le message de l'élève reste dans l'historique de sa séance. La
> finalité du service est l'aide aux devoirs, pas une activité de soin. L'hébergement de ces
> événements relève-t-il de l'article L.1111-8 du Code de la santé publique, et donc d'un hébergeur
> certifié HDS ?
