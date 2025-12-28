/**
 * Principes Pédagogiques Centralisés - Export Module
 *
 * Ce module est la SOURCE UNIQUE pour tous les principes pédagogiques utilisés
 * par les features éducatives de Tom (Chatbot, Cards, Quiz, etc.)
 */

// Données et structures
export {
  CSEN_FOUR_PILLARS,
  CSEN_EXPLICIT_TEACHING,
  SCIENTIFIC_EXTENSIONS,
  type CSENPillarId
} from './csen-principles.js';

// Générateurs de prompts
export {
  generateChatbotPedagogyPrompt,
  generateCardsPedagogyPrompt,
  getPrinciplesSummary
} from './csen-principles.js';
