/**
 * URL Configuration Helper
 * Gère les URLs en fonction de l'environnement (dev/prod)
 */

/**
 * URL du serveur backend
 * - Development: http://localhost:3000
 * - Production: https://api.tomia.fr (ou Koyeb URL)
 */
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
