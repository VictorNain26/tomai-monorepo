/**
 * Messages Constants for Tom - Système de messages UX-friendly en français
 * Messages d'erreur, de succès et informatifs cohérents et adaptatifs selon l'âge
 */

export interface MessageConfig {
  primary: string;    // Messages pour enfants 6-10 ans (CP-CM2)
  college: string;    // Messages pour adolescents 11-14 ans (6ème-3ème)
  lycee: string;      // Messages pour lycéens 15-18 ans (2nde-Terminale)
  parent: string;     // Messages pour parents
}

export type UIMode = 'primary' | 'college' | 'lycee';
export type UserType = UIMode | 'parent';

/**
 * Messages d'erreur adaptatifs par âge et rôle
 */
export const ERROR_MESSAGES = {
  // Authentification
  auth: {
    loginFailed: {
      primary: "Oups ! Vérifie ton nom d'utilisateur 😕",
      college: "Nom d'utilisateur ou mot de passe incorrect",
      lycee: "Identifiants de connexion incorrects",
      parent: "Email ou mot de passe incorrect. Vérifiez vos identifiants."
    },
    registrationFailed: {
      primary: "Impossible de créer ton compte maintenant 😕",
      college: "Erreur lors de la création du compte",
      lycee: "Échec de l'inscription. Réessayez.",
      parent: "Impossible de créer votre compte. Veuillez réessayer."
    },
    googleAuthFailed: {
      primary: "Problème avec Google 😕",
      college: "Erreur avec la connexion Google",
      lycee: "Échec de l'authentification Google",
      parent: "Erreur d'authentification Google. Réessayez."
    },
    sessionExpired: {
      primary: "Tu dois te reconnecter 🔄",
      college: "Ta session a expiré, reconnecte-toi",
      lycee: "Session expirée. Reconnexion nécessaire.",
      parent: "Votre session a expiré. Veuillez vous reconnecter."
    }
  },

  // Réseau et API
  network: {
    connectionError: {
      primary: "Problème de connexion internet 📡",
      college: "Vérifiez votre connexion internet",
      lycee: "Erreur de connexion réseau",
      parent: "Problème de connexion. Vérifiez votre réseau."
    },
    serverError: {
      primary: "Nos serveurs font une pause ⏳",
      college: "Problème technique temporaire",
      lycee: "Erreur serveur temporaire",
      parent: "Erreur serveur. Nos équipes travaillent à la résolution."
    },
    timeoutError: {
      primary: "C'est un peu long... Réessaie ! ⏰",
      college: "La requête prend trop de temps",
      lycee: "Délai d'attente dépassé",
      parent: "Délai d'attente dépassé. Veuillez réessayer."
    }
  },

  // Chat et IA
  chat: {
    loadHistoryFailed: {
      primary: "Impossible de charger tes discussions 📚",
      college: "Erreur lors du chargement de l'historique",
      lycee: "Échec du chargement des conversations",
      parent: "Impossible de charger l'historique des conversations."
    },
    sendMessageFailed: {
      primary: "Ton message n'est pas parti 📤",
      college: "Impossible d'envoyer le message",
      lycee: "Échec de l'envoi du message",
      parent: "Erreur lors de l'envoi du message."
    },
    aiResponseFailed: {
      primary: "Tom a besoin d'une petite pause 🤖",
      college: "Tom ne peut pas répondre maintenant",
      lycee: "Erreur de génération de réponse IA",
      parent: "Tom rencontre des difficultés techniques."
    },
    sessionNotFound: {
      primary: "Cette discussion n'existe plus 🔍",
      college: "Session de chat introuvable",
      lycee: "Session non trouvée",
      parent: "Session de conversation introuvable."
    }
  },

  // Gestion des enfants (Parents)
  children: {
    deleteFailed: "Impossible de supprimer le compte de l'enfant",
    createFailed: "Erreur lors de la création du compte enfant",
    updateFailed: "Impossible de modifier les informations",
    loadFailed: "Erreur lors du chargement des données enfant"
  },

  // Établissements Pronote
  establishment: {
    searchFailed: {
      primary: "Impossible de chercher ton école 🏫",
      college: "Erreur lors de la recherche d'établissement",
      lycee: "Échec de la recherche d'établissements",
      parent: "Erreur lors de la recherche d'établissements."
    },
    notFound: {
      primary: "Aucune école trouvée 🔍",
      college: "Aucun établissement trouvé",
      lycee: "Aucun résultat pour cette recherche",
      parent: "Aucun établissement trouvé pour cette recherche."
    },
    validationFailed: {
      primary: "Informations incorrectes 📝",
      college: "Erreur de validation des données",
      lycee: "Données d'établissement invalides",
      parent: "Erreur de validation des informations d'établissement."
    },
    connectionFailed: {
      primary: "Impossible de se connecter à Pronote 🔗",
      college: "Erreur de connexion à Pronote",
      lycee: "Échec de la connexion Pronote",
      parent: "Impossible de se connecter à Pronote. Vérifiez vos identifiants."
    }
  },

  // Upload de fichiers
  upload: {
    failed: {
      primary: "Impossible d'envoyer ton fichier 📁",
      college: "Erreur lors de l'envoi du fichier",
      lycee: "Échec du téléchargement",
      parent: "Erreur lors du téléchargement du fichier."
    },
    tooLarge: {
      primary: "Ton fichier est trop gros 📏",
      college: "Fichier trop volumineux",
      lycee: "Taille de fichier dépassée",
      parent: "Fichier trop volumineux. Limite dépassée."
    },
    invalidFormat: {
      primary: "Ce type de fichier n'est pas accepté 📄",
      college: "Format de fichier non supporté",
      lycee: "Type de fichier invalide",
      parent: "Format de fichier non supporté."
    }
  },

  // Reconnaissance vocale
  voice: {
    notSupported: {
      primary: "Ton navigateur ne peut pas m'écouter 🎤",
      college: "Reconnaissance vocale non supportée",
      lycee: "Navigateur incompatible avec la reconnaissance vocale",
      parent: "La reconnaissance vocale n'est pas supportée par ce navigateur."
    },
    permissionDenied: {
      primary: "J'ai besoin de ton autorisation pour t'écouter 🔐",
      college: "Permission microphone refusée",
      lycee: "Accès au microphone refusé",
      parent: "Permission microphone refusée. Autorisez l'accès dans les paramètres."
    },
    httpsRequired: {
      primary: "Il faut une connexion sécurisée 🔒",
      college: "HTTPS requis pour le microphone",
      lycee: "Connexion sécurisée requise",
      parent: "HTTPS requis pour la reconnaissance vocale."
    },
    noMicrophone: {
      primary: "Aucun microphone détecté 🎤",
      college: "Microphone non trouvé",
      lycee: "Aucun microphone disponible",
      parent: "Aucun microphone détecté. Vérifiez votre matériel audio."
    }
  },

  // Erreurs génériques
  generic: {
    unknownError: {
      primary: "Quelque chose s'est mal passé 😕",
      college: "Une erreur inattendue s'est produite",
      lycee: "Erreur inconnue",
      parent: "Une erreur inattendue s'est produite."
    },
    permissionDenied: {
      primary: "Tu n'as pas le droit de faire ça 🚫",
      college: "Permission refusée",
      lycee: "Accès non autorisé",
      parent: "Permission refusée. Droits insuffisants."
    },
    validationError: {
      primary: "Vérifie les informations 📝",
      college: "Erreur de validation des données",
      lycee: "Données invalides",
      parent: "Erreur de validation. Vérifiez les informations saisies."
    }
  }
} as const;

/**
 * Messages de succès adaptatifs par âge et rôle
 */
export const SUCCESS_MESSAGES = {
  // Authentification
  auth: {
    loginSuccess: {
      primary: "Bienvenue ! 🎉",
      college: "Connexion réussie !",
      lycee: "Connecté avec succès",
      parent: "Connexion réussie ! Bienvenue sur Tom."
    },
    registrationSuccess: {
      primary: "Ton compte est créé ! Bienvenue ! 🎊",
      college: "Compte créé avec succès !",
      lycee: "Inscription réussie",
      parent: "Compte créé avec succès ! Bienvenue sur Tom !"
    },
    googleAuthSuccess: {
      primary: "Connecté avec Google ! 🎉",
      college: "Connexion Google réussie !",
      lycee: "Authentification Google réussie",
      parent: "Connexion Google réussie !"
    },
    logoutSuccess: {
      primary: "À bientôt ! 👋",
      college: "Déconnexion réussie",
      lycee: "Session fermée",
      parent: "Déconnexion réussie. À bientôt !"
    }
  },

  // Chat et sessions
  chat: {
    sessionDeleted: {
      primary: "Discussion supprimée ! 🗑️",
      college: "Session supprimée",
      lycee: "Conversation supprimée",
      parent: "Session de conversation supprimée."
    },
    sessionStarted: {
      primary: "C'est parti pour {subject} ! 🚀",
      college: "Session de {subject} démarrée !",
      lycee: "Session {subject} initialisée",
      parent: "Session de {subject} créée pour votre enfant."
    },
    sessionResumed: {
      primary: "On reprend où on s'était arrêté ! 📖",
      college: "Session reprise !",
      lycee: "Conversation reprise",
      parent: "Session reprise avec succès."
    }
  },

  // Gestion des enfants (Parents)
  children: {
    created: "Compte enfant créé avec succès !",
    updated: "Informations mises à jour avec succès !",
    deleted: "Compte supprimé avec succès !"
  },

  // Upload de fichiers
  upload: {
    success: {
      primary: "Fichier envoyé ! 📁✅",
      college: "Fichier téléchargé avec succès",
      lycee: "Upload terminé",
      parent: "Fichier téléchargé avec succès."
    }
  },

  // Établissements
  establishment: {
    connected: {
      primary: "Connecté à ton école ! 🏫✅",
      college: "Connexion Pronote établie",
      lycee: "Authentification Pronote réussie",
      parent: "Connexion à l'établissement réussie."
    }
  }
} as const;

/**
 * Messages informatifs adaptatifs
 */
export const INFO_MESSAGES = {
  // État de chargement
  loading: {
    generic: {
      primary: "Chargement en cours... ⏳",
      college: "Chargement...",
      lycee: "Chargement en cours...",
      parent: "Chargement des données..."
    },
    searchingEstablishments: {
      primary: "Je cherche ton école... 🔍",
      college: "Recherche d'établissements...",
      lycee: "Recherche en cours...",
      parent: "Recherche d'établissements en cours..."
    },
    connectingPronote: {
      primary: "Connexion à ton école... 🔗",
      college: "Connexion à Pronote...",
      lycee: "Authentification Pronote...",
      parent: "Connexion à Pronote en cours..."
    }
  },

  // Instructions
  instructions: {
    pronoteAuth: {
      primary: "Scanne le QR Code avec le téléphone de tes parents 📱",
      college: "Utilisez l'application mobile Pronote pour scanner",
      lycee: "Scannez le QR Code avec l'app Pronote mobile",
      parent: "Scannez ce QR Code avec l'application Pronote sur votre téléphone."
    },
    voiceRecognition: {
      primary: "Clique et parle ! Je t'écoute 🎤",
      college: "Maintenez appuyé pour parler",
      lycee: "Appuyez pour activer la reconnaissance vocale",
      parent: "Appuyez et maintenez pour utiliser la reconnaissance vocale."
    }
  }
} as const;

/**
 * Fonction utilitaire pour récupérer un message adapté à l'utilisateur
 */
export function getMessage(
  messageObject: MessageConfig,
  userType: UserType = 'lycee'
): string {
  return messageObject[userType];
}

/**
 * Fonction utilitaire pour récupérer un message avec interpolation
 */
export function getMessageWithParams(
  messageObject: MessageConfig,
  userType: UserType = 'lycee',
  params: Record<string, string> = {}
): string {
  let message = getMessage(messageObject, userType);

  // Interpolation simple des paramètres
  Object.entries(params).forEach(([key, value]) => {
    message = message.replace(`{${key}}`, value);
  });

  return message;
}

/**
 * Fonction pour déterminer le type d'utilisateur à partir du niveau scolaire et du rôle
 */
export function getUserType(role?: string, schoolLevel?: string): UserType {
  if (role === 'parent') return 'parent';

  if (schoolLevel && role === 'student') {
    const primaryLevels = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
    const collegeLevels = ['6eme', '5eme', '4eme', '3eme'];

    if (primaryLevels.includes(schoolLevel)) return 'primary';
    if (collegeLevels.includes(schoolLevel)) return 'college';
  }

  return 'lycee'; // Par défaut
}

/**
 * Export du module par défaut
 */
export default {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  INFO_MESSAGES,
  getMessage,
  getMessageWithParams,
  getUserType
};
