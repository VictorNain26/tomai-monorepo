import { ArrowRight, CreditCard, Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-primary/5 via-violet/5 to-transparent p-12 sm:p-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Prêt à transformer les devoirs en moment de{" "}
            <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">réussite</span>
            {" "}?
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Commencez gratuitement. Sans carte bancaire, sans engagement.
          </p>

          <div className="flex flex-col items-center gap-6">
            <Link href={APP_URL}>
              <Button variant="premium" size="lg" className="group">
                Commencer gratuitement
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Données protégées</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
