"use client";

import { BookOpen } from "lucide-react";
import { WaitlistForm } from "../molecules/waitlist-form";

export function CTA() {
  return (
    <section id="waitlist" className="py-24">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-primary/10 via-violet/10 to-transparent p-12 sm:p-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Soyez parmi les{" "}
            <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">premiers à l&apos;essayer</span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            L&apos;application arrive bientôt sur iOS et Android. Inscrivez-vous pour être notifié du lancement.
          </p>

          <div className="flex flex-col items-center gap-6">
            <WaitlistForm
              source="cta-bottom"
              buttonText="Rejoindre la liste d'attente"
              className="max-w-lg w-full"
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Conforme aux programmes de l&apos;Éducation nationale</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
