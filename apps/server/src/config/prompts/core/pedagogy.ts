/**
 * Pédagogie Chatbot - Wrapper vers module centralisé
 *
 * Ce fichier réexporte les fonctions du module shared/pedagogy
 * pour maintenir la compatibilité avec l'architecture existante du chatbot.
 *
 * @see src/shared/pedagogy/csen-principles.ts pour les sources CSEN officielles
 */

import { generateChatbotPedagogyPrompt } from '../../../shared/pedagogy/index.js';

/**
 * Génère les principes pédagogiques CSEN pour le chatbot
 * @deprecated Utiliser directement generateChatbotPedagogyPrompt() depuis shared/pedagogy
 */
export function generatePedagogyPrinciples(): string {
  return generateChatbotPedagogyPrompt();
}

// Réexport pour compatibilité
export { generateChatbotPedagogyPrompt };
