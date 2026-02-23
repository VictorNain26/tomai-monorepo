"use client";

import { GraduationCap, ShieldCheck } from "lucide-react";
import { RotatingText } from "../atoms/rotating-text";
import { WaitlistForm } from "../molecules/waitlist-form";

export function Hero() {
  return (
    <section className="min-h-[calc(100vh-4rem)] flex items-center py-16 lg:py-24">
      <div className="container flex flex-col items-center text-center">
        {/* Credibility badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <GraduationCap className="h-4 w-4" />
          <span>Conforme aux programmes de l&apos;Éducation nationale</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-foreground leading-[1.15] mb-6 max-w-4xl [text-wrap:balance]">
          L&apos;IA qui aide à
          <br />
          <RotatingText
            words={["comprendre", "réfléchir", "progresser", "réussir"]}
          />
          ,
          <br />
          pas à copier
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mb-10">
          TomIA pose les bonnes questions pour que votre enfant trouve les
          réponses par lui-même.
        </p>

        <WaitlistForm source="hero" className="max-w-lg w-full" />

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            <span>RGPD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🇫🇷</span>
            <span>Hébergé en France</span>
          </div>
          <span>Sans carte bancaire</span>
        </div>
      </div>
    </section>
  );
}
