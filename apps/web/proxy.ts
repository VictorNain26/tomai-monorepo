import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, ROLES, type Role } from "@/lib/roles";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

function asRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

/**
 * Garde d'authentification role-aware (équivalent web de `Stack.Protected`).
 *
 * Convention Next.js 16 : `proxy` remplace `middleware` (même comportement).
 * Interroge le serveur d'auth Elysia (`/api/auth/get-session`) en transférant
 * le cookie de session du navigateur. En dev, le cookie est host-only sur
 * `localhost`, donc accessible depuis :3002.
 *
 * Pas de session → /login. Session dont le rôle ne correspond pas au segment
 * demandé (/parent, /student, /school) → redirection vers le home du rôle.
 */
export async function proxy(request: NextRequest) {
  let role: Role | null = null;
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const session = (await res.json()) as { user?: { role?: string } } | null;
      if (session?.user) {
        // Rôle inconnu/absent → même fallback que le login (parent).
        role = asRole(session.user.role) ?? "parent";
      }
    }
  } catch {
    role = null;
  }

  const url = request.nextUrl.clone();

  if (!role) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const segment = url.pathname.split("/")[1];
  if (segment !== role) {
    url.pathname = ROLE_HOME[role];
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/parent/:path*", "/student/:path*", "/school/:path*"],
};
