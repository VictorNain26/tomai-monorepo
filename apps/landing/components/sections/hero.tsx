"use client";

import { GraduationCap } from "lucide-react";
import { HeroMockup } from "../molecules/hero-mockup";
import { RotatingText } from "../atoms/rotating-text";
import { WaitlistForm } from "../molecules/waitlist-form";

export function Hero() {
  return (
    <section className="min-h-[calc(100vh-4rem)] flex flex-col py-12 lg:py-0">
      <div className="container flex-1 flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          {/* Left Column: Copy + CTA */}
          <div className="text-center lg:text-left">
            {/* Credibility badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <GraduationCap className="h-4 w-4" />
              <span>Du CP à la Terminale — 415 programmes Éduscol</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              L&apos;IA qui aide à{" "}
              <RotatingText words={["comprendre", "réfléchir", "progresser", "réussir"]} />
              ,
              <br />
              pas à copier
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 mb-4">
              TomIA pose les bonnes questions pour que votre enfant trouve les réponses par lui-même et gagne en confiance et en autonomie.
            </p>

            <p className="text-sm font-medium text-primary mb-6">
              L&apos;app arrive bientôt — inscrivez-vous pour être notifié
            </p>

            <WaitlistForm source="hero" className="max-w-lg mx-auto lg:mx-0" />
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
