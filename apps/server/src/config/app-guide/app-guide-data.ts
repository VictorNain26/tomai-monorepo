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
  | 'pronote'
  | 'files'
  | 'subscription'
  | 'profile';

const APP_GUIDE: Record<AppHelpTopic, { student: string; parent: string }> = {
  overview: {
    student: `Tom est ton assistant scolaire personnel. Tu peux :
- Poser des questions sur tes cours (toutes matieres, du CP a la Terminale)
- Consulter tes devoirs, notes et emploi du temps Pronote (connecte par ton parent)
- Creer des flashcards pour reviser avec repetition espacee
- Envoyer des photos, documents ou messages vocaux
Tom utilise les programmes officiels de l'Education nationale pour t'aider.`,
    parent: `Tom est un assistant scolaire pour votre enfant. L'application permet :
- Un tutorat adapte au niveau scolaire, base sur les programmes Eduscol
- L'acces aux devoirs, notes et emploi du temps via Pronote (connexion par le parent)
- La creation de flashcards de revision avec repetition espacee
- L'envoi de photos d'exercices et de messages vocaux
Depuis votre espace, vous gerez les enfants, l'abonnement et la connexion Pronote.`,
  },

  navigation: {
    student: `L'application a 4 onglets en bas de l'ecran :
- Accueil : ton tableau de bord avec suggestions personnalisees
- Tom : ta conversation avec l'assistant (ecran principal)
- Revisions : tes decks de flashcards et cartes a reviser
- Profil : tes informations, Pronote, classeur de fichiers et parametres
L'onglet Revisions affiche un badge avec le nombre de cartes a revoir.`,
    parent: `L'application parent a 2 onglets :
- Accueil : tableau de bord avec la liste de vos enfants, leurs statistiques et la gestion Pronote
- Profil : parametres du compte, gestion de l'abonnement
Depuis Accueil, vous pouvez ajouter des enfants, voir leur progression et connecter Pronote.`,
  },

  chat: {
    student: `Pour discuter avec Tom :
- Tape ta question dans la zone de texte en bas
- Tu peux joindre un fichier avec le bouton "+" (photo, document, ou depuis ton classeur)
- Tu peux aussi dicter ton message avec le bouton micro (dictee vocale)
- Tom cherche dans les programmes officiels avant de te repondre
- Il peut consulter tes devoirs et notes Pronote si tu le demandes
- Demande "revise-moi sur..." pour creer des flashcards
Tom ne donne pas les reponses directement : il te guide pour que tu comprennes.`,
    parent: `Le chat est l'interface principale de votre enfant avec Tom :
- Tom utilise une approche socratique : il guide sans donner les reponses
- Les reponses sont basees sur les programmes officiels (Eduscol)
- Votre enfant peut envoyer des photos, documents ou messages vocaux
- Tom peut consulter Pronote pour contextualiser son aide
- Les flashcards sont generees automatiquement sur demande`,
  },

  flashcards: {
    student: `Les flashcards t'aident a reviser efficacement :
- Tom cree des cartes quand tu demandes de reviser un sujet
- Tes cartes apparaissent dans l'onglet Revisions
- Le systeme de repetition espacee te montre les cartes au bon moment
- Apres chaque carte, indique si c'etait facile ou difficile
- Les cartes que tu rates reviennent plus souvent
- Tu peux aussi creer tes propres decks depuis l'onglet Revisions
Le badge sur l'onglet t'indique combien de cartes sont a revoir.`,
    parent: `Le systeme de flashcards utilise la repetition espacee (algorithme FSRS) :
- Les cartes sont creees depuis les conversations ou manuellement par l'enfant
- Chaque carte s'adapte au rythme de memorisation de l'enfant
- Les matieres en difficulte (basees sur les notes Pronote) sont priorisees
- L'enfant voit ses decks dans l'onglet Revisions avec un badge de cartes dues`,
  },

  pronote: {
    student: `Pronote est connecte par ton parent depuis son espace.
Une fois connecte, tu peux :
- Voir tes devoirs, notes et emploi du temps dans Profil
- Demander a Tom "quels sont mes devoirs ?" ou "quelles sont mes notes ?"
- Tom utilise tes vrais devoirs pour t'aider de facon personnalisee
Si Pronote n'est pas connecte, demande a ton parent de le faire depuis son application.`,
    parent: `Pour connecter le Pronote de votre enfant :
- Depuis Accueil, selectionnez un enfant puis "Connecter Pronote"
- Scannez le QR code genere depuis l'interface web de Pronote
- Entrez le code PIN a 4 chiffres affiche sur Pronote
- Selectionnez l'enfant correspondant dans la liste Pronote
La connexion utilise un chiffrement AES-256. Les identifiants ne sont jamais stockes en clair.
Tom peut ensuite acceder aux devoirs, notes et emploi du temps pour personnaliser son aide.`,
  },

  files: {
    student: `Tu peux envoyer des fichiers a Tom dans le chat :
- Appuie sur le bouton "+" pour choisir : appareil photo, galerie, document ou classeur
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
- L'abonnement Premium offre un acces illimite et toutes les fonctionnalites
- Demande a tes parents si tu veux passer en Premium
Tu peux voir ton abonnement dans Profil.`,
    parent: `Gestion de l'abonnement Tom :
- Version gratuite : nombre de messages limite par jour
- Premium : acces illimite, toutes les fonctionnalites
- L'abonnement se gere depuis Profil > Abonnement
- Paiement securise via App Store ou Play Store
- Un seul abonnement couvre tous les enfants rattaches a votre compte`,
  },

  profile: {
    student: `Dans ton profil tu peux :
- Voir tes informations (prenom, niveau scolaire)
- Acceder a tes donnees Pronote (devoirs, notes, emploi du temps) si connecte
- Acceder a "Mon Classeur" pour retrouver tes fichiers envoyes
- Modifier les parametres de l'application
- Te deconnecter
Ton niveau scolaire aide Tom a adapter ses explications a ton programme.`,
    parent: `Dans votre profil vous pouvez :
- Gerer votre abonnement (gratuit ou Premium)
- Modifier les parametres de l'application
Depuis l'onglet Accueil vous pouvez :
- Gerer les enfants rattaches a votre compte
- Modifier le niveau scolaire de chaque enfant
- Connecter Pronote pour chaque enfant
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
  const guide = APP_GUIDE[topic as AppHelpTopic];
  if (!guide) return null;
  return guide[role];
}
