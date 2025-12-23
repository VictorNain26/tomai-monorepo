/**
 * Prompt Builder - LEGACY REDIRECT
 *
 * Ce fichier est maintenu pour la compatibilité avec l'ancien code.
 * Toute nouvelle utilisation doit importer depuis './system-prompt.js'
 *
 * @deprecated Utiliser system-prompt.ts directement
 */

// Re-export tout depuis system-prompt.ts
export {
  buildSystemPrompt,
  promptRequiresKaTeX,
  type SystemPromptParams as PromptBuilderParams
} from './system-prompt.js';
