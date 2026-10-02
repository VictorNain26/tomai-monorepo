/**
 * App Guide Data - Contenu d'aide contextuel par topic et role
 *
 * Utilise par le tool get_app_help pour repondre aux questions
 * sur l'application Tom (navigation, fonctionnalites, abonnement, etc.)
 */

type AppHelpTopic =
  | 'overview'
  | 'navigation'
  | 'chat'
  | 'flashcards'
  | 'files'
  | 'subscription'
  | 'profile';

const APP_GUIDE: Record<AppHelpTopic, { student: string; parent: string }> = {
  overview: {
    student: `Tom est ton assistant scolaire personnel. Tu peux :
- Poser des questions sur tes cours (toutes matieres, du CP a la Terminale)
- Creer des flashcards pour reviser avec repetition espacee
- Envoyer des photos, documents ou messages vocaux
Tom adapte ses explications a ta classe.`,
    parent: `Tom est un assistant scolaire pour votre enfant. L'application permet :
- Un tutorat adapte au niveau scolaire
- La creation de flashcards de revision avec repetition espacee
- L'envoi de photos d'exercices et de messages vocaux
Depuis votre espace, vous gerez les enfants et l'abonnement.`,
  },

  navigation: {
    student: `L'application est organisee en quatre espaces :
- Accueil : ton tableau de bord avec suggestions personnalisees
- Tom : ta conversation avec l'assistant (espace principal)
- Revisions : tes decks de flashcards et le nombre de cartes a revoir
- Profil : tes informations, classeur de fichiers et parametres`,
    parent: `L'espace parent est organise en deux parties :
- Accueil : la liste de vos enfants et leurs statistiques
- Profil : parametres du compte et abonnement
Depuis Accueil, vous pouvez ajouter des enfants et voir leur progression.`,
  },

  chat: {
    student: `Pour discuter avec Tom :
- Tape ta question dans la zone de texte en bas
- Tu peux joindre un fichier avec le bouton "+" (photo, document, ou depuis ton classeur)
- Tu peux aussi dicter ton message avec le bouton micro (dictee vocale)
- Demande "revise-moi sur..." pour creer des flashcards
Tom ne donne pas les reponses directement : il te guide pour que tu comprennes.`,
    parent: `Le chat est l'interface principale de votre enfant avec Tom :
- Tom utilise une approche socratique : il guide sans donner les reponses
- Les explications sont adaptees au niveau scolaire de votre enfant
- Votre enfant peut envoyer des photos, documents ou messages vocaux
- Les flashcards sont generees automatiquement sur demande`,
  },

  flashcards: {
    student: `Les flashcards t'aident a reviser efficacement :
- Tom cree des cartes quand tu demandes de reviser un sujet
- Tes cartes apparaissent dans l'espace Revisions
- Le systeme de repetition espacee te montre les cartes au bon moment
- Apres chaque carte, indique si c'etait facile ou difficile
- Les cartes que tu rates reviennent plus souvent
- Tu peux aussi creer tes propres decks depuis l'espace Revisions
L'espace Revisions t'indique combien de cartes sont a revoir.`,
    parent: `Le systeme de flashcards utilise la repetition espacee (algorithme FSRS) :
- Les cartes sont creees depuis les conversations ou manuellement par l'enfant
- Chaque carte s'adapte au rythme de memorisation de l'enfant
- L'enfant retrouve ses decks et ses cartes dues dans l'espace Revisions`,
  },

  files: {
    student: `Tu peux envoyer des fichiers a Tom dans le chat :
- Joins une photo, un document ou un fichier de ton classeur a ton message
- Formats acceptes : photos (JPG, PNG, WebP, HEIC), documents (PDF, Word, texte)
- Tom analyse l'image ou le document et t'aide dessus
- Tes fichiers sont sauvegardes dans "Mon Classeur" (Profil > Mon Classeur)
- Tu peux reutiliser un fichier du classeur dans une nouvelle conversation
Tes fichiers sont stockes de facon securisee et restent prives.`,
    parent: `L'envoi de fichiers permet a votre enfant de :
- Photographier un exercice ou un enonce pour obtenir de l'aide
- Envoyer des documents (PDF, Word, texte) ou des photos
- Tom analyse le contenu et adapte son aide au niveau scolaire
- Les fichiers sont sauvegardes dans un "Classeur" personnel reutilisable
Les fichiers sont stockes sur des serveurs en France (RGPD) et restent prives.`,
  },

  subscription: {
    student: `Ton abonnement Tom :
- La version gratuite a un nombre limite de messages par jour
- L'abonnement Premium n'est pas encore disponible en ligne
Tu peux voir ton utilisation dans Profil.`,
    parent: `Abonnement Tom :
- Version gratuite : nombre de messages limite par jour
- L'abonnement Premium n'est pas encore disponible en ligne : il n'existe aujourd'hui aucun moyen de paiement
- Un seul abonnement couvrira tous les enfants rattaches a votre compte
Ne propose aucune demarche de paiement : il n'y en a pas encore.`,
  },

  profile: {
    student: `Dans ton profil tu peux :
- Voir tes informations (prenom, niveau scolaire)
- Acceder a "Mon Classeur" pour retrouver tes fichiers envoyes
- Modifier les parametres de l'application
- Te deconnecter
Ton niveau scolaire aide Tom a adapter ses explications a ton programme.`,
    parent: `Dans votre profil vous pouvez :
- Voir votre formule (gratuite ; Premium pas encore disponible en ligne)
- Modifier les parametres de l'application
Depuis l'espace Accueil vous pouvez :
- Gerer les enfants rattaches a votre compte
- Modifier le niveau scolaire de chaque enfant
- Consulter les statistiques et la progression de vos enfants`,
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
  // topic comes from the model's tool call: check the key before trusting it.
  if (!Object.hasOwn(APP_GUIDE, topic)) return null;
  const guide = APP_GUIDE[topic as AppHelpTopic];
  return guide[role];
}
