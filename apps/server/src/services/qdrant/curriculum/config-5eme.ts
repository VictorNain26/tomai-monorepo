/**
 * Configuration du curriculum 5ème (Cycle 4)
 *
 * Matières sélectionnées pour leur efficacité avec le tutorat IA:
 * - Mathématiques (score IA: 10/10)
 * - Français (score IA: 9/10)
 * - Physique-Chimie (score IA: 9/10)
 * - SVT (score IA: 8/10)
 * - Histoire-Géographie (score IA: 8/10)
 * - Anglais LV1 (score IA: 9/10)
 *
 * @see https://eduscol.education.fr/90/j-enseigne-au-cycle-4
 * @see https://www.education.gouv.fr/les-programmes-du-college-3203
 */

import type {
  SubjectConfig,
  LevelConfig,
  SubjectType,
  ChunkingOptions,
} from './types.js';

/**
 * Configuration du niveau 5ème
 */
export const LEVEL_5EME: LevelConfig = {
  niveau: 'cinquieme',
  cycle: 'cycle4',
  name: 'cinquieme',
  nameFr: 'Cinquième',
  ageRange: '12-13 ans',
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
 * Configuration des matières pour 5ème
 */
export const SUBJECTS_5EME: Record<SubjectType, SubjectConfig> = {
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
          'Utiliser les nombres pour comparer, calculer et résoudre des problèmes',
          'Comprendre et utiliser les notions de divisibilité',
          'Utiliser le calcul littéral',
        ],
        subdomains: [
          {
            id: 'fractions',
            name: 'fractions',
            nameFr: 'Fractions',
            competencies: [
              'Comparer des fractions',
              'Additionner et soustraire des fractions',
              'Multiplier des fractions',
            ],
          },
          {
            id: 'nombres_relatifs',
            name: 'relative_numbers',
            nameFr: 'Nombres relatifs',
            competencies: [
              'Repérer sur une droite graduée',
              'Additionner et soustraire des nombres relatifs',
            ],
          },
          {
            id: 'calcul_litteral',
            name: 'literal_calculation',
            nameFr: 'Calcul littéral',
            competencies: [
              'Utiliser une lettre pour exprimer une généralité',
              'Produire une expression littérale',
              'Tester une égalité',
            ],
          },
        ],
      },
      {
        id: 'geometrie',
        name: 'geometry',
        nameFr: 'Espace et géométrie',
        competencies: [
          'Représenter l\'espace',
          'Utiliser les notions de géométrie plane pour démontrer',
        ],
        subdomains: [
          {
            id: 'symetrie',
            name: 'symmetry',
            nameFr: 'Symétrie',
            competencies: [
              'Construire le symétrique d\'un point, d\'une figure',
              'Caractériser les symétries axiale et centrale',
            ],
          },
          {
            id: 'parallelisme_perpendicularite',
            name: 'parallelism_perpendicularity',
            nameFr: 'Parallélisme et perpendicularité',
            competencies: [
              'Utiliser les propriétés des droites parallèles et perpendiculaires',
              'Démontrer que des droites sont parallèles ou perpendiculaires',
            ],
          },
          {
            id: 'triangles',
            name: 'triangles',
            nameFr: 'Triangles',
            competencies: [
              'Connaître et utiliser les propriétés relatives aux angles d\'un triangle',
              'Construire un triangle connaissant certains éléments',
            ],
          },
        ],
      },
      {
        id: 'grandeurs_mesures',
        name: 'quantities_measurements',
        nameFr: 'Grandeurs et mesures',
        competencies: [
          'Calculer avec des grandeurs mesurables',
          'Comprendre l\'effet de certaines transformations sur les grandeurs',
        ],
        subdomains: [
          {
            id: 'aires_perimetres',
            name: 'areas_perimeters',
            nameFr: 'Aires et périmètres',
            competencies: [
              'Calculer l\'aire d\'un parallélogramme, d\'un triangle',
              'Calculer le périmètre et l\'aire d\'un disque',
            ],
          },
          {
            id: 'volumes',
            name: 'volumes',
            nameFr: 'Volumes',
            competencies: [
              'Calculer le volume d\'un prisme droit, d\'un cylindre',
            ],
          },
        ],
      },
      {
        id: 'proportionnalite',
        name: 'proportionality',
        nameFr: 'Organisation et gestion de données',
        competencies: [
          'Résoudre des problèmes de proportionnalité',
          'Utiliser les pourcentages',
          'Interpréter des données statistiques',
        ],
      },
    ],
  },

  francais: {
    id: 'francais',
    name: 'french',
    nameFr: 'Français',
    hoursPerWeek: 4.5,
    color: '#EF4444',
    icon: '📚',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'langage_oral',
        name: 'oral_language',
        nameFr: 'Langage oral',
        competencies: [
          'Comprendre et interpréter des messages oraux',
          'S\'exprimer de façon maîtrisée en s\'adressant à un auditoire',
          'Participer de façon constructive à des échanges oraux',
        ],
      },
      {
        id: 'lecture_comprehension',
        name: 'reading_comprehension',
        nameFr: 'Lecture et compréhension de l\'écrit',
        competencies: [
          'Lire des textes variés avec des objectifs divers',
          'Devenir un lecteur autonome',
        ],
        subdomains: [
          {
            id: 'litterature',
            name: 'literature',
            nameFr: 'Littérature',
            competencies: [
              'Héros, héroïnes et héroïsme',
              'L\'être humain est-il maître de la nature ?',
              'Avec autrui : familles, amis, réseaux',
            ],
          },
        ],
      },
      {
        id: 'ecriture',
        name: 'writing',
        nameFr: 'Écriture',
        competencies: [
          'Écrire des textes variés',
          'Adopter des stratégies d\'écriture efficaces',
        ],
        subdomains: [
          {
            id: 'recit',
            name: 'narrative',
            nameFr: 'Le récit',
            competencies: [
              'Écrire un récit complexe',
              'Utiliser les temps du récit',
            ],
          },
          {
            id: 'argumentation',
            name: 'argumentation',
            nameFr: 'L\'argumentation',
            competencies: [
              'Rédiger un texte argumentatif simple',
              'Exprimer et justifier un point de vue',
            ],
          },
        ],
      },
      {
        id: 'etude_langue',
        name: 'language_study',
        nameFr: 'Étude de la langue',
        competencies: [
          'Maîtriser la structure, le sens et l\'orthographe des mots',
          'Maîtriser le fonctionnement du verbe',
          'Maîtriser la structure de la phrase complexe',
        ],
        subdomains: [
          {
            id: 'grammaire',
            name: 'grammar',
            nameFr: 'Grammaire',
            competencies: [
              'Les classes grammaticales',
              'Les fonctions dans la phrase',
              'La phrase complexe',
            ],
          },
          {
            id: 'conjugaison',
            name: 'conjugation',
            nameFr: 'Conjugaison',
            competencies: [
              'Les temps de l\'indicatif',
              'Le subjonctif présent',
              'Le conditionnel présent',
            ],
          },
          {
            id: 'orthographe',
            name: 'spelling',
            nameFr: 'Orthographe',
            competencies: [
              'Les accords dans le groupe nominal',
              'L\'accord sujet-verbe',
              'Les homophones grammaticaux',
            ],
          },
          {
            id: 'lexique',
            name: 'vocabulary',
            nameFr: 'Lexique',
            competencies: [
              'La formation des mots',
              'Les relations de sens entre les mots',
              'Le sens des mots selon le contexte',
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
    color: '#8B5CF6',
    icon: '⚗️',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'organisation_matiere',
        name: 'matter_organization',
        nameFr: 'Organisation et transformations de la matière',
        competencies: [
          'Décrire la constitution et les états de la matière',
          'Décrire et expliquer des transformations chimiques',
        ],
        subdomains: [
          {
            id: 'etats_matiere',
            name: 'states_of_matter',
            nameFr: 'États de la matière',
            competencies: [
              'Les trois états de la matière',
              'Les changements d\'état',
              'La conservation de la masse',
            ],
          },
          {
            id: 'melanges',
            name: 'mixtures',
            nameFr: 'Mélanges et corps purs',
            competencies: [
              'Distinguer corps pur et mélange',
              'Techniques de séparation des mélanges',
              'La solubilité',
            ],
          },
        ],
      },
      {
        id: 'mouvements_interactions',
        name: 'movements_interactions',
        nameFr: 'Mouvement et interactions',
        competencies: [
          'Caractériser un mouvement',
          'Modéliser une interaction par une force',
        ],
        subdomains: [
          {
            id: 'description_mouvement',
            name: 'movement_description',
            nameFr: 'Description d\'un mouvement',
            competencies: [
              'Trajectoire et vitesse',
              'Relativité du mouvement',
            ],
          },
        ],
      },
      {
        id: 'energie_conversions',
        name: 'energy_conversions',
        nameFr: 'L\'énergie et ses conversions',
        competencies: [
          'Identifier les différentes formes d\'énergie',
          'Établir un bilan énergétique pour un système simple',
        ],
        subdomains: [
          {
            id: 'formes_energie',
            name: 'energy_forms',
            nameFr: 'Formes d\'énergie',
            competencies: [
              'Énergie cinétique, potentielle, thermique',
              'Conservation de l\'énergie',
            ],
          },
          {
            id: 'circuits_electriques',
            name: 'electrical_circuits',
            nameFr: 'Circuits électriques',
            competencies: [
              'Circuit en série et en dérivation',
              'Tension et intensité',
            ],
          },
        ],
      },
      {
        id: 'signaux_information',
        name: 'signals_information',
        nameFr: 'Des signaux pour observer et communiquer',
        competencies: [
          'Caractériser différents types de signaux',
        ],
        subdomains: [
          {
            id: 'signaux_lumineux',
            name: 'light_signals',
            nameFr: 'Signaux lumineux',
            competencies: [
              'La lumière blanche et les couleurs',
              'Propagation rectiligne de la lumière',
            ],
          },
        ],
      },
    ],
  },

  svt: {
    id: 'svt',
    name: 'life_earth_sciences',
    nameFr: 'Sciences de la Vie et de la Terre',
    hoursPerWeek: 1.5,
    color: '#10B981',
    icon: '🌿',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'vivant_evolution',
        name: 'living_evolution',
        nameFr: 'Le vivant et son évolution',
        competencies: [
          'Expliquer l\'organisation du monde vivant, sa structure et son dynamisme',
          'Relier des éléments de biologie à différentes échelles',
        ],
        subdomains: [
          {
            id: 'nutrition_organismes',
            name: 'organism_nutrition',
            nameFr: 'Nutrition des organismes',
            competencies: [
              'Besoins nutritifs des êtres vivants',
              'La respiration',
              'L\'approvisionnement en nutriments',
            ],
          },
          {
            id: 'reproduction',
            name: 'reproduction',
            nameFr: 'Reproduction',
            competencies: [
              'Reproduction sexuée et asexuée',
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
          'Expliquer quelques processus biologiques impliqués dans le fonctionnement du corps',
          'Relier la connaissance de ces processus à la santé',
        ],
        subdomains: [
          {
            id: 'digestion',
            name: 'digestion',
            nameFr: 'Digestion',
            competencies: [
              'Transformation des aliments',
              'Absorption intestinale',
            ],
          },
          {
            id: 'respiration_circulation',
            name: 'respiration_circulation',
            nameFr: 'Respiration et circulation',
            competencies: [
              'L\'appareil respiratoire',
              'La circulation sanguine',
            ],
          },
        ],
      },
      {
        id: 'planete_terre',
        name: 'planet_earth',
        nameFr: 'La planète Terre, l\'environnement et l\'action humaine',
        competencies: [
          'Explorer et expliquer certains phénomènes géologiques',
          'Comprendre les responsabilités humaines',
        ],
        subdomains: [
          {
            id: 'phenomenes_geologiques',
            name: 'geological_phenomena',
            nameFr: 'Phénomènes géologiques',
            competencies: [
              'Séismes et volcans',
              'Structure interne de la Terre',
            ],
          },
          {
            id: 'ecosystemes',
            name: 'ecosystems',
            nameFr: 'Écosystèmes',
            competencies: [
              'Les interactions dans un écosystème',
              'L\'impact de l\'Homme sur les écosystèmes',
            ],
          },
        ],
      },
    ],
  },

  histoire_geo: {
    id: 'histoire_geo',
    name: 'history_geography',
    nameFr: 'Histoire-Géographie',
    hoursPerWeek: 3,
    color: '#F59E0B',
    icon: '🗺️',
    aiTutoringScore: 8,
    domains: [
      {
        id: 'histoire',
        name: 'history',
        nameFr: 'Histoire',
        competencies: [
          'Se repérer dans le temps : construire des repères historiques',
          'Raisonner, justifier une démarche et les choix effectués',
          'Analyser et comprendre un document',
        ],
        subdomains: [
          {
            id: 'moyen_age',
            name: 'middle_ages',
            nameFr: 'Le Moyen Âge',
            competencies: [
              'Byzance et l\'Europe carolingienne',
              'De la naissance de l\'Islam à la prise de Bagdad',
              'L\'ordre seigneurial',
              'L\'émergence d\'une nouvelle société urbaine',
              'L\'affirmation de l\'État monarchique',
            ],
          },
        ],
      },
      {
        id: 'geographie',
        name: 'geography',
        nameFr: 'Géographie',
        competencies: [
          'Se repérer dans l\'espace : construire des repères géographiques',
          'Pratiquer différents langages en géographie',
        ],
        subdomains: [
          {
            id: 'demographie_developpement',
            name: 'demography_development',
            nameFr: 'La question démographique et l\'inégal développement',
            competencies: [
              'La croissance démographique et ses effets',
              'Répartition de la richesse et de la pauvreté dans le monde',
            ],
          },
          {
            id: 'ressources',
            name: 'resources',
            nameFr: 'Des ressources limitées, à gérer et à renouveler',
            competencies: [
              'L\'énergie, ressources à ménager',
              'L\'alimentation : comment nourrir une humanité en croissance',
            ],
          },
          {
            id: 'environnement',
            name: 'environment',
            nameFr: 'Prévenir les risques, s\'adapter au changement global',
            competencies: [
              'Le changement global et ses principaux effets',
              'Prévenir les risques industriels et technologiques',
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
    color: '#DC2626',
    icon: '🇬🇧',
    aiTutoringScore: 9,
    domains: [
      {
        id: 'comprehension_orale',
        name: 'listening',
        nameFr: 'Compréhension de l\'oral',
        competencies: [
          'Comprendre des messages oraux simples et courts',
          'Comprendre les points essentiels d\'un message oral',
        ],
      },
      {
        id: 'expression_orale',
        name: 'speaking',
        nameFr: 'Expression orale',
        competencies: [
          'S\'exprimer oralement en continu',
          'Prendre part à une conversation',
        ],
      },
      {
        id: 'comprehension_ecrite',
        name: 'reading',
        nameFr: 'Compréhension de l\'écrit',
        competencies: [
          'Comprendre des textes courts et simples',
          'Identifier le sujet d\'un document',
        ],
      },
      {
        id: 'expression_ecrite',
        name: 'writing',
        nameFr: 'Expression écrite',
        competencies: [
          'Écrire des textes courts et simples',
          'Rendre compte de faits',
        ],
      },
      {
        id: 'grammaire_lexique',
        name: 'grammar_vocabulary',
        nameFr: 'Grammaire et lexique',
        competencies: [
          'Connaître et utiliser les structures grammaticales',
          'Maîtriser le lexique approprié',
        ],
        subdomains: [
          {
            id: 'grammar',
            name: 'grammar',
            nameFr: 'Grammaire',
            competencies: [
              'Present simple et present continuous',
              'Past simple et past continuous',
              'Les modaux (can, must, should)',
              'Le comparatif et le superlatif',
              'Les pronoms relatifs',
            ],
          },
          {
            id: 'vocabulary',
            name: 'vocabulary',
            nameFr: 'Vocabulaire thématique',
            competencies: [
              'La vie quotidienne',
              'L\'école et les études',
              'Les loisirs et le sport',
              'Les voyages et les pays',
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Options de chunking optimisées
 * Basées sur les best practices 2025 (NVIDIA benchmark)
 *
 * @see https://arxiv.org/abs/2407.01219
 */
export const CHUNKING_OPTIONS: ChunkingOptions = {
  maxTokens: 512, // Optimal pour retrieval (400-512 range)
  minTokens: 100, // Évite chunks trop petits
  overlapPercent: 15, // 15% overlap (NVIDIA recommendation)
  preserveSentences: true, // Respecte les limites de phrases
  contextWindow: 128, // Tokens de contexte pour enrichissement
};

/**
 * Toutes les matières actives pour 5ème
 */
export const ACTIVE_SUBJECTS_5EME: SubjectType[] = LEVEL_5EME.subjects;

/**
 * Get subject configuration by ID
 */
export function getSubjectConfig(subject: SubjectType): SubjectConfig {
  return SUBJECTS_5EME[subject];
}

/**
 * Get all active subject configurations
 */
export function getAllSubjectConfigs(): SubjectConfig[] {
  return ACTIVE_SUBJECTS_5EME.map((s) => SUBJECTS_5EME[s]);
}
