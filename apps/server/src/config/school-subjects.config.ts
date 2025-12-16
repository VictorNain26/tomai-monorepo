/**
 * Configuration des matières scolaires françaises par niveau
 * Basé sur le programme officiel de l'Éducation Nationale
 */

import type { EducationLevelType } from '../types/education.types.js';

export interface SchoolSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[]; // Mots-clés pour optimiser la recherche RAG
}

export interface LevelSubjects {
  level: EducationLevelType;
  cycle: 'primaire' | 'college' | 'lycee';
  subjects: SchoolSubject[];
}

// =============================================
// MATIÈRES SCOLAIRES FRANÇAISES
// =============================================

const commonSubjects = {
  mathematiques: {
    key: 'mathematiques',
    name: 'Mathématiques',
    description: 'Calculs, géométrie, problèmes',
    emoji: '🔢',
    color: 'blue',
    ragKeywords: ['mathématiques', 'calcul', 'géométrie', 'nombres', 'opérations']
  },
  francais: {
    key: 'francais',
    name: 'Français',
    description: 'Lecture, écriture, grammaire',
    emoji: '📚',
    color: 'red',
    ragKeywords: ['français', 'grammaire', 'conjugaison', 'orthographe', 'lecture', 'écriture']
  },
  sciences: {
    key: 'sciences',
    name: 'Sciences',
    description: 'Découverte du monde scientifique',
    emoji: '🔬',
    color: 'green',
    ragKeywords: ['sciences', 'expériences', 'nature', 'corps humain', 'environnement']
  },
  histoire: {
    key: 'histoire',
    name: 'Histoire',
    description: 'Découverte du passé',
    emoji: '🏛️',
    color: 'orange',
    ragKeywords: ['histoire', 'passé', 'événements', 'personnages historiques', 'dates']
  },
  geographie: {
    key: 'geographie',
    name: 'Géographie',
    description: 'Découverte du monde',
    emoji: '🗺️',
    color: 'teal',
    ragKeywords: ['géographie', 'pays', 'continents', 'climat', 'paysages', 'villes']
  }
};

const collegeSubjects = {
  ...commonSubjects,
  anglais: {
    key: 'anglais',
    name: 'Anglais',
    description: 'Langue vivante étrangère',
    emoji: '🇬🇧',
    color: 'purple',
    ragKeywords: ['anglais', 'langue', 'vocabulaire', 'conversation', 'grammaire anglaise']
  },
  svt: {
    key: 'svt',
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    emoji: '🌱',
    color: 'emerald',
    ragKeywords: ['SVT', 'biologie', 'géologie', 'écosystème', 'cellules', 'planète']
  },
  physique: {
    key: 'physique',
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    emoji: '⚛️',
    color: 'cyan',
    ragKeywords: ['physique', 'chimie', 'expériences', 'matière', 'énergie', 'réactions']
  },
  technologie: {
    key: 'technologie',
    name: 'Technologie',
    description: 'Découverte technique et numérique',
    emoji: '⚙️',
    color: 'gray',
    ragKeywords: ['technologie', 'numérique', 'objets techniques', 'programmation', 'robotique']
  }
};

const lyceeSubjects = {
  ...collegeSubjects,
  philosophie: {
    key: 'philosophie',
    name: 'Philosophie',
    description: 'Réflexion et argumentation',
    emoji: '🤔',
    color: 'indigo',
    ragKeywords: ['philosophie', 'réflexion', 'argumentation', 'concepts', 'pensée critique']
  },
  economie: {
    key: 'economie',
    name: 'SES',
    description: 'Sciences Économiques et Sociales',
    emoji: '📊',
    color: 'rose',
    ragKeywords: ['économie', 'société', 'entreprise', 'marché', 'politique', 'social']
  }
};

// =============================================
// CONFIGURATION PAR NIVEAU
// =============================================

export const schoolSubjectsByLevel: LevelSubjects[] = [
  // PRIMAIRE
  {
    level: 'cp',
    cycle: 'primaire',
    subjects: [
      commonSubjects.francais,
      commonSubjects.mathematiques,
      commonSubjects.sciences,
      {
        key: 'questionner_monde',
        name: 'Questionner le monde',
        description: 'Découverte de l\'environnement',
        emoji: '🌍',
        color: 'amber',
        ragKeywords: ['questionner le monde', 'environnement', 'découverte', 'observation']
      }
    ]
  },
  {
    level: 'ce1',
    cycle: 'primaire',
    subjects: [
      commonSubjects.francais,
      commonSubjects.mathematiques,
      commonSubjects.sciences,
      {
        key: 'questionner_monde',
        name: 'Questionner le monde',
        description: 'Découverte de l\'environnement',
        emoji: '🌍',
        color: 'amber',
        ragKeywords: ['questionner le monde', 'environnement', 'découverte', 'observation']
      }
    ]
  },
  {
    level: 'ce2',
    cycle: 'primaire',
    subjects: [
      commonSubjects.francais,
      commonSubjects.mathematiques,
      commonSubjects.sciences,
      commonSubjects.histoire,
      commonSubjects.geographie
    ]
  },
  {
    level: 'cm1',
    cycle: 'primaire',
    subjects: [
      commonSubjects.francais,
      commonSubjects.mathematiques,
      commonSubjects.sciences,
      commonSubjects.histoire,
      commonSubjects.geographie,
      {
        key: 'anglais_initiation',
        name: 'Anglais (initiation)',
        description: 'Première approche de l\'anglais',
        emoji: '🇬🇧',
        color: 'purple',
        ragKeywords: ['anglais', 'initiation', 'langue étrangère', 'vocabulaire simple']
      }
    ]
  },
  {
    level: 'cm2',
    cycle: 'primaire',
    subjects: [
      commonSubjects.francais,
      commonSubjects.mathematiques,
      commonSubjects.sciences,
      commonSubjects.histoire,
      commonSubjects.geographie,
      collegeSubjects.anglais
    ]
  },

  // COLLÈGE
  {
    level: 'sixieme',
    cycle: 'college',
    subjects: [
      collegeSubjects.francais,
      collegeSubjects.mathematiques,
      collegeSubjects.anglais,
      collegeSubjects.histoire,
      collegeSubjects.geographie,
      collegeSubjects.svt,
      collegeSubjects.technologie
    ]
  },
  {
    level: 'cinquieme',
    cycle: 'college',
    subjects: [
      collegeSubjects.francais,
      collegeSubjects.mathematiques,
      collegeSubjects.anglais,
      collegeSubjects.histoire,
      collegeSubjects.geographie,
      collegeSubjects.svt,
      collegeSubjects.physique,
      collegeSubjects.technologie
    ]
  },
  {
    level: 'quatrieme',
    cycle: 'college',
    subjects: [
      collegeSubjects.francais,
      collegeSubjects.mathematiques,
      collegeSubjects.anglais,
      collegeSubjects.histoire,
      collegeSubjects.geographie,
      collegeSubjects.svt,
      collegeSubjects.physique,
      collegeSubjects.technologie
    ]
  },
  {
    level: 'troisieme',
    cycle: 'college',
    subjects: [
      collegeSubjects.francais,
      collegeSubjects.mathematiques,
      collegeSubjects.anglais,
      collegeSubjects.histoire,
      collegeSubjects.geographie,
      collegeSubjects.svt,
      collegeSubjects.physique,
      collegeSubjects.technologie
    ]
  },

  // LYCÉE
  {
    level: 'seconde',
    cycle: 'lycee',
    subjects: [
      lyceeSubjects.francais,
      lyceeSubjects.mathematiques,
      lyceeSubjects.anglais,
      lyceeSubjects.histoire,
      lyceeSubjects.geographie,
      lyceeSubjects.svt,
      lyceeSubjects.physique,
      lyceeSubjects.economie
    ]
  },
  {
    level: 'premiere',
    cycle: 'lycee',
    subjects: [
      lyceeSubjects.francais,
      lyceeSubjects.mathematiques,
      lyceeSubjects.anglais,
      lyceeSubjects.histoire,
      lyceeSubjects.geographie,
      lyceeSubjects.svt,
      lyceeSubjects.physique,
      lyceeSubjects.philosophie,
      lyceeSubjects.economie
    ]
  },
  {
    level: 'terminale',
    cycle: 'lycee',
    subjects: [
      lyceeSubjects.francais,
      lyceeSubjects.mathematiques,
      lyceeSubjects.anglais,
      lyceeSubjects.histoire,
      lyceeSubjects.geographie,
      lyceeSubjects.svt,
      lyceeSubjects.physique,
      lyceeSubjects.philosophie,
      lyceeSubjects.economie
    ]
  }
];

// =============================================
// HELPERS
// =============================================

/**
 * Obtient les matières pour un niveau donné
 */
export function getSubjectsForLevel(level: EducationLevelType): SchoolSubject[] {
  const levelConfig = schoolSubjectsByLevel.find(config => config.level === level);
  return levelConfig?.subjects ?? [];
}

/**
 * Obtient le cycle pour un niveau donné
 */
export function getCycleForLevel(level: EducationLevelType): 'primaire' | 'college' | 'lycee' {
  const levelConfig = schoolSubjectsByLevel.find(config => config.level === level);
  return levelConfig?.cycle ?? 'primaire';
}

/**
 * Obtient une matière par sa clé
 */
export function getSubjectByKey(key: string, level: EducationLevelType): SchoolSubject | undefined {
  const subjects = getSubjectsForLevel(level);
  return subjects.find(subject => subject.key === key);
}

/**
 * Valide qu'une matière est disponible pour un niveau donné
 */
export function isSubjectValidForLevel(subjectKey: string, level: EducationLevelType): boolean {
  const subjects = getSubjectsForLevel(level);
  return subjects.some(subject => subject.key === subjectKey);
}

/**
 * Obtient les mots-clés RAG pour une matière
 */
export function getRagKeywordsForSubject(subjectKey: string, level: EducationLevelType): string[] {
  const subject = getSubjectByKey(subjectKey, level);
  return subject?.ragKeywords ?? [];
}