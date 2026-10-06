/**
 * Taxonomie unique des matières (`docs/tuteur.md`, § 4). Les slugs nomment les matières du
 * collège pour les outils, les paquets de cartes, le référentiel et le jeu d'évaluation ; les
 * familles regroupent les consignes du tuteur, et l'analyse du tour en choisit une.
 */

export const SUBJECT_FAMILIES = ['mathematiques', 'francais', 'langues', 'sciences', 'histoire-geo', 'general'] as const;

export type SubjectFamily = (typeof SUBJECT_FAMILIES)[number];

export const SUBJECT_SLUGS = [
  'mathematiques', 'francais', 'anglais', 'espagnol', 'allemand', 'italien',
  'histoire-geo', 'physique-chimie', 'svt', 'technologie',
] as const;

export type SubjectSlug = (typeof SUBJECT_SLUGS)[number];

export const SUBJECTS: Record<SubjectSlug, { label: string; family: Exclude<SubjectFamily, 'general'> }> = {
  mathematiques: { label: 'Mathématiques', family: 'mathematiques' },
  francais: { label: 'Français', family: 'francais' },
  anglais: { label: 'Anglais', family: 'langues' },
  espagnol: { label: 'Espagnol', family: 'langues' },
  allemand: { label: 'Allemand', family: 'langues' },
  italien: { label: 'Italien', family: 'langues' },
  'histoire-geo': { label: 'Histoire-Géographie-EMC', family: 'histoire-geo' },
  'physique-chimie': { label: 'Physique-Chimie', family: 'sciences' },
  svt: { label: 'SVT', family: 'sciences' },
  technologie: { label: 'Technologie', family: 'sciences' },
};
