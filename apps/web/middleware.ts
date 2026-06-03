import { NextResponse, type NextRequest } from "next/server";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

/**
 * Garde d'authentification (équivalent web de `Stack.Protected` côté mobile).
 *
 * Le middleware interroge le serveur d'auth Elysia (`/api/auth/get-session`)
 * en transférant le cookie de session du navigateur. En dev, le cookie est
 * host-only sur `localhost`, donc accessible depuis :3002. Pas de session →
 * redirection vers /login.
 */
export async function middleware(request: NextRequest) {
  let hasSession = false;
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const session = (await res.json()) as { user?: unknown } | null;
      hasSession = Boolean(session?.user);
    }
  } catch {
    hasSession = false;
  }

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/parent/:path*", "/student/:path*", "/school/:path*"],
};
