/**
 * Gemini Tool Declarations - Agent multi-tool TomAI
 *
 * 7 outils disponibles pour l'agent:
 * 1. search_educational_content - RAG Eduscol
 * 2. get_student_homework - Devoirs Pronote
 * 3. get_student_grades - Notes Pronote
 * 4. get_student_timetable - EDT Pronote
 * 5. generate_flashcards - Generation de cartes
 * 6. get_student_profile - Profil cognitif
 * 7. get_app_help - Guide d'utilisation de l'app
 */

import type { FunctionDeclaration } from '@google/genai';

export const searchEducationalContentDeclaration: FunctionDeclaration = {
  name: 'search_educational_content',
  description: `Recherche dans les programmes officiels français (Éduscol). Retourne des extraits avec source et pertinence. Intègre les résultats dans ta réponse sans citer Éduscol. Ne l'utilise pas pour salutations, Pronote, ou si tu as déjà le contexte d'un appel précédent.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Reformule la question de manière précise pour la recherche. Ex: "théorème de Pythagore démonstration" au lieu de "aide moi avec mon exo de maths"'
      },
      niveau: {
        type: 'string',
        enum: [
          'cp', 'ce1', 'ce2', 'cm1', 'cm2',
          'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
          'seconde', 'premiere', 'terminale'
        ],
        description: "Le niveau scolaire de l'élève (fourni dans le contexte)"
      },
      matiere: {
        type: 'string',
        description: 'La matière normalisée: mathematiques, francais, anglais, espagnol, allemand, histoire, geographie, physique-chimie, svt, technologie, ses, philosophie, nsi'
      },
      limit: {
        type: 'number',
        description: 'Nombre de résultats (3 pour question précise, 5 par défaut, 8 pour sujet large)'
      }
    },
    required: ['query', 'niveau', 'matiere']
  }
};

export const getStudentHomeworkDeclaration: FunctionDeclaration = {
  name: 'get_student_homework',
  description: `Consulte les devoirs de l'élève depuis Pronote. Retourne matière, description, date limite, statut (fait/pas fait).`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      weekOffset: {
        type: 'number',
        description: 'Décalage de semaine: 0 = semaine courante, 1 = semaine prochaine, -1 = semaine dernière. Défaut: 0.'
      }
    },
    required: []
  }
};

export const getStudentGradesDeclaration: FunctionDeclaration = {
  name: 'get_student_grades',
  description: `Consulte les notes de l'élève depuis Pronote. Retourne matière, valeur, barème, coefficient, moyenne de classe, commentaire.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export const getStudentTimetableDeclaration: FunctionDeclaration = {
  name: 'get_student_timetable',
  description: `Consulte l'emploi du temps de l'élève depuis Pronote. Retourne matière, horaires, salle, professeur, statut (annulé ou non).`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      weekOffset: {
        type: 'number',
        description: 'Décalage de semaine: 0 = semaine courante, 1 = semaine prochaine, -1 = semaine dernière. Défaut: 0.'
      }
    },
    required: []
  }
};

export const generateFlashcardsDeclaration: FunctionDeclaration = {
  name: 'generate_flashcards',
  description: `Génère des cartes de révision (flashcards, QCM, vrai/faux) sur un sujet. TOUJOURS demander confirmation avant de générer ("Veux-tu que je crée des cartes ?").`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Le sujet précis des cartes. Ex: "théorème de Pythagore", "conjugaison du passé composé"'
      },
      subject: {
        type: 'string',
        description: 'La matière: mathematiques, francais, anglais, espagnol, allemand, histoire, geographie, physique-chimie, svt, technologie, ses, philosophie, nsi'
      },
      cardCount: {
        type: 'number',
        description: 'Nombre de cartes à générer (5 par défaut, 3 minimum, 10 maximum)'
      }
    },
    required: ['topic', 'subject']
  }
};

export const getStudentProfileDeclaration: FunctionDeclaration = {
  name: 'get_student_profile',
  description: `Consulte le profil cognitif de l'élève (forces, faiblesses, style d'apprentissage). Appelle-le en début de conversation pour personnaliser ton approche.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export const getAppHelpDeclaration: FunctionDeclaration = {
  name: 'get_app_help',
  description: `Guide d'utilisation de l'application Tom. OBLIGATOIRE pour toute question sur l'app (navigation, fonctionnalités, Pronote, abonnement). Ne réponds JAMAIS aux questions sur l'app sans consulter cet outil.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: [
          'overview', 'navigation', 'chat', 'flashcards',
          'pronote', 'files', 'subscription', 'profile'
        ],
        description: 'Le sujet de la question: overview (vue générale), navigation (onglets), chat (conversation), flashcards (révision), pronote (connexion/données), files (fichiers/photos), subscription (abonnement), profile (paramètres)'
      }
    },
    required: ['topic']
  }
};

/** All tool declarations for the Gemini agent */
export const agentToolDeclarations: FunctionDeclaration[] = [
  searchEducationalContentDeclaration,
  getStudentHomeworkDeclaration,
  getStudentGradesDeclaration,
  getStudentTimetableDeclaration,
  generateFlashcardsDeclaration,
  getStudentProfileDeclaration,
  getAppHelpDeclaration,
];
