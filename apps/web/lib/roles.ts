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
