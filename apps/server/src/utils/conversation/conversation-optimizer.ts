/**
 * Optimiseur de conversations - Gestion intelligente d'historique
 * Externalisation depuis gemini-simple.service.ts (lignes 386-488)
 */

import type { IAIMessage } from './types.js';

/**
 * Constantes de configuration
 */
const MAX_HISTORY_TOKENS = 8000;
const RECENT_MESSAGES_COUNT = 6;
const MAX_TOPICS = 3;
const TOKENS_PER_CHAR = 4; // 1 token ≈ 4 caractères en français

/**
 * Estime le nombre de tokens d'un texte
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKENS_PER_CHAR);
}

/**
 * Extrait les sujets clés des questions utilisateur (usage interne)
 */
function extractKeyTopics(questions: string[]): string[] {
  const allText = questions.join(' ');
  const topics = new Set<string>();

  // Mots-clés mathématiques
  if (/addition|soustraction|multiplication|division|calcul/i.test(allText)) {
    topics.add('calculs mathématiques');
  }
  if (/fraction|décimaux|pourcentage/i.test(allText)) {
    topics.add('fractions et décimaux');
  }
  if (/géométrie|triangle|carré|cercle/i.test(allText)) {
    topics.add('géométrie');
  }

  // Mots-clés français
  if (/grammaire|conjugaison|verbe|accord/i.test(allText)) {
    topics.add('grammaire française');
  }
  if (/lecture|compréhension|texte|récit/i.test(allText)) {
    topics.add('compréhension de lecture');
  }

  // Autres matières
  if (/science|expérience|observation/i.test(allText)) {
    topics.add('sciences');
  }
  if (/histoire|date|époque/i.test(allText)) {
    topics.add('histoire');
  }

  return Array.from(topics).slice(0, MAX_TOPICS);
}

/**
 * Analyse la progression pédagogique dans l'historique (usage interne)
 */
function analyzeProgress(messages: IAIMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.some(m => /merci|compris|ok|d'accord/i.test(m.content))) {
    return 'bonne compréhension';
  }

  if (userMessages.some(m => /difficile|ne comprends pas|pourquoi/i.test(m.content))) {
    return 'difficultés rencontrées';
  }

  return 'en cours d\'apprentissage';
}

/**
 * Crée un résumé pédagogique intelligent des anciens messages (usage interne)
 */
function createPedagogicalSummary(messages: IAIMessage[]): string {
  const userQuestions = messages.filter(m => m.role === 'user').map(m => m.content);
  const keyTopics = extractKeyTopics(userQuestions);
  const progressIndication = analyzeProgress(messages);

  return `Sujets abordés: ${keyTopics.join(', ')}. Progression: ${progressIndication}.`;
}

/**
 * Optimise l'historique de conversation pour gestion tokens
 * Extraction de gemini-simple.service.ts lignes 386-423
 */
export function optimizeConversationHistory(history: IAIMessage[]): IAIMessage[] {
  if (history.length <= 10) {
    // Historique court : garder tout
    return history;
  }

  // Toujours garder les derniers messages complets (contexte immédiat)
  const recentMessages = history.slice(-RECENT_MESSAGES_COUNT);
  const olderMessages = history.slice(0, -RECENT_MESSAGES_COUNT);

  const totalTokens = recentMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

  if (totalTokens >= MAX_HISTORY_TOKENS || olderMessages.length === 0) {
    return recentMessages;
  }

  // Créer un résumé pédagogique des anciens messages
  const summary = createPedagogicalSummary(olderMessages);
  const summaryTokens = estimateTokens(summary);

  if (totalTokens + summaryTokens <= MAX_HISTORY_TOKENS) {
    // Ajouter le résumé en début d'historique
    return [
      {
        role: 'assistant' as const,
        content: `[Résumé de notre conversation précédente: ${summary}]`,
        timestamp: new Date().toISOString()
      },
      ...recentMessages
    ];
  }

  return recentMessages; // Si même avec résumé, trop lourd
}
