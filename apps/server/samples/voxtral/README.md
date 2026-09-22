# Samples voix Voxtral TTS

3 échantillons audio FR (~5 s chacun) gardés pour cloner une voix Voxtral par niveau scolaire. Rien ne les utilise aujourd'hui : `src/services/voxtral-tts.service.ts` lit tout avec la voix preset `fr_marie_neutral`, et aucun script de création de voix n'existe dans le dépôt. Le clonage par niveau est rattaché au lot 3 (TTS, voir `docs/superpowers/suivi.md`).

## Fichiers

| Fichier | Cible | Source | Licence |
|---|---|---|---|
| `primaire.mp3` | Élèves CP-CM2 (voix douce) | Piper TTS — `fr_FR/siwis/medium/speaker_0` | MIT |
| `college.mp3` | Élèves 6e-3e (voix neutre) | Piper TTS — `fr_FR/upmc/medium/speaker_0` | MIT |
| `lycee.mp3` | Élèves 2nde-Terminale (voix mature) | Piper TTS — `fr_FR/upmc/medium/speaker_1` | MIT |

## Origine

Ces samples sont des **voix synthétiques** générées par [Piper TTS](https://github.com/rhasspy/piper) (modèles fr_FR siwis et upmc), distribués sous licence MIT par le projet Rhasspy via Hugging Face :
- https://huggingface.co/rhasspy/piper-voices/tree/main/fr

**Pourquoi des voix synthétiques** : pas de problème de consentement (pas de personne réelle), libres pour usage commercial, qualité homogène entre les 3 voix.

## Statut « pour l'instant »

Ces voix sont un *placeholder* le temps de valider la stack TTS. Pour la production réelle :
- Enregistrer 3 voix de comédien voice-over sous contrat (~150-300€/voix sur Voxa, Bodalgo, BackStage), ou
- Faire valider les voix Piper actuelles par le product owner (qualité, ton, branding Tom).

Ne pas committer de samples grattés sur YouTube/podcasts : violation droit à l'image vocale + RGPD (la voix est une donnée biométrique).
