/**
 * Rôles applicatifs. Source de vérité du routing role-aware côté web.
 * Le rôle réel viendra de la session Better Auth (cf. Tâche 8, doc-first).
 */
export type Role = "parent" | "student" | "school";

export const ROLES: readonly Role[] = ["parent", "student", "school"] as const;

export const ROLE_HOME: Record<Role, string> = {
  parent: "/parent",
  student: "/student",
  school: "/school",
};

export const ROLE_LABEL: Record<Role, string> = {
  parent: "Parent",
  student: "Élève",
  school: "Établissement",
};

export function asRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

/**
 * Rôle web effectif d'une session : absent → défaut produit "parent" ;
 * présent mais hors espace web (ex. 'admin', qui existe côté serveur via le
 * plugin Better Auth) → null, à refuser explicitement par l'appelant.
 */
export function resolveWebRole(value: string | undefined): Role | null {
  return value === undefined ? "parent" : asRole(value);
}
