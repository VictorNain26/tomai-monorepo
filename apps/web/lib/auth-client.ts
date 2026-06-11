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
import type { IAppUser } from "@repo/api/types";

const baseURL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({ baseURL });

export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Hook : utilisateur connecté (contrat @repo/api, vérité serveur) + état de
 * chargement, pour distinguer « pas encore su » de « non connecté ». Le
 * mapping rôle → espace web reste l'affaire de `resolveWebRole`.
 */
export function useUser(): { user: IAppUser | null; isPending: boolean } {
  const { data, isPending } = useSession();
  // Cast unique : Better Auth ne propage pas les additionalFields serveur
  // (role, schoolLevel…) dans le type client cross-origin.
  return { user: (data?.user as IAppUser | undefined) ?? null, isPending };
}
