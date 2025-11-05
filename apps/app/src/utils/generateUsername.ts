/**
 * Génère un nom d'utilisateur unique basé sur le prénom et nom
 * Format: prénom_nom_timestamp (respecte la regex [a-zA-Z0-9_]{3,20})
 */
export const generateUsername = (firstName: string, lastName: string): string => {
  // Nettoyer et normaliser les noms (supprimer espaces, accents, caractères spéciaux)
  const cleanFirstName = firstName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  const cleanLastName = lastName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  // Générer un timestamp unique + random pour quasi-garantir l'unicité
  const timestamp = Date.now().toString().slice(-4); // Derniers 4 chiffres du timestamp
  const random = Math.floor(Math.random() * 99).toString().padStart(2, '0'); // 2 chiffres random
  const uniqueId = timestamp + random; // 6 chiffres au total

  // Format: prénom_nom_uniqueId (respecte la regex [a-zA-Z0-9_]{3,20})
  let username = `${cleanFirstName}_${cleanLastName}_${uniqueId}`;

  // Tronquer si trop long (max 20 caractères)
  if (username.length > 20) {
    const maxLength = 20 - uniqueId.length - 2; // Garde place pour _XXXXXX
    const firstPart = cleanFirstName.substring(0, Math.floor(maxLength / 2));
    const lastPart = cleanLastName.substring(0, Math.ceil(maxLength / 2));
    username = `${firstPart}_${lastPart}_${uniqueId}`;
  }

  return username;
};
