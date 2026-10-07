# E-mail transactionnel — choix du fournisseur (2026-10-07)

Pour la vérification de l'e-mail des gardiens et la réinitialisation (étape 4), puis les alertes
au parent (lot 3). Volume : quelques centaines puis quelques milliers d'e-mails par mois (environ
6 par élève, `etudes/2026-10-01/couts.md`, H19). Victor a délégué le choix le 2026-10-07. Sources
lues le jour même ; « indirect » marque un fait lu dans un résumé, la page étant bloquée.

## Écartés

| Service | Raison |
|---|---|
| Resend | Société américaine ; tout est stocké aux États-Unis, quelle que soit la région d'envoi ([regions](https://resend.com/docs/dashboard/domains/regions)) |
| Postmark | ActiveCampaign (États-Unis), données aux États-Unis, aucun plan pour l'UE ([eu-privacy](https://postmarkapp.com/eu-privacy)) |
| Mailgun (région UE) | Mailgun Technologies Inc., société américaine : CLOUD Act |
| Amazon SES (Paris) | Amazon, société américaine : CLOUD Act |
| Mailjet | Sinch (Suède), mais Mailgun Technologies Inc. est sous-traitant ([liste Sinch](https://sinch.com/legal/data-protection-agreement-sub-processors/)) |
| Brevo | Société française, mais Google Cloud, Datadog et Sendinblue Inc. (États-Unis) parmi ses sous-traitants (indirect) |
| Sweego (Lille) | Sous-traitants non vérifiables (site injoignable le jour de l'étude) |

## Finalistes

| | Scaleway TEM | Lettermint |
|---|---|---|
| Société | Scaleway, France (groupe iliad) | Lettermint B.V., Pays-Bas, fondée en 2025 |
| Données | UE seule, aucun sous-traitant hors UE pour TEM ([FAQ](https://www.scaleway.com/en/docs/transactional-email/faq/)) | UpCloud aux Pays-Bas, sauvegardes OVH en Allemagne ; Slack et Stripe aux États-Unis ([sous-traitants](https://lettermint.co/subprocessors)) |
| Prix (300 / 3 000 / 30 000 par mois) | 0 € / 0,68 € / 7,43 € ([tarifs](https://www.scaleway.com/en/pricing/managed-services/)) | 0 € / 10 € / 40 € ([tarifs](https://lettermint.co/pricing.md)) |
| API | HTTP, en-tête `X-Auth-Token`, encore en `v1alpha1`, sans clé d'idempotence ([schéma](https://www.scaleway.com/en/developers/api/transactional-email/v1alpha1/schema.yml)) | HTTP, idempotence ([changelog](https://lettermint.co/changelog/prevent-duplicate-emails-with-idempotency)) |
| Rebonds et événements | Liste de blocage automatique ([doc](https://www.scaleway.com/en/docs/transactional-email/how-to/manage-blocklists/)) ; webhooks par Topics and Events, facturé à part ([doc](https://www.scaleway.com/en/docs/transactional-email/how-to/create-webhooks/)) | Webhooks directs, suppressions exportables |
| Limites | Pas de SLA sur l'offre Essential ; quota initial de 10 000 par mois, relevé sur demande ; SPF sans `include` imbriqué ([limites](https://www.scaleway.com/en/docs/transactional-email/reference-content/tem-capabilities-and-limits/)) | Retards d'envoi reconnus pendant sa montée en charge ([blog](https://lettermint.co/blog/lettermint-turns-1-and-we-are-just-getting-started)) |

## Décision : Scaleway TEM

- La seule affirmation nette, dans la doc officielle, qu'aucune donnée ne sort de l'UE ni ne passe
  par un sous-traitant hors UE ; Tom n'affirme que ce qu'il peut prouver.
- La pérennité compte pour une alerte au parent : un hébergeur adossé à iliad plutôt qu'une société
  de deux ans.
- Ce qui manque se tient dans notre code : une table d'envois à clé unique tient l'idempotence et
  trace chaque alerte, dont l'alerte de détresse aura besoin de toute façon.
- Un compte Scaleway est nécessaire même si Tom est hébergé ailleurs ; l'envoi reste un appel
  HTTP depuis n'importe quel hébergeur.
- Repli : Lettermint, si l'API alpha ou les webhooks par Topics and Events bloquent.

Non vérifié : la durée de conservation du contenu des e-mails chez Scaleway TEM (absente de sa
doc), et un test de délivrabilité indépendant de Scaleway ou de Lettermint. L'e-mail seul ne suffit
pas comme canal garanti d'une alerte de détresse, quel que soit le fournisseur (`suivi.md`, lot 3).
