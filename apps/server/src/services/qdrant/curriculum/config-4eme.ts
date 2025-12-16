/**
 * Configuration du curriculum 4ème (Cycle 4)
 *
 * Année centrale du Cycle 4 avec approfondissement des notions
 *
 * @see https://eduscol.education.fr/90/j-enseigne-au-cycle-4
 * @see https://www.education.gouv.fr/les-programmes-du-college-3203
 */

import type {
  SubjectConfig,
  LevelConfig,
  SubjectType,
} from './types.js';

/**
 * Configuration du niveau 4ème
 */
export const LEVEL_4EME: LevelConfig = {
  niveau: 'quatrieme',
  cycle: 'cycle4',
  name: 'quatrieme',
  nameFr: 'Quatrième',
  ageRange: '13-14 ans',
  subjects: [
    'mathematiques',
    'francais',
    'physique_chimie',
    'svt',
    'histoire_geo',
    'anglais',
  ],
};

/**
 * Configuration des matières pour 4ème
 */
export const SUBJECTS_4EME: Record<SubjectType, SubjectConfig> = {
  mathematiques: {
    id: 'mathematiques',
    name: 'mathematics',
    nameFr: 'Mathématiques',
    hoursPerWeek: 3.5,
    color: '#3B82F6',
    icon: '📐',
    aiTutoringScore: 10,
    domains: [
      {
        id: 'nombres_calculs',
        name: 'numbers_calculations',
        nameFr: 'Nombres et calculs',
        competencies: [
          'Utiliser les puissances',
          'Calculer avec des nombres rationnels',
          'Développer et factoriser des expressions',
          'Résoudre des équations du premier degré',
        ],
        subdomains: [
          {
            id: 'puissances',
            name: 'powers',
            nameFr: 'Puissances',
            competencies: [
              'Notation puissance',
              'Puissances de 10',
              'Écriture scientifique',
            ],
          },
          {
            id: 'calcul_litteral',
            name: 'literal_calculation',
            nameFr: 'Calcul littéral',
            competencies: [
              'Développer une expression',
              'Factoriser une expression',
              'Identités remarquables (initiation)',
            ],
          },
          {
            id: 'equations',
            name: 'equations',
            nameFr: 'Équations',
            competencies: [
              'Résoudre une équation du premier degré',
              'Mettre en équation un problème',
            ],
          },
        ],
      },
      {
        id: 'geometrie',
        name: 'geometry',
        nameFr: 'Espace et géométrie',
        competencies: [
          'Utiliser le théorème de Pythagore',
          'Utiliser les propriétés des triangles',
          'Calculer avec les volumes',
        ],
        subdomains: [
          {
            id: 'pythagore',
            name: 'pythagoras',
            nameFr: 'Théorème de Pythagore',
            competencies: [
              'Calculer une longueur',
              'Démontrer qu\'un triangle est rectangle',
            ],
          },
          {
            id: 'triangles',
            name: 'triangles',
            nameFr: 'Triangles',
            competencies: [
              'Triangles semblables',
              'Propriété de la droite des milieux',
            ],
          },
          {
            id: 'volumes',
            name: 'volumes',
            nameFr: 'Volumes',
            competencies: [
              'Calculer le volume d\'une pyramide',
              'Calculer le volume d\'un cône',
            ],
          },
        ],
      },
      {
        id: 'fonctions',
        name: 'functions',
        nameFr: 'Fonctions',
        competencies: [
          'Comprendre la notion de fonction',
          'Représenter une fonction linéaire',
          'Calculer des images et antécédents',
        ],
      },
      {
        id: 'statistiques_probabilites',
        name: 'stats_probability',
        nameFr: 'Statistiques et probabilités',
        competencies: [
          'Calculer et interpréter la médiane',
          'Calculer des effectifs et fréquences',
          'Utiliser la notion de probabilité',
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
          'Analyser des œuvres littéraires',
          'Comprendre des textes argumentatifs',
          'Établir des liens entre les textes',
        ],
        subdomains: [
          {
            id: 'litterature',
            name: 'literature',
            nameFr: 'Littérature',
            competencies: [
              'La fiction pour interroger le réel',
              'Dire l\'amour (poésie)',
              'Individu et société (confrontations de valeurs)',
              'La ville, lieu de tous les possibles',
            ],
          },
        ],
      },
      {
        id: 'ecriture',
        name: 'writing',
        nameFr: 'Écriture',
        competencies: [
          'Rédiger des textes argumentatifs',
          'Écrire pour réfléchir et pour apprendre',
          'Faire évoluer son texte',
        ],
      },
      {
        id: 'etude_langue',
        name: 'language_study',
        nameFr: 'Étude de la langue',
        competencies: [
          'Analyser le fonctionnement de la phrase complexe',
          'Maîtriser les accords complexes',
          'Enrichir son lexique',
        ],
        subdomains: [
          {
            id: 'grammaire',
            name: 'grammar',
            nameFr: 'Grammaire',
            competencies: [
              'La phrase complexe',
              'Les subordonnées relatives et conjonctives',
              'Le discours rapporté',
            ],
          },
          {
            id: 'conjugaison',
            name: 'conjugation',
            nameFr: 'Conjugaison',
            competencies: [
              'Le subjonctif présent',
              'Le conditionnel',
              'Concordance des temps',
            ],
          },
        ],
      },
    ],
  },
  physique_chimie: {
    id: 'physique_chimie',
    name: 'physics_chemistry',
    nameFr: 'Physique-Chimie',
    hoursPerWeek: 1.5,
    color: '#F59E0B',
    icon: '⚗️',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'organisation_matiere',
        name: 'matter_organization',
        nameFr: 'Organisation de la matière',
        competencies: [
          'Décrire la constitution de la matière',
          'Modèle moléculaire',
          'Mélanges et corps purs',
        ],
        subdomains: [
          {
            id: 'atomes_molecules',
            name: 'atoms_molecules',
            nameFr: 'Atomes et molécules',
            competencies: [
              'Modèle de l\'atome',
              'Structure des molécules',
              'Formules chimiques',
            ],
          },
        ],
      },
      {
        id: 'transformations_chimiques',
        name: 'chemical_transformations',
        nameFr: 'Transformations chimiques',
        competencies: [
          'Identifier les réactifs et les produits',
          'Écrire et équilibrer une équation',
          'Conservation de la masse',
        ],
      },
      {
        id: 'electricite',
        name: 'electricity',
        nameFr: 'Électricité',
        competencies: [
          'Tension et intensité',
          'Loi d\'Ohm',
          'Puissance électrique',
        ],
        subdomains: [
          {
            id: 'lois_electricite',
            name: 'electricity_laws',
            nameFr: 'Lois de l\'électricité',
            competencies: [
              'Loi d\'Ohm U = R × I',
              'Lois de l\'intensité et de la tension',
            ],
          },
        ],
      },
      {
        id: 'optique',
        name: 'optics',
        nameFr: 'Optique',
        competencies: [
          'Propagation rectiligne de la lumière',
          'Lentilles convergentes',
          'Formation des images',
        ],
      },
    ],
  },
  svt: {
    id: 'svt',
    name: 'life_earth_sciences',
    nameFr: 'SVT',
    hoursPerWeek: 1.5,
    color: '#10B981',
    icon: '🧬',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'vivant_evolution',
        name: 'living_evolution',
        nameFr: 'Le vivant et son évolution',
        competencies: [
          'Expliquer la reproduction sexuée',
          'Relier l\'ADN aux caractères héréditaires',
          'Comprendre la biodiversité',
        ],
        subdomains: [
          {
            id: 'genetique',
            name: 'genetics',
            nameFr: 'Génétique',
            competencies: [
              'ADN et chromosomes',
              'Transmission des caractères',
              'Diversité génétique',
            ],
          },
        ],
      },
      {
        id: 'corps_sante',
        name: 'body_health',
        nameFr: 'Le corps humain et la santé',
        competencies: [
          'Système nerveux et réflexes',
          'La reproduction humaine',
          'Contraception et IST',
        ],
        subdomains: [
          {
            id: 'reproduction',
            name: 'reproduction',
            nameFr: 'Reproduction',
            competencies: [
              'Puberté et caractères sexuels',
              'Cycle menstruel',
              'Fécondation et grossesse',
            ],
          },
        ],
      },
      {
        id: 'planete_terre',
        name: 'planet_earth',
        nameFr: 'La planète Terre',
        competencies: [
          'Risques naturels',
          'Changement climatique',
          'Exploitation des ressources',
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
    icon: '🌍',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'histoire',
        name: 'history',
        nameFr: 'Histoire',
        competencies: [
          'Se repérer dans le temps',
          'Analyser un document historique',
          'Construire un raisonnement historique',
        ],
        subdomains: [
          {
            id: 'xviii_siecle',
            name: 'eighteenth_century',
            nameFr: 'Le XVIIIe siècle',
            competencies: [
              'Les Lumières',
              'La Révolution française',
              'Napoléon et l\'Empire',
            ],
          },
          {
            id: 'xix_siecle',
            name: 'nineteenth_century',
            nameFr: 'Le XIXe siècle',
            competencies: [
              'L\'Europe de la révolution industrielle',
              'Conquêtes et sociétés coloniales',
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
          'Analyser des cartes et documents',
        ],
        subdomains: [
          {
            id: 'mondialisation',
            name: 'globalization',
            nameFr: 'Mondialisation',
            competencies: [
              'Espaces et paysages de l\'urbanisation',
              'Les mobilités humaines transnationales',
              'Mers et océans : un monde maritimisé',
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
    hoursPerWeek: 3,
    color: '#EC4899',
    icon: '🇬🇧',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'comprehension_orale',
        name: 'listening',
        nameFr: 'Écouter et comprendre',
        competencies: [
          'Comprendre des messages oraux élaborés',
          'Identifier les informations principales',
        ],
      },
      {
        id: 'expression_orale',
        name: 'speaking',
        nameFr: 'S\'exprimer oralement',
        competencies: [
          'Présenter et argumenter',
          'Dialoguer sur des sujets variés',
        ],
      },
      {
        id: 'grammaire_lexique',
        name: 'grammar_vocabulary',
        nameFr: 'Grammaire et lexique',
        competencies: [
          'Maîtriser les structures grammaticales',
          'Enrichir son vocabulaire',
        ],
        subdomains: [
          {
            id: 'grammar',
            name: 'grammar',
            nameFr: 'Grammar',
            competencies: [
              'Past Tenses (Simple, Continuous, Perfect)',
              'Comparatives and Superlatives',
              'Relative Clauses',
              'Passive Voice',
            ],
          },
          {
            id: 'vocabulary',
            name: 'vocabulary',
            nameFr: 'Vocabulary',
            competencies: [
              'Travel and holidays',
              'Environment',
              'Media and technology',
            ],
          },
        ],
      },
    ],
  },
};
