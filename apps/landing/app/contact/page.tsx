import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@repo/ui";
import { Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <PageLayout
      title="Contactez-nous"
      description="Une question ? Une suggestion ? Notre équipe est là pour vous aider."
      maxWidth="5xl"
    >
      <div className="grid md:grid-cols-2 gap-8 mt-12">
        {/* Email Card */}
        <div className="group rounded-2xl border border-border bg-card p-8 text-center transition-colors duration-base hover:border-primary">
          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Par email</h3>
            <p className="text-muted-foreground mb-8">
              Nous répondons généralement sous 24h ouvrées.
            </p>
            <Button asChild size="lg">
              <a href="mailto:contact@tomai.fr">contact@tomai.fr</a>
            </Button>
          </div>
        </div>

        {/* Location Card */}
        <div className="group rounded-2xl border border-border bg-card p-8 text-center transition-colors duration-base hover:border-primary">
          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
              <MapPin className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Localisation</h3>
            <p className="text-muted-foreground leading-relaxed">
              France
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
