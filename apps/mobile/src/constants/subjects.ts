// Matières par niveau scolaire
// Couleurs basées sur la psychologie des couleurs pour l'apprentissage

export const SUBJECT_COLORS = {
  french: '#8B5CF6', // Violet - créativité littéraire
  mathematics: '#3B82F6', // Bleu - logique
  sciences: '#22C55E', // Vert - nature, expérimentation
  physics: '#06B6D4', // Cyan - sciences exactes
  history: '#F59E0B', // Ambre - archives, temps
  english: '#EC4899', // Rose - communication
  philosophy: '#A855F7', // Violet clair - réflexion
  ses: '#F97316', // Orange - économie/société
} as const;

export type SubjectId = keyof typeof SUBJECT_COLORS;

export const SUBJECTS: Record<string, Array<{ id: SubjectId; label: string; icon: string }>> = {
  primaire: [
    { id: 'french', label: 'Français', icon: 'book-open' },
    { id: 'mathematics', label: 'Mathématiques', icon: 'calculator' },
    { id: 'sciences', label: 'Sciences', icon: 'flask' },
    { id: 'history', label: 'Histoire-Géo', icon: 'globe' },
  ],
  college: [
    { id: 'french', label: 'Français', icon: 'book-open' },
    { id: 'mathematics', label: 'Mathématiques', icon: 'calculator' },
    { id: 'sciences', label: 'SVT', icon: 'leaf' },
    { id: 'physics', label: 'Physique-Chimie', icon: 'atom' },
    { id: 'history', label: 'Histoire-Géo', icon: 'globe' },
    { id: 'english', label: 'Anglais', icon: 'languages' },
  ],
  lycee: [
    { id: 'french', label: 'Français', icon: 'book-open' },
    { id: 'mathematics', label: 'Mathématiques', icon: 'calculator' },
    { id: 'sciences', label: 'SVT', icon: 'leaf' },
    { id: 'physics', label: 'Physique-Chimie', icon: 'atom' },
    { id: 'history', label: 'Histoire-Géo', icon: 'globe' },
    { id: 'philosophy', label: 'Philosophie', icon: 'brain' },
    { id: 'english', label: 'Anglais', icon: 'languages' },
    { id: 'ses', label: 'SES', icon: 'trending-up' },
  ],
};
