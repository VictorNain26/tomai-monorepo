/**
 * Détermine la couleur CSS pour l'affichage du coût en fonction du montant
 * @param cost - Le coût à évaluer
 * @returns La classe CSS de couleur appropriée
 */
export const getCostColor = (cost: number): string => {
  if (cost > 18) {
    return 'text-destructive';
  }

  if (cost > 15) {
    return 'text-warning';
  }

  return 'text-success';
};

/**
 * Formate un montant en euros avec 2 décimales
 * @param cost - Le montant à formater
 * @returns Le montant formaté avec le symbole €
 */
export const formatCost = (cost: number): string => {
  return `${cost.toFixed(2)}€`;
};

/**
 * Vérifie si le montant dépasse le seuil d'alerte
 * @param cost - Le montant à vérifier
 * @param threshold - Le seuil d'alerte (défaut: 20€)
 * @returns true si le montant dépasse le seuil
 */
export const isOverBudget = (cost: number, threshold: number = 20): boolean => {
  return cost >= threshold;
};
