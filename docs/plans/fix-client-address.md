# Plan — L'adresse du client derrière le proxy de Clever Cloud

## Problème

Mesuré sur le staging le 2026-10-08 :

- **Rate limit de l'API** (`platform/http/rate-limit.ts`) : il compte par adresse de connexion,
  celle du proxy. Tous les visiteurs partagent un seul budget.
- **Proxy de Clever Cloud** : il ajoute l'adresse réelle à droite de `X-Forwarded-For`, après ce
  que le client a écrit. Sans en-tête du client, il n'y a qu'une entrée : better-auth a enregistré
  la vraie adresse de Victor.
- **better-auth avec un faux en-tête** : il voit deux entrées et ne sait pas laquelle croire. Il
  range alors la requête sous une clé commune (`NO_TRUSTED_IP_KEY`). Le test l'a montré :
  2 requêtes sans en-tête, puis 2 avec un faux, et aucune n'est refusée sous une limite de 3.

La [FAQ de Clever Cloud](https://www.clever.cloud/developers/doc/find-help/faq/) dit que la
première adresse est celle du client, mais celle-ci peut être écrite par le client lui-même. Seule
l'entrée ajoutée par le proxy est sûre.

## Critères d'acceptation

- [ ] Une seule source pour l'adresse du client : le nombre de proxys de confiance devant le
      serveur (`TRUSTED_PROXY_HOPS`, 0 par défaut, 1 chez Clever Cloud). Avec ce nombre, on prend
      l'entrée de `X-Forwarded-For` qu'ils ont ajoutée, comptée depuis la droite. Sans proxy, ou si
      l'entrée manque ou n'est pas une adresse, on prend l'adresse de connexion.
- [ ] Le rate limit de l'API compte par cette adresse : deux clients derrière le proxy ont chacun
      leur budget, et un faux en-tête ne change pas le compteur.
- [ ] better-auth reçoit cette adresse dans un en-tête que le serveur réécrit toujours, et ne lit
      que lui (`advanced.ipAddress.ipAddressHeaders`). La session enregistre l'adresse réelle, et
      sa limite compte par elle.
- [ ] En TDD ; puis sur le staging, avec `TRUSTED_PROXY_HOPS=1`, le test de départage refusé à la
      4ᵉ requête.

## Hors périmètre

- Le stockage partagé du rate limit entre plusieurs instances (une seule instance aujourd'hui).

## Vérification de bout en bout

`bun run test`, puis le même test sur le staging : 2 requêtes sans en-tête puis 2 avec un faux
`X-Forwarded-For`, la 4ᵉ refusée.

## Décision humaine

Victor, le 2026-10-08 (« go »).
