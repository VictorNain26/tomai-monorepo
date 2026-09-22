import { PageLayout } from "@/components/layout/page-layout";
import { FAQ } from "@/components/sections/faq";
import { Button } from "@repo/ui";
import { MessageCircle } from "lucide-react";
import Link from "next/link";

export default function AidePage() {
  return (
    <PageLayout
      title="Centre d'aide"
      description="Trouvez les réponses à vos questions et apprenez à utiliser Tom."
      maxWidth="5xl"
    >
      <div className="max-w-3xl mx-auto mb-24 text-center">
        <div className="group rounded-2xl border border-border bg-card p-8 md:p-12 transition-colors duration-base hover:border-primary">
          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Besoin d&apos;aide personnalisée ?</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Notre équipe de support est disponible pour vous accompagner dans votre utilisation de Tom.
            </p>
            <Button size="lg" asChild>
              <Link href="/contact">Contacter le support</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative">
        <FAQ />
      </div>
    </PageLayout>
  );
}
