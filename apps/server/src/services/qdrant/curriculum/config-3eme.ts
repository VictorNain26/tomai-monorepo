/**
 * Configuration du curriculum 3ème (Cycle 4 - Brevet)
 *
 * Dernière année du collège avec préparation au DNB (Diplôme National du Brevet)
 *
 * @see https://eduscol.education.fr/90/j-enseigne-au-cycle-4
 * @see https://eduscol.education.fr/1525/diplome-national-du-brevet
 */

import type {
  SubjectConfig,
  LevelConfig,
  SubjectType,
} from './types.js';

/**
 * Configuration du niveau 3ème
 */
export const LEVEL_3EME: LevelConfig = {
  niveau: 'troisieme',
  cycle: 'cycle4',
  name: 'troisieme',
  nameFr: 'Troisième',
  ageRange: '14-15 ans',
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
 * Configuration des matières pour 3ème (préparation Brevet)
 */
export const SUBJECTS_3EME: Record<SubjectType, SubjectConfig> = {
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
          'Calculer avec des racines carrées',
          'Résoudre des équations et inéquations',
          'Utiliser le calcul littéral pour résoudre des problèmes',
        ],
        subdomains: [
          {
            id: 'racines_carrees',
            name: 'square_roots',
            nameFr: 'Racines carrées',
            competencies: [
              'Calculer avec des racines carrées',
              'Simplifier une racine carrée',
            ],
          },
          {
            id: 'identites_remarquables',
            name: 'remarkable_identities',
            nameFr: 'Identités remarquables',
            competencies: [
              '(a+b)² = a² + 2ab + b²',
              '(a-b)² = a² - 2ab + b²',
              '(a+b)(a-b) = a² - b²',
            ],
          },
          {
            id: 'systemes_equations',
            name: 'equation_systems',
            nameFr: 'Systèmes d\'équations',
            competencies: [
              'Résoudre un système par substitution',
              'Résoudre un système par combinaison',
            ],
          },
          {
            id: 'inequations',
            name: 'inequalities',
            nameFr: 'Inéquations',
            competencies: [
              'Résoudre une inéquation du premier degré',
              'Représenter les solutions sur une droite',
            ],
          },
        ],
      },
      {
        id: 'geometrie',
        name: 'geometry',
        nameFr: 'Espace et géométrie',
        competencies: [
          'Utiliser le théorème de Thalès',
          'Utiliser la trigonométrie',
          'Calculer avec les vecteurs',
          'Travailler dans un repère',
        ],
        subdomains: [
          {
            id: 'thales',
            name: 'thales',
            nameFr: 'Théorème de Thalès',
            competencies: [
              'Calculer une longueur',
              'Démontrer que des droites sont parallèles',
            ],
          },
          {
            id: 'trigonometrie',
            name: 'trigonometry',
            nameFr: 'Trigonométrie',
            competencies: [
              'Cosinus, sinus, tangente',
              'Calculer un angle ou une longueur',
            ],
          },
          {
            id: 'reperage',
            name: 'coordinates',
            nameFr: 'Repérage',
            competencies: [
              'Coordonnées dans un repère',
              'Calculer des distances',
              'Coordonnées du milieu',
            ],
          },
          {
            id: 'solides',
            name: 'solids',
            nameFr: 'Solides',
            competencies: [
              'Section de solides',
              'Agrandissement et réduction',
            ],
          },
        ],
      },
      {
        id: 'fonctions',
        name: 'functions',
        nameFr: 'Fonctions',
        competencies: [
          'Représenter graphiquement une fonction',
          'Fonction linéaire et affine',
          'Résoudre des problèmes avec des fonctions',
        ],
        subdomains: [
          {
            id: 'fonctions_affines',
            name: 'affine_functions',
            nameFr: 'Fonctions affines',
            competencies: [
              'f(x) = ax + b',
              'Coefficient directeur et ordonnée à l\'origine',
              'Représentation graphique',
            ],
          },
        ],
      },
      {
        id: 'statistiques_probabilites',
        name: 'stats_probability',
        nameFr: 'Statistiques et probabilités',
        competencies: [
          'Calculer et interpréter des indicateurs',
          'Calculer des probabilités',
          'Utiliser un arbre de probabilités',
        ],
        subdomains: [
          {
            id: 'statistiques',
            name: 'statistics',
            nameFr: 'Statistiques',
            competencies: [
              'Moyenne, médiane, étendue',
              'Effectifs et fréquences cumulées',
            ],
          },
          {
            id: 'probabilites',
            name: 'probabilities',
            nameFr: 'Probabilités',
            competencies: [
              'Probabilité d\'un événement',
              'Expériences à plusieurs épreuves',
            ],
          },
        ],
      },
    ],
  },
  francais: {
    id: 'francais',
    name: 'french',
    nameFr: 'Français',
    hoursPerWeek: 4,
    color: '#8B5CF6',
    icon: '📚',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'lecture_comprehension',
        name: 'reading_comprehension',
        nameFr: 'Lecture et compréhension',
        competencies: [
          'Analyser des œuvres littéraires complexes',
          'Mettre en relation des textes',
          'Interpréter et apprécier des œuvres',
        ],
        subdomains: [
          {
            id: 'litterature',
            name: 'literature',
            nameFr: 'Littérature',
            competencies: [
              'Se raconter, se représenter (autobiographie)',
              'Dénoncer les travers de la société',
              'Visions poétiques du monde',
              'Agir dans la cité (littérature engagée)',
            ],
          },
        ],
      },
      {
        id: 'ecriture',
        name: 'writing',
        nameFr: 'Écriture',
        competencies: [
          'Rédiger des textes élaborés (brevet)',
          'Argumenter de façon structurée',
          'Adopter des stratégies d\'écriture efficaces',
        ],
        subdomains: [
          {
            id: 'redaction_brevet',
            name: 'brevet_writing',
            nameFr: 'Rédaction Brevet',
            competencies: [
              'Sujet d\'imagination',
              'Sujet de réflexion',
              'Dictée et réécriture',
            ],
          },
        ],
      },
      {
        id: 'etude_langue',
        name: 'language_study',
        nameFr: 'Étude de la langue',
        competencies: [
          'Maîtriser la syntaxe complexe',
          'Consolider l\'orthographe',
          'Enrichir le lexique',
        ],
        subdomains: [
          {
            id: 'grammaire',
            name: 'grammar',
            nameFr: 'Grammaire',
            competencies: [
              'Propositions subordonnées',
              'Voix active et passive',
              'Discours direct et indirect',
            ],
          },
          {
            id: 'conjugaison',
            name: 'conjugation',
            nameFr: 'Conjugaison',
            competencies: [
              'Tous les temps de l\'indicatif',
              'Subjonctif présent et passé',
              'Conditionnel présent et passé',
            ],
          },
          {
            id: 'orthographe',
            name: 'spelling',
            nameFr: 'Orthographe',
            competencies: [
              'Accords complexes',
              'Homophones',
              'Dictée du brevet',
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
          'Décrire l\'organisation de la matière',
          'Modèle de l\'atome',
          'Ions et solutions ioniques',
        ],
        subdomains: [
          {
            id: 'structure_atome',
            name: 'atom_structure',
            nameFr: 'Structure de l\'atome',
            competencies: [
              'Protons, neutrons, électrons',
              'Numéro atomique et masse',
              'Couches électroniques',
            ],
          },
          {
            id: 'ions',
            name: 'ions',
            nameFr: 'Ions et solutions',
            competencies: [
              'Formation des ions',
              'Solutions ioniques',
              'Réactions acido-basiques',
            ],
          },
        ],
      },
      {
        id: 'transformations_chimiques',
        name: 'chemical_transformations',
        nameFr: 'Transformations chimiques',
        competencies: [
          'Équilibrer des équations chimiques',
          'Calculer des quantités de matière',
          'Synthèse d\'espèces chimiques',
        ],
      },
      {
        id: 'energie',
        name: 'energy',
        nameFr: 'Énergie et conversions',
        competencies: [
          'Formes et transferts d\'énergie',
          'Conservation de l\'énergie',
          'Énergie cinétique et potentielle',
        ],
        subdomains: [
          {
            id: 'energie_cinetique',
            name: 'kinetic_energy',
            nameFr: 'Énergie cinétique',
            competencies: [
              'Ec = ½mv²',
              'Sécurité routière',
            ],
          },
        ],
      },
      {
        id: 'mouvement_forces',
        name: 'motion_forces',
        nameFr: 'Mouvement et forces',
        competencies: [
          'Décrire un mouvement',
          'Modéliser une force',
          'Principe d\'inertie',
        ],
        subdomains: [
          {
            id: 'forces',
            name: 'forces',
            nameFr: 'Forces',
            competencies: [
              'Poids et masse',
              'Action réciproque',
              'Équilibre des forces',
            ],
          },
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
          'Comprendre la biodiversité',
          'Expliquer l\'évolution des espèces',
          'Comprendre la sélection naturelle',
        ],
        subdomains: [
          {
            id: 'evolution',
            name: 'evolution',
            nameFr: 'Évolution',
            competencies: [
              'Sélection naturelle',
              'Biodiversité et évolution',
              'Parenté des espèces',
            ],
          },
          {
            id: 'genetique',
            name: 'genetics',
            nameFr: 'Génétique',
            competencies: [
              'Mutations',
              'Diversité allélique',
              'Innovations génétiques',
            ],
          },
        ],
      },
      {
        id: 'corps_sante',
        name: 'body_health',
        nameFr: 'Le corps humain et la santé',
        competencies: [
          'Comprendre le système immunitaire',
          'Comprendre les effets des micro-organismes',
          'Responsabilité individuelle et collective',
        ],
        subdomains: [
          {
            id: 'immunite',
            name: 'immunity',
            nameFr: 'Immunité',
            competencies: [
              'Réactions immunitaires',
              'Vaccination',
              'Antibiotiques et résistance',
            ],
          },
        ],
      },
      {
        id: 'planete_terre',
        name: 'planet_earth',
        nameFr: 'La planète Terre',
        competencies: [
          'Comprendre le climat',
          'Expliquer les risques naturels',
          'Ressources et développement durable',
        ],
        subdomains: [
          {
            id: 'climat',
            name: 'climate',
            nameFr: 'Climat',
            competencies: [
              'Effet de serre',
              'Changement climatique',
              'Actions humaines',
            ],
          },
        ],
      },
    ],
  },
  histoire_geo: {
    id: 'histoire_geo',
    name: 'history_geography',
    nameFr: 'Histoire-Géographie-EMC',
    hoursPerWeek: 3.5,
    color: '#EF4444',
    icon: '🌍',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'histoire',
        name: 'history',
        nameFr: 'Histoire',
        competencies: [
          'Analyser des documents historiques',
          'Construire un récit historique',
          'Maîtriser les repères chronologiques',
        ],
        subdomains: [
          {
            id: 'guerres_mondiales',
            name: 'world_wars',
            nameFr: 'Guerres mondiales',
            competencies: [
              'La Première Guerre mondiale',
              'La Seconde Guerre mondiale',
              'Génocides du XXe siècle',
            ],
          },
          {
            id: 'totalitarismes',
            name: 'totalitarianisms',
            nameFr: 'Totalitarismes',
            competencies: [
              'Régimes totalitaires',
              'Démocraties fragilisées',
            ],
          },
          {
            id: 'france_republique',
            name: 'french_republic',
            nameFr: 'France et République',
            competencies: [
              'La République de l\'entre-deux-guerres',
              'La France défaite et occupée',
              'La Ve République',
            ],
          },
          {
            id: 'monde_apres_1945',
            name: 'world_after_1945',
            nameFr: 'Le monde après 1945',
            competencies: [
              'Guerre froide',
              'Décolonisation',
              'Construction européenne',
            ],
          },
        ],
      },
      {
        id: 'geographie',
        name: 'geography',
        nameFr: 'Géographie',
        competencies: [
          'Analyser des documents géographiques',
          'Réaliser un croquis',
        ],
        subdomains: [
          {
            id: 'france_ue',
            name: 'france_eu',
            nameFr: 'France et Union européenne',
            competencies: [
              'Les aires urbaines françaises',
              'Les espaces productifs français',
              'La France et l\'Europe dans le monde',
            ],
          },
        ],
      },
      {
        id: 'emc',
        name: 'civic_education',
        nameFr: 'EMC',
        competencies: [
          'Comprendre les valeurs de la République',
          'Exercer sa citoyenneté',
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
          'Comprendre des messages oraux complexes',
          'Identifier des points de vue',
        ],
      },
      {
        id: 'expression_orale',
        name: 'speaking',
        nameFr: 'S\'exprimer oralement',
        competencies: [
          'Présenter des idées de façon argumentée',
          'Participer à une conversation',
        ],
      },
      {
        id: 'comprehension_ecrite',
        name: 'reading',
        nameFr: 'Lire et comprendre',
        competencies: [
          'Comprendre des textes variés',
          'Repérer les informations essentielles',
        ],
      },
      {
        id: 'expression_ecrite',
        name: 'writing',
        nameFr: 'Écrire',
        competencies: [
          'Rédiger des textes élaborés',
          'Argumenter par écrit',
        ],
      },
      {
        id: 'grammaire_lexique',
        name: 'grammar_vocabulary',
        nameFr: 'Grammaire et lexique',
        competencies: [
          'Maîtriser les structures complexes',
          'Utiliser un vocabulaire varié',
        ],
        subdomains: [
          {
            id: 'grammar',
            name: 'grammar',
            nameFr: 'Grammar',
            competencies: [
              'All tenses review',
              'Conditionals (0, 1, 2, 3)',
              'Reported speech',
              'Passive voice in all tenses',
              'Modal verbs for deduction',
            ],
          },
          {
            id: 'vocabulary',
            name: 'vocabulary',
            nameFr: 'Vocabulary',
            competencies: [
              'Work and careers',
              'Social issues',
              'Science and technology',
              'Arts and culture',
            ],
          },
        ],
      },
    ],
  },
};
