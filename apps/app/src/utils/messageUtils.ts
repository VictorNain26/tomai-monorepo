import type { IMessage } from '@/types';

/**
 * Interface pour les informations du provider AI
 */
export interface IProviderInfo {
  name: string;
  tier: string;
}

/**
 * Formate le contenu du message pour l'affichage
 */
export const formatMessageContent = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Simple formatting - keep it clean and readable
  return content.trim();
};

/**
 * Extrait le nom du provider depuis les métadonnées ou le champ aiModel
 */
const extractProviderName = (message: IMessage): string | null => {
  // Priorité 1: utiliser aiModel directement depuis le message
  if (message.aiModel != null && message.aiModel !== '') {
    return message.aiModel;
  }

  // Fallback: métadonnées (compatibilité)
  const provider = message.metadata?.provider ?? message.metadata?.aiModelDetails?.name;
  if (provider == null || provider === '') {
    return null;
  }
  return typeof provider === 'string' ? provider : null;
};

/**
 * Extrait le tier depuis les métadonnées
 */
const extractProviderTier = (metadata?: IMessage['metadata']): string => {
  return metadata?.aiModelDetails?.tier ?? 'standard';
};

/**
 * Extrait les informations du provider AI depuis les métadonnées
 * Note: Normalisation effectuée côté backend pour garantir la cohérence
 */
export const getProviderInfo = (message: IMessage): IProviderInfo | null => {
  const provider = extractProviderName(message);
  if (provider == null) {
    return null;
  }

  const tier = extractProviderTier(message.metadata);

  // ✅ Utilisation directe du nom déjà normalisé par le backend
  return { name: provider, tier };
};

/**
 * Vérifie si le message a des métadonnées de questionnement
 */
export const hasQuestionLevel = (metadata?: IMessage['metadata']): boolean => {
  return metadata?.questionLevel !== undefined;
};

/**
 * Vérifie si le message a un niveau de frustration élevé
 */
export const hasHighFrustration = (metadata?: IMessage['metadata']): boolean => {
  return metadata?.frustrationLevel !== undefined && metadata.frustrationLevel > 5;
};
