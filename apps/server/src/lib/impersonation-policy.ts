/**
 * Politique d'autorisation d'impersonation parent→élève.
 * Pure (aucune dépendance) pour être testable sans charger Better Auth.
 */
export function canParentImpersonate(
  requestingRole: string,
  targetRole: string,
  linked: boolean,
): boolean {
  return requestingRole === 'parent' && targetRole === 'student' && linked;
}
