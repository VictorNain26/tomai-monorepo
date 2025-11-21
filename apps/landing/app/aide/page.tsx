import { SectionHeader } from "@/components/atoms/section-header";
import { FAQ } from "@/components/sections/faq";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/atoms/fade-in";

export default function AidePage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12 md:py-24 px-4 overflow-hidden">
      <FadeIn className="container mx-auto max-w-5xl">
        <SectionHeader
          title="Centre d'aide"
          description="Trouvez les réponses à vos questions et apprenez à utiliser TomIA."
          align="center"
        />

        <div className="max-w-3xl mx-auto mb-24 text-center">
          <div className="group relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 md:p-12 transition-all hover:shadow-2xl hover:border-primary/50">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Besoin d&apos;aide personnalisée ?</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Notre équipe de support est disponible pour vous accompagner dans votre utilisation de TomIA.
              </p>
              <Link href="/contact">
                <Button size="lg" className="rounded-full px-8">Contacter le support</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 bg-secondary/30 rounded-[3rem] blur-3xl"></div>
          <FAQ />
        </div>
      </FadeIn>
    </div>
  );
}
