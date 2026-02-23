/**
 * Gemini Tool Declarations - Agent multi-tool TomAI
 *
 * 6 outils disponibles pour l'agent:
 * 1. search_educational_content - RAG Eduscol
 * 2. get_student_homework - Devoirs Pronote
 * 3. get_student_grades - Notes Pronote
 * 4. get_student_timetable - EDT Pronote
 * 5. generate_flashcards - Generation de cartes
 * 6. get_student_profile - Profil cognitif
 */

import type { FunctionDeclaration } from '@google/genai';

export const searchEducationalContentDeclaration: FunctionDeclaration = {
  name: 'search_educational_content',
  description: `OBLIGATOIRE pour toute question scolaire. Recherche dans les programmes officiels français (Éduscol).
Tu DOIS appeler cet outil AVANT de répondre à toute question liée au programme scolaire.
Retourne des extraits des programmes officiels avec leur source et pertinence.

QUAND L'UTILISER (OBLIGATOIRE):
- Dès qu'un élève pose une question sur un cours, un exercice, ou un concept scolaire.
- Pour vérifier qu'une explication est conforme au programme officiel de son niveau.
- Pour trouver des définitions, théorèmes ou méthodes du programme.
- Pour toute demande d'aide sur un devoir ou exercice.
- Pour toute révision ou explication de notion.

QUAND NE PAS L'UTILISER:
- Salutations, questions personnelles, demandes hors-scolaire.
- Questions purement sur Pronote (emploi du temps, notes) sans contenu pédagogique.
- Si tu as déjà le contexte nécessaire d'un appel précédent dans cette conversation.

COMMENT INTÉGRER LES RÉSULTATS:
- Utilise les informations pour structurer ta réponse pédagogique.
- Ne cite jamais la source (Éduscol, programme officiel) à l'élève.
- Adapte le contenu officiel au niveau de l'élève.`,
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
  description: `Consulte les devoirs de l'élève depuis Pronote.
Retourne la liste des devoirs avec matière, description, date limite, et statut (fait/pas fait).

QUAND L'UTILISER:
- Quand l'élève demande ses devoirs, son travail à faire, ou mentionne un devoir.
- Quand l'élève dit "qu'est-ce que j'ai à faire ?" ou "quels sont mes devoirs ?".
- Pour contextualiser une aide sur un exercice spécifique mentionné dans ses devoirs.

QUAND NE PAS L'UTILISER:
- Pour des questions générales sur un cours sans mention de devoirs.
- Si l'élève n'a pas Pronote connecté (tu le sais si l'outil retourne une erreur).`,
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
  description: `Consulte les notes de l'élève depuis Pronote.
Retourne les notes avec matière, valeur, barème, coefficient, moyenne de classe, et commentaire.

QUAND L'UTILISER:
- Quand l'élève parle de ses notes, d'un contrôle, d'une évaluation.
- Quand l'élève dit "comment j'ai eu ?" ou "quelles sont mes notes ?".
- Pour identifier les matières où l'élève a besoin d'aide (notes basses).

QUAND NE PAS L'UTILISER:
- Pour des questions générales sans mention de notes ou évaluations.
- Si l'élève n'a pas Pronote connecté.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export const getStudentTimetableDeclaration: FunctionDeclaration = {
  name: 'get_student_timetable',
  description: `Consulte l'emploi du temps de l'élève depuis Pronote.
Retourne les cours avec matière, horaires, salle, professeur, et statut (annulé ou non).

QUAND L'UTILISER:
- Quand l'élève demande son emploi du temps, ses cours de demain, ou un horaire.
- Quand l'élève dit "j'ai quoi demain ?" ou "à quelle heure est mon cours de maths ?".

QUAND NE PAS L'UTILISER:
- Pour des questions sur le contenu d'un cours (utilise search_educational_content).
- Si l'élève n'a pas Pronote connecté.`,
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
  description: `Génère des cartes de révision (flashcards, QCM, vrai/faux, etc.) sur un sujet donné.
Les cartes sont créées dans un deck et sauvegardées pour révision ultérieure.

QUAND L'UTILISER:
- Quand l'élève demande de réviser, de s'entraîner, ou de créer des flashcards.
- Quand l'élève dit "fais-moi des cartes sur..." ou "je veux m'entraîner sur...".
- Après avoir identifié une faiblesse dans les notes Pronote.

QUAND NE PAS L'UTILISER:
- Pour expliquer un concept (réponds directement avec search_educational_content).
- Si l'élève veut juste comprendre, pas s'entraîner.`,
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
  description: `Consulte le profil cognitif de l'élève (forces, faiblesses, style d'apprentissage préféré).
Le profil est mis à jour au fil des conversations.

QUAND L'UTILISER:
- En début de conversation pour adapter ton approche pédagogique.
- Quand tu veux personnaliser tes explications selon les forces/faiblesses connues.

QUAND NE PAS L'UTILISER:
- Si tu as déjà consulté le profil dans cette conversation.
- Pour des questions simples ou hors-scolaire.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    required: []
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
];
