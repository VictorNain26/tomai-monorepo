"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";
import { HeroMockup } from "../molecules/hero-mockup";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="min-h-[calc(100vh-4rem)] flex flex-col py-12 lg:py-0">
      <div className="container flex-1 flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          {/* Left Column: Copy + CTA */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              L&apos;IA qui aide à{" "}
              <span className="text-primary">comprendre</span>,
              <br />
              pas à copier
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              Tom guide la réflexion de votre enfant au lieu de donner les réponses. Il comprend vraiment et gagne en autonomie.
            </p>

            {/* CTA Button */}
            <div className="flex justify-center lg:justify-start">
              <Link href={APP_URL}>
                <Button size="lg" className="group">
                  Commencer gratuitement
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-6">
        <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
      </div>
    </section>
  );
}
