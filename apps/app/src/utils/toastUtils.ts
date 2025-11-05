/**
 * Utilitaire Toast intelligent - Évite les duplicatas
 * Solution pour React StrictMode qui cause des doubles appels
 */

import { toast } from 'sonner';

// Cache des derniers messages pour éviter les doublons
const lastToasts: Map<string, { timestamp: number; type: string }> = new Map();
const DUPLICATE_THRESHOLD = 100; // 100ms pour considérer comme doublon

/**
 * Nettoyage périodique du cache (éviter les fuites mémoire)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of lastToasts.entries()) {
    if (now - value.timestamp > 5000) { // 5 secondes
      lastToasts.delete(key);
    }
  }
}, 10000); // Nettoyage toutes les 10 secondes

/**
 * Vérifier si le toast est un doublon
 */
function isDuplicate(message: string, type: string): boolean {
  const key = `${type}:${message}`;
  const now = Date.now();
  const lastToast = lastToasts.get(key);

  if (lastToast && (now - lastToast.timestamp) < DUPLICATE_THRESHOLD) {
    return true;
  }

  lastToasts.set(key, { timestamp: now, type });
  return false;
}

/**
 * Toast intelligent avec détection de doublons
 */
export const smartToast = {
  success: (message: string, options?: Parameters<typeof toast.success>[1]) => {
    if (isDuplicate(message, 'success')) return;
    return toast.success(message, options);
  },

  error: (message: string, options?: Parameters<typeof toast.error>[1]) => {
    if (isDuplicate(message, 'error')) return;
    return toast.error(message, options);
  },

  info: (message: string, options?: Parameters<typeof toast.info>[1]) => {
    if (isDuplicate(message, 'info')) return;
    return toast.info(message, options);
  },

  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) => {
    if (isDuplicate(message, 'warning')) return;
    return toast.warning(message, options);
  },

  // Méthode pour forcer un toast même s'il semble être un doublon
  force: {
    success: (message: string, options?: Parameters<typeof toast.success>[1]) => {
      return toast.success(message, options);
    },
    error: (message: string, options?: Parameters<typeof toast.error>[1]) => {
      return toast.error(message, options);
    },
    info: (message: string, options?: Parameters<typeof toast.info>[1]) => {
      return toast.info(message, options);
    },
    warning: (message: string, options?: Parameters<typeof toast.warning>[1]) => {
      return toast.warning(message, options);
    }
  }
};

// Export par défaut pour faciliter l'import
export default smartToast;
