/**
 * App Guide Data - Contenu d'aide contextuel par topic et role
 *
 * Utilise par le tool get_app_help pour repondre aux questions
 * sur l'application Tom (navigation, fonctionnalites, abonnement, etc.)
 */

export type AppHelpTopic =
  | 'overview'
  | 'navigation'
  | 'chat'
  | 'flashcards'
  | 'pronote'
  | 'files'
  | 'subscription'
  | 'profile';

export const APP_HELP_TOPICS: AppHelpTopic[] = [
  'overview', 'navigation', 'chat', 'flashcards',
  'pronote', 'files', 'subscription', 'profile',
];

const APP_GUIDE: Record<AppHelpTopic, { student: string; parent: string }> = {
  overview: {
    student: `Tom est ton assistant scolaire personnel. Tu peux :
- Poser des questions sur tes cours (toutes matieres, du CP a la Terminale)
- Consulter tes devoirs, notes et emploi du temps Pronote
- Creer des flashcards pour reviser
- Envoyer des photos d'exercices ou de documents
Tom utilise les programmes officiels de l'Education nationale pour t'aider.`,
    parent: `Tom est un assistant scolaire pour votre enfant. L'application permet :
- Un tutorat adapte au niveau scolaire, base sur les programmes Eduscol
- L'acces aux devoirs, notes et emploi du temps via Pronote
- La creation de flashcards de revision avec repetition espacee
- L'envoi de photos d'exercices pour une aide contextuelle
Vous pouvez suivre l'activite de votre enfant depuis votre espace parent.`,
  },

  navigation: {
    student: `L'application a 3 onglets principaux :
- Chat : ta conversation avec Tom (ecran principal)
- Flashcards : tes decks de revision et cartes a reviser
- Profil : tes parametres, connexion Pronote, et ton abonnement
Pour revenir au chat, appuie sur l'onglet Chat en bas de l'ecran.`,
    parent: `L'application a 3 sections :
- Chat : la conversation de votre enfant avec Tom
- Flashcards : les decks de revision crees automatiquement ou manuellement
- Profil : parametres du compte, gestion de l'abonnement, connexion Pronote
Depuis votre espace, vous pouvez gerer les enfants rattaches a votre compte.`,
  },

  chat: {
    student: `Pour discuter avec Tom :
- Tape ta question dans la zone de texte en bas
- Tu peux joindre une photo (exercice, document) avec le bouton appareil photo
- Tom cherche dans les programmes officiels avant de te repondre
- Il peut aussi consulter tes devoirs et notes Pronote si tu le demandes
- Demande "revise-moi sur..." pour creer des flashcards
Tom ne donne pas les reponses directement : il te guide pour que tu comprennes.`,
    parent: `Le chat est l'interface principale de votre enfant avec Tom :
- Tom utilise une approche socratique : il guide sans donner les reponses
- Les reponses sont basees sur les programmes officiels (Eduscol)
- Votre enfant peut envoyer des photos d'exercices
- Tom peut consulter Pronote pour contextualiser son aide
- Les flashcards sont generees automatiquement sur demande`,
  },

  flashcards: {
    student: `Les flashcards t'aident a reviser efficacement :
- Tom cree des cartes quand tu demandes de reviser un sujet
- Tes cartes apparaissent dans l'onglet Flashcards
- Le systeme de repetition espacee te montre les cartes au bon moment
- Apres chaque carte, indique si c'etait facile ou difficile
- Les cartes que tu rates reviennent plus souvent
Tu peux aussi demander a Tom de creer des cartes sur un sujet precis.`,
    parent: `Le systeme de flashcards utilise la repetition espacee (algorithme FSRS) :
- Les cartes sont creees depuis les conversations ou manuellement
- Chaque carte s'adapte au rythme de memorisation de l'enfant
- Les matieres en difficulte (basees sur les notes Pronote) sont priorisees
- Vous pouvez voir les decks et la progression dans l'onglet Flashcards`,
  },

  pronote: {
    student: `Pour connecter Pronote :
- Va dans Profil > Connexion Pronote
- Scanne le QR code depuis Pronote sur un ordinateur
- Une fois connecte, Tom peut voir tes devoirs, notes et emploi du temps
- Demande "quels sont mes devoirs ?" ou "quelles sont mes notes ?"
La connexion est securisee et tes identifiants ne sont jamais stockes en clair.`,
    parent: `Pour connecter le Pronote de votre enfant :
- Allez dans Profil > Connexion Pronote
- Scannez le QR code genere depuis l'interface web de Pronote
- La connexion utilise un chiffrement AES-256 (niveau bancaire)
- Les identifiants ne sont jamais stockes en clair
- Tom peut ensuite acceder aux devoirs, notes et emploi du temps
Cela permet un suivi personalise base sur les vrais devoirs et resultats.`,
  },

  files: {
    student: `Tu peux envoyer des fichiers a Tom :
- Appuie sur le bouton appareil photo/fichier dans le chat
- Formats acceptes : photos (JPG, PNG), documents (PDF)
- Tom analyse l'image ou le document et t'aide dessus
- Utile pour les exercices imprimes, les schemas, ou les enonces
Tes fichiers sont stockes de facon securisee et restent prives.`,
    parent: `L'envoi de fichiers permet a votre enfant de :
- Photographier un exercice ou un enonce pour obtenir de l'aide
- Envoyer des documents PDF (cours, fiches)
- Tom analyse le contenu et adapte son aide au niveau scolaire
Les fichiers sont stockes sur des serveurs en France (RGPD) et restent prives.`,
  },

  subscription: {
    student: `Ton abonnement Tom :
- La version gratuite permet quelques messages par jour
- L'abonnement Premium offre un acces illimite et toutes les fonctionnalites
- Demande a tes parents si tu veux passer en Premium
Tu peux voir ton abonnement dans Profil > Abonnement.`,
    parent: `Gestion de l'abonnement Tom :
- Version gratuite : nombre de messages limite par jour
- Premium : acces illimite, toutes les fonctionnalites (Pronote, flashcards avancees)
- L'abonnement se gere depuis Profil > Abonnement
- Paiement securise via Stripe (web) ou App Store/Play Store (mobile)
- Un seul abonnement couvre tous les enfants rattaches a votre compte`,
  },

  profile: {
    student: `Dans ton profil tu peux :
- Voir et modifier tes informations (prenom, niveau scolaire)
- Connecter ou deconnecter Pronote
- Voir ton abonnement
- Te deconnecter de l'application
Ton niveau scolaire aide Tom a adapter ses explications a ton programme.`,
    parent: `Dans votre profil vous pouvez :
- Gerer les enfants rattaches a votre compte
- Modifier le niveau scolaire de chaque enfant
- Connecter Pronote pour chaque enfant
- Gerer votre abonnement et vos moyens de paiement
- Consulter l'activite et la progression de vos enfants`,
  },
};

/**
 * Retourne le contenu d'aide pour un topic et un role donnes.
 * Retourne null si le topic n'existe pas.
 */
export function getAppHelpContent(
  topic: string,
  role: 'student' | 'parent'
): string | null {
  const guide = APP_GUIDE[topic as AppHelpTopic];
  if (!guide) return null;
  return guide[role];
}
