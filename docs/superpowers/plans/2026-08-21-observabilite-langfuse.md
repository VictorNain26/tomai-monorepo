# Observabilité Langfuse — plan

**Un seul résultat visé, et il tient en une phrase :**

> Une question d'élève = **une trace**, du message reçu jusqu'à l'attente sur le
> lock BGE-M3, lisible dans Langfuse sans ouvrir un terminal.

Aujourd'hui cette trace n'existe pas. Le serveur sait que « la recherche RAG a
pris 1,2 s » ; l'ai-service sait que sur ces 1,2 s, 800 ms étaient de la file
d'attente et 400 ms du calcul. **Les deux moitiés vivent dans deux systèmes
différents**, sur deux horloges, sans lien. Répondre à « pourquoi c'était
lent ? » demande de grepper des logs de conteneur et de recouper à la main.

## Ce que ce lot fait — et rien d'autre

| # | Étape | Où |
|---|---|---|
| L1 | Remplacer l'exporteur OTLP générique par `LangfuseSpanProcessor` | `apps/server` |
| L2 | Instrumenter `ai-service` en OpenTelemetry et l'exporter vers Langfuse | `apps/ai-service` |
| L3 | Propager le contexte de trace du serveur vers l'ai-service (en-têtes W3C `traceparent`) | les deux |
| L4 | Vérifier : une question d'élève produit **une** trace corrélée de bout en bout | — |

## Ce que ce lot ne fait pas

Écrit noir sur blanc pour éviter d'y greffer autre chose en cours de route :

- **Pas d'evals** (LLM-as-judge, datasets, experiments). C'est le lot suivant,
  il répond à P0-2 et P1-7. Le confondre avec celui-ci, c'est mélanger « voir
  ce qui se passe » et « juger si c'est bon ».
- **Pas de Sentry.** Langfuse trace, Sentry groupe les stack traces et alerte.
  Métiers différents, ils cohabitent. Sentry reste optionnel : sans DSN, no-op.
- **Pas de casting de modèles**, pas de P0-1 taxonomie, pas de dimensionnement
  Koyeb. Autres lots.
- **Pas de réinstrumentation des points d'appel.** `withGenAiSpan` et
  `withDbSpan` restent tels quels — on change la destination, pas la mesure.

## Pourquoi ce n'est pas une refonte

Le SDK TypeScript Langfuse v4 (réécrit en août 2025) **est bâti sur
OpenTelemetry JS v2** : on enregistre un `LangfuseSpanProcessor` dans un
`NodeSDK` OTel. C'est une distribution d'OTel, pas un remplaçant.

Conséquence directe : `src/lib/otel/otel.ts` garde sa structure, on échange le
`OTLPTraceExporter` contre le span processor Langfuse. L'instrumentation
existante — attributs GenAI semconv sur chaque appel Mistral, `db.*` sur
Qdrant — continue de fonctionner sans être touchée.

Pour le Vercel AI SDK 7, c'est aussi le chemin officiellement documenté par
Langfuse : `@langfuse/vercel-ai-sdk` + enregistrement du span processor.

## L1 — Serveur

- Ajouter `@langfuse/otel` et `@langfuse/vercel-ai-sdk`.
- Dans `otel.ts` : `LangfuseSpanProcessor` à la place de
  `BatchSpanProcessor(OTLPTraceExporter)`, conditionné aux clés Langfuse.
  Garder le `ConsoleSpanExporter` en dev sans clés.
- **Vérification** : un tour de chat produit une trace contenant la
  classification d'intention, l'embed épisodique, l'appel principal et les
  étapes d'outils.

## L2 — ai-service

Autorisé par l'**amendement du 2026-08-21 à l'ADR 0002** : un exporteur de
télémétrie est hors du chemin de réponse, ne crée aucun couplage de données, et
« l'observabilité de son propre travail » était déjà listée dans le périmètre.
Le refus initial était une sur-application de la règle.

- `opentelemetry-sdk` + exporteur OTLP HTTP vers l'endpoint Langfuse.
- Un span par `/embed`, portant **exactement les champs déjà mesurés** par
  `emit_record` : `lock_wait_ms`, `inference_ms`, `duration_ms`, `texts`,
  `chars`, `inflight`, `model`, `status`.
- Les logs structurés **restent** : ils sont la source de vérité locale et le
  filet quand l'export ne part pas.
- **Règle non négociable, inchangée** : le texte embeddé n'est attaché à aucun
  span. Le test anti-fuite est étendu aux attributs de span.

## L3 — Corrélation

Sans ça, L1 et L2 produisent deux traces séparées et le problème initial reste
entier.

- Côté serveur, `ai-service.client.ts` injecte l'en-tête W3C `traceparent`
  dans l'appel HTTP (propagateur OTel standard, pas de format maison).
- Côté ai-service, extraction du contexte entrant et rattachement du span
  d'embed comme enfant.
- **Vérification** : dans Langfuse, déplier la trace d'une question d'élève
  montre l'attente sur le lock comme un span imbriqué sous la recherche RAG.

## Fini quand

1. Une question posée en dev apparaît dans Langfuse comme **une seule trace**,
   avec l'embed de l'ai-service imbriqué au bon endroit.
2. `lock_wait_ms` et `inference_ms` sont lisibles depuis l'interface, sans
   ouvrir un terminal — c'est le besoin qui a déclenché le lot.
3. Le budget de latence tient : p50 de `/embed` ≤ 606 ms (577 + 5 %), rejoué
   avec le même bench qu'en A1.
4. Le test anti-fuite passe, étendu aux attributs de span.
5. Sans clés Langfuse : aucune initialisation, aucun appel réseau, rien ne
   casse. Vérifié dans les deux services.

## Dépendances

Ce lot suppose les clés Langfuse posées (`scripts/langfuse-setup.sh`). Il est
**indépendant** de la consolidation ai-service (A2/A3/A4), qui reste bloquée
sur l'absence d'instance déployée.
