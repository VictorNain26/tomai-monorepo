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

/**
 * URL de la landing page
 * - Development: http://localhost:3001
 * - Production: https://tomia.fr
 */
export const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3001";

/**
 * Routes de la landing page
 */
export const LandingRoutes = {
  home: LANDING_URL,
  pricing: `${LANDING_URL}/#pricing`,
  howItWorks: `${LANDING_URL}/#how-it-works`,
  features: `${LANDING_URL}/#features`,
} as const;
