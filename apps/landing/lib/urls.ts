/**
 * URL Configuration Helper
 * Gère les URLs en fonction de l'environnement (dev/prod)
 */

/**
 * URL de l'application client (app)
 * - Development: http://localhost:5173
 * - Production: https://app.tomai.fr
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";

/**
 * URL de la landing page
 * - Development: http://localhost:3001
 * - Production: https://tomai.fr
 */
export const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3001";

/**
 * Routes de l'application
 */
export const AppRoutes = {
  /** Page d'inscription */
  register: `${APP_URL}/auth/register`,
  /** Page de connexion */
  login: `${APP_URL}/auth/login`,
  /** Dashboard parent */
  parentDashboard: `${APP_URL}/parent/dashboard`,
  /** Dashboard étudiant */
  studentDashboard: `${APP_URL}/student/dashboard`,
  /** Chat */
  chat: `${APP_URL}/chat`,
} as const;

/**
 * Routes de la landing page
 */
export const LandingRoutes = {
  home: LANDING_URL,
  pricing: `${LANDING_URL}/#pricing`,
  howItWorks: `${LANDING_URL}/#how-it-works`,
  features: `${LANDING_URL}/#features`,
  testimonials: `${LANDING_URL}/#testimonials`,
} as const;
