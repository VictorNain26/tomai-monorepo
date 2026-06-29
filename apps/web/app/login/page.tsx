"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { signIn, signUp } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";
import { ROLE_HOME, resolveWebRole } from "@/lib/roles";

type Mode = "signin" | "signup";

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submitForm() {
    setError(null);
    setLoading(true);

    try {
      let result;
      if (mode === "signup") {
        result = await signUp.email({ email: identifier, password, name });
      } else if (identifier.includes("@")) {
        result = await signIn.email({ email: identifier, password });
      } else {
        result = await signIn.username({ username: identifier, password });
      }

      if (result.error) {
        setError(translateAuthError(result.error));
        return;
      }

      const role = resolveWebRole((result.data?.user as { role?: string } | undefined)?.role);
      if (!role) {
        setError("Ce compte n'a pas d'espace sur le web pour le moment.");
        return;
      }
      router.push(ROLE_HOME[role]);
    } catch {
      setError("Une erreur réseau est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signIn.social({ provider: "google", callbackURL: "/parent" });
      if (result.error) {
        setError(translateAuthError(result.error));
      }
    } catch {
      setError("Connexion Google indisponible.");
    } finally {
      setGoogleLoading(false);
    }
  }

  const isDisabled = loading || googleLoading;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "signin" ? "Connexion à Tom" : "Créer un compte"}
          </CardTitle>
          <CardDescription>
            {mode === "signin" ? "Accédez à votre espace." : "Inscrivez-vous pour commencer."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitForm();
            }}
            className="flex flex-col gap-4"
          >
            {mode === "signup" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Nom
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="identifier" className="text-sm font-medium">
                {mode === "signin" ? "Email ou identifiant" : "Email"}
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete={mode === "signin" ? "username" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "signin" ? "vous@exemple.fr ou identifiant" : "vous@exemple.fr"}
                aria-describedby={error ? "login-error" : undefined}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-describedby={error ? "login-error" : undefined}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {error && (
              <p id="login-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isDisabled} aria-busy={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Connexion en cours…</span>
                </>
              ) : mode === "signin" ? (
                "Se connecter"
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-4">
            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={isDisabled}
              aria-busy={googleLoading}
              onClick={() => void signInWithGoogle()}
            >
              {googleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Connexion Google en cours…</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Continuer avec Google
                </>
              )}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "Pas de compte ? S'inscrire"
              : "Déjà un compte ? Se connecter"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
