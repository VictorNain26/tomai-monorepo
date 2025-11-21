import { SectionHeader } from "@/components/atoms/section-header";
import { Button } from "@/components/ui/button";
import { Mail, MapPin } from "lucide-react";
import { FadeIn } from "@/components/atoms/fade-in";

export default function ContactPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 md:py-24 px-4 overflow-hidden">
      <FadeIn className="container mx-auto max-w-5xl">
        <SectionHeader
          title="Contactez-nous"
          description="Une question ? Une suggestion ? Notre équipe est là pour vous aider."
          align="center"
        />

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Email Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 text-center transition-all hover:shadow-2xl hover:border-primary/50 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Par email</h3>
              <p className="text-muted-foreground mb-8">
                Nous répondons généralement sous 24h ouvrées.
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <a href="mailto:contact@tomai.fr">contact@tomai.fr</a>
              </Button>
            </div>
          </div>

          {/* Address Card */}
          <div className="group relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 text-center transition-all hover:shadow-2xl hover:border-primary/50 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <MapPin className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Adresse</h3>
              <p className="text-muted-foreground leading-relaxed">
                TomIA SAS<br />
                123 Avenue de l&apos;Innovation<br />
                75001 Paris, France
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
