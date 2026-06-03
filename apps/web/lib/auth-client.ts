/**
 * Client Better Auth pour le web (Next.js).
 *
 * Le serveur d'auth est Elysia (apps/server) ; le web est un *client séparé*
 * qui parle au serveur en cross-origin. Pas de plugin nextCookies (réservé au
 * cas où Better Auth tourne dans Next.js). En dev, le cookie de session est
 * posé sur l'hôte `localhost` (host-only), donc partagé entre :3000 et :3002.
 *
 * @see https://www.better-auth.com/docs/integrations/next
 * @see https://www.better-auth.com/docs/concepts/client
 */
import { createAuthClient } from "better-auth/react";
import type { Role } from "@/lib/roles";

const baseURL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({ baseURL });

export const { useSession, signIn, signUp, signOut } = authClient;

/** Utilisateur applicatif typé (le rôle vient du serveur : parent | student). */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: Role;
}

/** Hook : utilisateur connecté typé, ou null si non connecté / en chargement. */
export function useUser(): AppUser | null {
  const { data } = useSession();
  return (data?.user as AppUser | undefined) ?? null;
}
