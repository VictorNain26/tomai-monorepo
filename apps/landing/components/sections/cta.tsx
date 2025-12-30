import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Prêt à transformer les devoirs en moment de réussite ?
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Commencez gratuitement en 2 minutes. Sans carte bancaire, sans engagement.
          </p>

          <div className="flex flex-col items-center gap-6">
            <Link href={APP_URL}>
              <Button size="lg" className="group">
                Créer mon compte parent
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Données protégées</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
