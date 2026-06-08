"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { signIn, signUp } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-errors";
import { ROLE_HOME, type Role } from "@/lib/roles";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitForm() {
    setError(null);
    setLoading(true);

    const result =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });

    setLoading(false);

    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }

    const role = (result.data?.user as { role?: Role } | undefined)?.role ?? "parent";
    router.push(ROLE_HOME[role]);
  }

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
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
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

            <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
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
