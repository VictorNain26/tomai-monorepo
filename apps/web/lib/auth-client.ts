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

const baseURL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

const authClient = createAuthClient({ baseURL });

export const { signIn, signUp, signOut, useSession } = authClient;

export function useUser() {
  return useSession().data?.user ?? null;
}

/** Returns the current user and whether the session is still resolving. */
export function useUserState() {
  const { data, isPending } = useSession();
  return { user: data?.user ?? null, isPending };
}
