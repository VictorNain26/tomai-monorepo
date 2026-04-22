/**
 * Gemini Tool Declarations - Agent multi-tool TomAI
 *
 * 4 outils disponibles pour l'agent:
 * 1. search_educational_content - RAG Eduscol
 * 2. generate_flashcards - Generation de cartes
 * 3. get_student_profile - Profil cognitif
 * 4. get_app_help - Guide d'utilisation de l'app
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

export const updateStudentProfileDeclaration: FunctionDeclaration = {
  name: 'update_student_profile',
  description: `Enregistre une observation pédagogique dans le profil cognitif de l'élève (force, faiblesse, style observé). À n'appeler que lorsqu'une observation est NOUVELLE, FACTUELLE et PERTINENTE sur plusieurs tours — pas à chaque message. Une observation au plus par réponse.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      observation: {
        type: 'string',
        description: 'Une phrase factuelle sur ce que l\'élève sait faire ou sur sa difficulté. Ex: "Confond les verbes du 1er et 2nd groupe au passé composé." (max 250 caractères)'
      },
      subject: {
        type: 'string',
        description: 'La matière concernée (mathematiques, francais, histoire, etc.)'
      },
      strength: {
        type: 'string',
        description: 'Ajoute une force au profil si l\'élève démontre une maîtrise claire sur un point (ex: "Bonne compréhension du théorème de Pythagore"). Max 100 caractères.'
      },
      weakness: {
        type: 'string',
        description: 'Ajoute une faiblesse au profil si l\'élève bute de façon récurrente sur un point (ex: "Oublie la retenue en addition posée"). Max 100 caractères.'
      },
      preferredStyle: {
        type: 'string',
        enum: ['visuel', 'auditif', 'kinesthesique', 'lecture-ecriture', 'mixte'],
        description: 'Style d\'apprentissage observé. À ne renseigner qu\'après plusieurs indices clairs.'
      }
    },
    required: ['observation', 'subject']
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
  generateFlashcardsDeclaration,
  getStudentProfileDeclaration,
  updateStudentProfileDeclaration,
  getAppHelpDeclaration,
];
