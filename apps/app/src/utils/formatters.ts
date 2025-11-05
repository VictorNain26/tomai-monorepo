/**
 * FORMATTERS UNIFIÉS - Toutes les fonctions de formatage centralisées
 * Remplace: homeUtilsFormatters.ts, parentDashboardFormatters.ts, dashboardUtils.ts
 */

// Types pour une meilleure sécurité avec support backward compatibility
interface ISession {
  title?: string;
  subject?: string;
  startTime?: string;
  startedAt?: string;
}

interface IMessage {
  role: string;
  content: string;
}

/**
 * Formate une durée avec support des unités multiples
 */
export const formatDuration = (
  value: number,
  unit: 'ms' | 'minutes' = 'minutes'
): string => {
  let minutes: number;

  if (unit === 'ms') {
    minutes = Math.floor(value / (1000 * 60));
  } else {
    minutes = value;
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);

  return `${hours}h${remainingMins > 0 ? ` ${remainingMins}min` : ''}`;
};

/**
 * Formate une date avec gestion des cas spéciaux
 */
export const formatDate = (
  dateInput?: string | Date,
  fallback: string = 'N/A'
): string => {
  if (dateInput == null || dateInput === '') {
    return fallback;
  }

  const date = new Date(dateInput);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Aujourd\'hui';
  }
  if (diffDays === 1) {
    return 'Hier';
  }
  if (diffDays < 7) {
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });
};

/**
 * Formate une date complète pour les cas où on veut plus de détails
 */
export const formatDateLong = (dateInput?: string | Date): string => {
  if (dateInput == null || dateInput === '') {
    return 'Date inconnue';
  }

  const date = new Date(dateInput);
  return date.toLocaleDateString('fr-FR');
};

/**
 * Génère un nom de chat basé sur les données de session
 */
const getSessionTitle = (session: ISession): string | null => {
  // Essayer d'abord le titre, puis le sujet
  const title = session.title ?? session.subject;
  if (title != null && title.trim() !== '') {
    return title;
  }
  return null;
};

const getFirstUserMessage = (messages?: IMessage[]): string | null => {
  if (messages == null || messages.length === 0) {
    return null;
  }

  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage == null) {
    return null;
  }

  const content = firstUserMessage.content.trim();
  if (content.length === 0) {
    return null;
  }

  return content.length > 50 ? `${content.substring(0, 50)}...` : content;
};

const getDateFallback = (session: ISession): string => {
  const dateString = session.startTime ?? session.startedAt ?? new Date().toISOString();
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  };
  return `Conversation du ${date.toLocaleDateString('fr-FR', options)}`;
};

export const generateChatName = (
  session: ISession,
  messages?: IMessage[]
): string => {
  const title = getSessionTitle(session);
  if (title != null) {
    return title;
  }

  const userMessage = getFirstUserMessage(messages);
  if (userMessage != null) {
    return userMessage;
  }

  return getDateFallback(session);
};

/**
 * Obtient le label de frustration basé sur le niveau
 */
export const getFrustrationLabel = (frustration: number): string => {
  if (frustration < 4) {
    return 'Très bien';
  }
  if (frustration < 7) {
    return 'Acceptable';
  }
  return 'À surveiller';
};

/**
 * Calcule le pourcentage de progrès
 */
export const calculateProgress = (current: number, total: number): number => {
  if (total === 0) {
    return 0;
  }
  return Math.round((current / total) * 100);
};

/**
 * Formate un score en pourcentage
 */
export const formatScore = (score: number): string => {
  return `${Math.round(score)}%`;
};

/**
 * Détermine la couleur CSS du niveau de progrès
 */
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 80) {
    return 'text-success';
  }
  if (percentage >= 60) {
    return 'text-warning';
  }
  return 'text-destructive';
};

/**
 * Valide si des données de statistiques sont présentes
 */
export const hasValidStats = (stats: unknown): stats is Record<string, unknown> => {
  return stats != null && typeof stats === 'object';
};

/**
 * Valide si des sessions sont présentes
 */
export const hasValidSessions = (sessions: unknown): sessions is unknown[] => {
  return Array.isArray(sessions) && sessions.length > 0;
};

/**
 * Formate un nombre avec séparateurs de milliers
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('fr-FR').format(value);
};

/**
 * Formate une devise en euros
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};

/**
 * Formate une distance de temps relative (ex: "il y a 5 minutes")
 */
export const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'à l\'instant';
  }
  if (diffMinutes < 60) {
    return `il y a ${diffMinutes}min`;
  }
  if (diffHours < 24) {
    return `il y a ${diffHours}h`;
  }
  if (diffDays === 1) {
    return 'hier';
  }
  if (diffDays < 7) {
    return `il y a ${diffDays}j`;
  }

  return formatDate(date);
};
