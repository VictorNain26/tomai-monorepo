/**
 * Configuration du curriculum 6ème (Cycle 3)
 *
 * La 6ème est la dernière année du Cycle 3 (CM1-CM2-6ème)
 * Transition primaire-collège avec consolidation des fondamentaux
 *
 * @see https://eduscol.education.fr/87/cycle-3-consolidation
 * @see https://www.education.gouv.fr/les-programmes-du-college-3203
 */

import type {
  SubjectConfig,
  LevelConfig,
  SubjectType,
} from './types.js';

/**
 * Configuration du niveau 6ème
 */
export const LEVEL_6EME: LevelConfig = {
  niveau: 'sixieme',
  cycle: 'cycle3',
  name: 'sixieme',
  nameFr: 'Sixième',
  ageRange: '11-12 ans',
  subjects: [
    'mathematiques',
    'francais',
    'physique_chimie', // Sciences et technologie en 6ème
    'svt',
    'histoire_geo',
    'anglais',
  ],
};

/**
 * Configuration des matières pour 6ème
 */
export const SUBJECTS_6EME: Record<SubjectType, SubjectConfig> = {
  mathematiques: {
    id: 'mathematiques',
    name: 'mathematics',
    nameFr: 'Mathématiques',
    hoursPerWeek: 4.5,
    color: '#3B82F6',
    icon: '📐',
    aiTutoringScore: 10,
    domains: [
      {
        id: 'nombres_calculs',
        name: 'numbers_calculations',
        nameFr: 'Nombres et calculs',
        competencies: [
          'Utiliser et représenter les grands nombres entiers',
          'Calculer avec des nombres entiers et décimaux',
          'Résoudre des problèmes en utilisant les 4 opérations',
          'Comprendre et utiliser la notion de fraction simple',
        ],
        subdomains: [
          {
            id: 'nombres_entiers',
            name: 'whole_numbers',
            nameFr: 'Nombres entiers',
            competencies: [
              'Lire, écrire et comparer des nombres entiers',
              'Utiliser la décomposition en facteurs premiers',
              'Connaître les critères de divisibilité',
            ],
          },
          {
            id: 'nombres_decimaux',
            name: 'decimal_numbers',
            nameFr: 'Nombres décimaux',
            competencies: [
              'Comprendre la valeur des chiffres selon leur position',
              'Comparer, ranger des nombres décimaux',
              'Opérations sur les décimaux',
            ],
          },
          {
            id: 'fractions_simples',
            name: 'simple_fractions',
            nameFr: 'Fractions simples',
            competencies: [
              'Comprendre la notion de fraction',
              'Représenter des fractions sur une droite graduée',
              'Utiliser des fractions pour exprimer des mesures',
            ],
          },
        ],
      },
      {
        id: 'geometrie',
        name: 'geometry',
        nameFr: 'Espace et géométrie',
        competencies: [
          'Reconnaître et construire des figures géométriques',
          'Utiliser les instruments de géométrie',
          'Reconnaître des solides usuels',
        ],
        subdomains: [
          {
            id: 'figures_planes',
            name: 'plane_figures',
            nameFr: 'Figures planes',
            competencies: [
              'Triangles, quadrilatères, cercles',
              'Propriétés des figures',
              'Constructions géométriques',
            ],
          },
          {
            id: 'symetrie_axiale',
            name: 'axial_symmetry',
            nameFr: 'Symétrie axiale',
            competencies: [
              'Reconnaître des axes de symétrie',
              'Construire le symétrique d\'une figure',
            ],
          },
        ],
      },
      {
        id: 'grandeurs_mesures',
        name: 'quantities_measures',
        nameFr: 'Grandeurs et mesures',
        competencies: [
          'Calculer des périmètres et des aires',
          'Convertir des unités',
          'Résoudre des problèmes impliquant des grandeurs',
        ],
      },
    ],
  },
  francais: {
    id: 'francais',
    name: 'french',
    nameFr: 'Français',
    hoursPerWeek: 4.5,
    color: '#8B5CF6',
    icon: '📚',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'lecture_comprehension',
        name: 'reading_comprehension',
        nameFr: 'Lecture et compréhension',
        competencies: [
          'Lire avec fluidité',
          'Comprendre des textes variés',
          'Interpréter et apprécier un texte littéraire',
        ],
      },
      {
        id: 'ecriture',
        name: 'writing',
        nameFr: 'Écriture',
        competencies: [
          'Écrire à la main de manière fluide',
          'Rédiger des écrits variés',
          'Réécrire et améliorer ses productions',
        ],
      },
      {
        id: 'etude_langue',
        name: 'language_study',
        nameFr: 'Étude de la langue',
        competencies: [
          'Maîtriser les relations entre l\'oral et l\'écrit',
          'Identifier les classes de mots',
          'Maîtriser l\'orthographe grammaticale',
          'Conjuguer les verbes aux temps simples',
        ],
        subdomains: [
          {
            id: 'grammaire',
            name: 'grammar',
            nameFr: 'Grammaire',
            competencies: [
              'Nature et fonction des mots',
              'Accord sujet-verbe',
              'Accord dans le groupe nominal',
            ],
          },
          {
            id: 'conjugaison',
            name: 'conjugation',
            nameFr: 'Conjugaison',
            competencies: [
              'Présent, imparfait, futur, passé composé',
              'Passé simple (3èmes personnes)',
            ],
          },
          {
            id: 'orthographe',
            name: 'spelling',
            nameFr: 'Orthographe',
            competencies: [
              'Homophones grammaticaux',
              'Accords dans le groupe nominal',
            ],
          },
        ],
      },
    ],
  },
  physique_chimie: {
    id: 'physique_chimie',
    name: 'sciences',
    nameFr: 'Sciences et technologie',
    hoursPerWeek: 4,
    color: '#F59E0B',
    icon: '🔬',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'matiere',
        name: 'matter',
        nameFr: 'La matière',
        competencies: [
          'Décrire les états de la matière',
          'Observer et décrire différents types de mouvements',
        ],
      },
      {
        id: 'vivant',
        name: 'living',
        nameFr: 'Le vivant',
        competencies: [
          'Classer les êtres vivants',
          'Décrire comment les êtres vivants se développent',
        ],
      },
      {
        id: 'energie',
        name: 'energy',
        nameFr: 'L\'énergie',
        competencies: [
          'Identifier les sources d\'énergie',
          'Identifier un signal et une information',
        ],
      },
    ],
  },
  svt: {
    id: 'svt',
    name: 'life_sciences',
    nameFr: 'Sciences de la vie et de la Terre',
    hoursPerWeek: 1.5,
    color: '#10B981',
    icon: '🌿',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'vivant',
        name: 'living',
        nameFr: 'Le vivant et son évolution',
        competencies: [
          'Décrire la cellule',
          'Relier les besoins des cellules à leur nutrition',
          'Décrire la reproduction des êtres vivants',
        ],
      },
      {
        id: 'corps_sante',
        name: 'body_health',
        nameFr: 'Le corps humain et la santé',
        competencies: [
          'Décrire les mouvements et leur commande',
          'Expliquer les besoins alimentaires',
        ],
      },
    ],
  },
  histoire_geo: {
    id: 'histoire_geo',
    name: 'history_geography',
    nameFr: 'Histoire-Géographie',
    hoursPerWeek: 3,
    color: '#EF4444',
    icon: '🗺️',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'histoire',
        name: 'history',
        nameFr: 'Histoire',
        competencies: [
          'Se repérer dans le temps',
          'Comprendre et analyser un document',
          'Pratiquer différents langages historiques',
        ],
        subdomains: [
          {
            id: 'prehistoire_antiquite',
            name: 'prehistory_antiquity',
            nameFr: 'De la préhistoire à l\'Antiquité',
            competencies: [
              'Les débuts de l\'humanité',
              'La révolution néolithique',
              'Les premières civilisations',
            ],
          },
          {
            id: 'rome',
            name: 'rome',
            nameFr: 'L\'Empire romain',
            competencies: [
              'Rome, du mythe à l\'histoire',
              'La romanisation',
              'Les débuts du christianisme',
            ],
          },
        ],
      },
      {
        id: 'geographie',
        name: 'geography',
        nameFr: 'Géographie',
        competencies: [
          'Se repérer dans l\'espace',
          'Comprendre le monde actuel',
          'Raisonner, justifier une démarche',
        ],
        subdomains: [
          {
            id: 'habiter',
            name: 'inhabiting',
            nameFr: 'Habiter',
            competencies: [
              'Habiter une métropole',
              'Habiter un espace à fortes contraintes',
              'Habiter un espace de faible densité',
            ],
          },
        ],
      },
    ],
  },
  anglais: {
    id: 'anglais',
    name: 'english',
    nameFr: 'Anglais LV1',
    hoursPerWeek: 4,
    color: '#EC4899',
    icon: '🇬🇧',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'comprehension_orale',
        name: 'listening',
        nameFr: 'Écouter et comprendre',
        competencies: [
          'Comprendre des mots familiers',
          'Suivre des instructions simples',
          'Comprendre l\'essentiel d\'un message court',
        ],
      },
      {
        id: 'expression_orale',
        name: 'speaking',
        nameFr: 'Parler en continu',
        competencies: [
          'Se présenter',
          'Décrire son environnement',
          'Raconter une histoire courte',
        ],
      },
      {
        id: 'grammaire_lexique',
        name: 'grammar_vocabulary',
        nameFr: 'Grammaire et lexique',
        competencies: [
          'Connaître les structures de base',
          'Maîtriser un vocabulaire usuel',
        ],
        subdomains: [
          {
            id: 'grammar',
            name: 'grammar',
            nameFr: 'Grammar',
            competencies: [
              'Present Simple',
              'Present Continuous',
              'Pronouns and determiners',
            ],
          },
          {
            id: 'vocabulary',
            name: 'vocabulary',
            nameFr: 'Vocabulary',
            competencies: [
              'Family, school, hobbies',
              'Daily routine',
              'Food and drinks',
            ],
          },
        ],
      },
    ],
  },
};
