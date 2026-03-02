# Securite

## JAMAIS committer de secrets

Fichiers interdits dans git : `.env.*` (sauf `.env.example`), cles API, credentials OAuth, `.claude/settings.local.json`.

## Avant chaque commit

Verifier qu'aucun secret n'est stage. Si detecte, retirer du staging immediatement.

## Si secret expose

1. Revoquer immediatement les cles compromises
2. Nettoyer l'historique Git (BFG ou orphan branch)
3. Force push les branches nettoyees
4. Regenerer toutes les cles
