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
| Koyeb | Rejoint Mistral AI (2026-02-17, [blog](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure)) ; ses régions tournent chez Equinix Metal, IBM Cloud, Scaleway et AWS, son plan de contrôle sur Google Cloud, avec Intercom et Slack ([DPA](https://www.koyeb.com/docs/legal/data-processing-agreement)) ; Postgres 14 à 17, à Francfort, Washington ou Singapour, sauvegardes non documentées ([doc](https://www.koyeb.com/docs/databases)) |
| Upsun (Platform.sh) | Cloudflare et Sentry parmi ses sous-traitants ([liste](https://upsun.com/trust-center/privacy/subprocessor-list/)) ; régions UE sur OVH, Azure, AWS et Google ([regions](https://developer.upsun.com/docs/development/regions)) |
| Infomaniak | Postgres managé « Available soon » ([page](https://www.infomaniak.com/en/hosting/public-cloud/database)) ; « no plans to become a certified Health Data Host » ([FAQ](https://www.infomaniak.com/en/support/faq/71/infomaniak-situation-and-certifications)) |
| IONOS | Pas de PaaS, Kubernetes seulement, environ 100 € par mois en préproduction ; une filiale américaine ([prix](https://docs.ionos.com/cloud/support/general-information/price-list/ionos-cloud-eur-en.md)) |
| Outscale | Aucun Postgres managé ([prix](https://en.outscale.com/pricing/)) |
| Exoscale | Kubernetes seulement ; son Postgres est opéré par Aiven, dont les sous-traitants « back-end » sont Google Cloud, Sentry et Slack ([Aiven](https://aiven.io/subprocessors)) |
| Northflank | Tourne sur Google Cloud ; « ISO 27001/27018: No » ([security](https://northflank.com/security)) |
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
| X-Forwarded-For | Sōzu ajoute l'adresse qu'il voit à la fin de la chaîne (indirect, d'après son code) : la clé du rate limit est l'entrée qu'il a ajoutée, la dernière, jamais la première, qu'un client peut écrire lui-même | Proxy Protocol ou Ingress nécessaires |
| Préproduction / environ 1 000 élèves | Environ 21 € (instance XS et `xxs_sml`) / environ 105 € (2 × S et `s_sml`), PITR en plus ([grille](https://api.clever-cloud.com/v4/billing/price-system?zone_id=par)) | Environ 76 € / environ 199 € |
| Certifications | ISO 27001 ; HDS sur ses 6 activités, jusqu'au 2027-12-19, en zone HDS et contrat dédié ; SecNumCloud en cours | ISO 27001 ; HDS sur Kubernetes, le registre et les bases |

### Scalingo, le recours si HDS est requis

Société française, sur Outscale, son seul sous-traitant pour les données hébergées
([DPA du 2026-10-06](https://scalingo.com/data-processing-agreement)) :
- Postgres 14 à 18, et un PITR automatique dès le plan Starter, sur 7 jours
  ([sauvegardes](https://doc.scalingo.com/databases/about/backup-policies)) ;
- SIGTERM puis 30 s avant SIGKILL ([conteneurs](https://doc.scalingo.com/platform/internals/container-management)) ;
- un flux doit envoyer quelque chose au moins toutes les 59 s, ce que fait le keep-alive
  ([routing](https://doc.scalingo.com/platform/internals/routing)) ;
- HDS compris, sans surcoût, en plan Business et sur au moins 2 conteneurs
  ([prix](https://scalingo.com/pricing)) : environ 98 € par mois pour 1 000 élèves, contre environ
  350 € dans la zone HDS de Clever Cloud.

Il perd aujourd'hui sur un point bloquant. Il déploie par buildpacks, sans Docker documenté, et son
buildpack Node.js officiel ne gère pas Bun ([README](https://github.com/Scalingo/nodejs-buildpack)).
Le seul buildpack Bun a 0 étoile. L'image construite et vérifiée par la CI n'y tourne donc pas
telle quelle.

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
demande, avant tout vrai élève : c'est une zone à part, sous un contrat dédié, où l'application et
la base se recréent (sans données réelles à migrer à ce moment-là), et l'étude de rentabilité intègre
alors ce coût fixe. Autre voie à peser
avec la réponse de la CNIL : moins de données de santé, par exemple le texte d'un message de
détresse effacé après sa relecture humaine.

## Recommandation et décisions de Victor (2026-10-07)

1. **Clever Cloud** pour la préproduction, en région Paris : une instance XS et un Postgres 18
   dédié. Pour la production, Clever Cloud si les tests de préproduction passent, sinon OVHcloud.
2. **Twilio et Pipedrive acceptés** : ils servent au support et au CRM, donc aux données du compte
   de Victor, jamais aux données des élèves. C'est la différence avec Brevo, écarté parce que ses
   sous-traitants touchent les e-mails envoyés. À inscrire dans l'AIPD.
3. **HDS** : Victor pose la question par écrit à la CNIL ; la réponse entre dans l'AIPD. D'ici là,
   aucun vrai élève, ce que la porte avant ouverture impose déjà. Si la réponse l'exige, la production
   naît avant le premier vrai élève dans la zone HDS de Clever Cloud, ou chez Scalingo, environ trois
   fois moins cher, s'il construit le serveur Bun d'une façon qu'on aura testée.

## Architecture unifiée (décisions de Victor, 2026-10-07)

Victor a demandé de « tout unifier si possible », refonte comprise, sans rien tenir pour acquis.

| Brique | Choix | Raison |
|---|---|---|
| Hébergeur | Clever Cloud, région Paris, pour tout | Ci-dessus |
| Domaines | Deux noms d'hôte : `<nom>.fr` pour la landing, `app.<nom>.fr` pour le serveur et le web | L'origine se joue à l'hôte ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)) : aucun script de la vitrine ne tourne dans l'origine de la session du parent ; le cookie de better-auth reste à l'hôte, le service worker à sa portée `/`, sans rien changer au web |
| Landing | Astro, site statique, dans une application statique Clever Cloud à part (instance pico, environ 4,50 € par mois, [doc](https://www.clever.cloud/developers/doc/applications/static/)) | Next.js en export statique marche, mais garde des scripts en ligne qu'une CSP stricte refuse sans un mécanisme encore expérimental ([doc](https://nextjs.org/docs/app/guides/content-security-policy)) ; Astro sort du HTML sans JavaScript, pose ses empreintes de scripts (`security.csp`, stable) et garde `@repo/ui` en îlots React. La fusionner dans `apps/web` demanderait TanStack Start et mettrait la vitrine sous le service worker de l'app. Elle reste en ligne quand l'app redémarre |
| Vercel | Supprimé | Son offre gratuite est réservée à un usage « non-commercial » ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)), et la landing présente des prix ; société américaine |
| Erreurs | Bugsink, auto-hébergé chez Clever Cloud, à la place de Sentry | Sentry passe par AWS, Cloudflare et Google, même en région UE ([sous-traitants](https://sentry.io/legal/subprocessors/)) ; Bugsink est néerlandais, un seul conteneur, compatible avec les SDK Sentry ([installation](https://www.bugsink.com/docs/installation/)), version 2.6.1 du 2026-09-25 |
| E-mail | Scaleway TEM, inchangé | Clever Cloud n'en a pas ; son extension MailPace envoie depuis le Royaume-Uni, sans liste de sous-traitants publiée ([DPA](https://mailpace.com/dpa)) |
| Photos (lot 3) | Cellar, le S3 de Clever Cloud ([doc](https://www.clever.cloud/developers/doc/deploy/storage/cellar/)), l'envoi passant par le serveur | Pas de CORS ni de `connect-src` de plus |
| Traces OpenTelemetry | Reportées | Clever Cloud a métriques, logs et alertes, mais ni APM ni traces ; les logs pino suffisent à l'étape 7 |
| Langfuse | Inchangé, traces synthétiques seulement | Hébergé sur AWS en Irlande ([régions](https://langfuse.com/security/data-regions)) : jamais une donnée d'élève |
| Previews de PR | Une application statique de la landing par PR, créée puis supprimée par `clever-tools` | L'action officielle de review apps n'est plus maintenue ([dépôt](https://github.com/CleverCloud/clever-cloud-review-app)) ; le serveur et le web restent couverts par l'e2e et la préproduction |

Bun, Hono, Vite, TanStack Router et Turborepo restent : l'unification ne leur reproche rien. Les
deux applications front aussi, avec deux modèles de rendu : du statique pour la vitrine, une SPA
pour le produit.

## À tester en préproduction

La liste vit dans `suivi.md`, « Refonte — préproduction (étape 7) », avec ce que l'étape 7 avait déjà
à régler (sonde, rate limit, compression).

## Déploiement

La CI pousse déjà l'image sur GHCR, par son SHA, depuis `main`. Elle ne contient ni donnée d'élève
ni secret ; GHCR ne touche donc pas la promesse « données en Europe ». Clever Cloud construit à
partir d'un Dockerfile poussé par git ([doc](https://www.clever.cloud/developers/doc/deploy/applications/docker/)) :
un Dockerfile d'une ligne `FROM ghcr.io/…@sha256:…`, déployé par `clever deploy` depuis GitHub
Actions ([CLI](https://www.clever.cloud/developers/doc/manage/cli/)), fait tourner l'image que la CI
a construite et vérifiée. Aucune procédure de ce type n'est documentée : à vérifier, avec deux
préalables. Un paquet GHCR est privé par défaut : Clever Cloud doit s'y connecter
(`CC_DOCKER_LOGIN_*`) ou le paquet devenir public. Et la CI doit publier le digest de l'image, qu'elle
ne relève pas aujourd'hui.

## Question à la CNIL (texte proposé)

> Nous développons un service d'aide aux devoirs par une IA pour des collégiens, vendu aux familles.
> Quand un élève écrit un message qui laisse penser qu'il est en détresse, le service lui répond par
> un message fixe avec les numéros d'aide, et enregistre l'événement (sa date et ce qui l'a
> détecté, sans score), pour qu'un humain le relise avant d'en informer éventuellement un parent ;
> la séance est close, le message de l'élève reste dans son historique, et l'enregistrement du tour
> garde les catégories que la modération a signalées (par exemple « automutilation »). La
> finalité du service est l'aide aux devoirs, pas une activité de soin. L'hébergement de ces
> événements relève-t-il de l'article L.1111-8 du Code de la santé publique, et donc d'un hébergeur
> certifié HDS ?
