import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLES, ROLE_HOME, ROLE_LABEL } from "@/lib/roles";

/**
 * Écran de connexion (template).
 * TODO (Tâche 8, doc-first) : brancher Better Auth web (signIn email + Google),
 * dériver le rôle de la session et rediriger via ROLE_HOME. Pour l'instant, le
 * sélecteur de rôle ci-dessous permet de naviguer dans les espaces template.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Connexion à Tom</CardTitle>
          <CardDescription>Accédez à votre espace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="vous@exemple.fr"
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
              placeholder="••••••••"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button disabled className="w-full">
            Se connecter (à brancher)
          </Button>

          <div className="mt-2 border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Démo template — choisir un espace :
            </p>
            <div className="flex flex-col gap-2">
              {ROLES.map((role) => (
                <Button key={role} asChild variant="outline" className="w-full">
                  <Link href={ROLE_HOME[role]}>{ROLE_LABEL[role]}</Link>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
