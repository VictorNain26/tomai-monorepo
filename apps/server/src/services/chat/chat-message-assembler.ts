import type { MistralMessage, MistralContentPart } from '../../lib/ai/mistral-client.js';

export interface ChatMessageParts {
  systemPrompt: string;
  /** Résumé DÉJÀ tronqué au budget (ou null/undefined si aucun). */
  conversationSummary?: string | null;
  historyMessages: MistralMessage[];
  studentContextBlock?: string | null;
  pronoteBlock?: string | null;
  attachedFilesBlock?: string | null;
  intentReinforcement?: string | null;
  inputMode?: string;
  userContent: string | MistralContentPart[];
}

/**
 * Assemble le tableau de messages envoyé à Mistral. Ordre : système (préfixe
 * caché) → résumé de conversation → fenêtre verbatim → contexte élève → pronote
 * → fichiers → consigne du tour → marqueur vocal → message courant.
 *
 * Le résumé est injecté ICI (un message role:'system' dans l'historique serait
 * filtré avant l'appel Mistral), ce qui complète le découplage fait dans
 * conversation-optimizer (qui ne renvoie plus que la fenêtre verbatim).
 */
export function assembleChatMessages(parts: ChatMessageParts): MistralMessage[] {
  return [
    { role: 'system' as const, content: parts.systemPrompt },
    ...(parts.conversationSummary
      ? [
          {
            role: 'user' as const,
            content: `<conversation_summary>\n${parts.conversationSummary}\n</conversation_summary>`,
          },
        ]
      : []),
    ...parts.historyMessages,
    ...(parts.studentContextBlock
      ? [{ role: 'user' as const, content: parts.studentContextBlock }]
      : []),
    ...(parts.pronoteBlock ? [{ role: 'user' as const, content: parts.pronoteBlock }] : []),
    ...(parts.attachedFilesBlock
      ? [{ role: 'user' as const, content: parts.attachedFilesBlock }]
      : []),
    ...(parts.intentReinforcement
      ? [{ role: 'user' as const, content: `[Consigne pour ce tour]\n${parts.intentReinforcement}` }]
      : []),
    ...(parts.inputMode === 'voice'
      ? [
          {
            role: 'user' as const,
            content: "[VOCAL] Ce tour a été dicté à l'oral — réponds en style parlé, sans markdown.",
          },
        ]
      : []),
    { role: 'user' as const, content: parts.userContent },
  ];
}
