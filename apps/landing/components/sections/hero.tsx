import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppRoutes } from "@/lib/urls";

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center pt-12 pb-16 md:pt-0 md:pb-0 overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-primary/20 rounded-full blur-[100px] opacity-50 animate-pulse" />
        <div className="absolute top-[30%] right-[10%] w-96 h-96 bg-blue-400/10 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="container relative z-10 px-4 mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy */}
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 backdrop-blur-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Conforme aux programmes 2024-2025
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl xl:text-6xl mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              L&apos;assistant scolaire qui <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-primary">
                fait réfléchir votre enfant
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Un tuteur IA bienveillant qui guide l&apos;élève vers la solution sans jamais donner la réponse. <br className="hidden sm:block" />
              <span className="font-medium text-foreground">Inscription gratuite, essai inclus dans le tableau de bord.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <Link href={AppRoutes.register} className="w-full sm:w-auto">
                <Button size="xl" className="w-full sm:w-auto min-w-[200px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  Créer un compte gratuit
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto">
                <Button variant="outline" size="xl" className="w-full sm:w-auto min-w-[200px] bg-background/50 backdrop-blur-sm hover:bg-secondary/50">
                  Découvrir la méthode
                </Button>
              </Link>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-12 duration-700 delay-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Données sécurisées en France</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Programme Éducation Nationale</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Mockup */}
          <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none animate-in fade-in slide-in-from-right-8 duration-1000 delay-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-blue-600/30 rounded-2xl blur-lg opacity-50" />
            <div className="relative bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden">
              {/* Window Controls */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="ml-4 text-xs font-medium text-muted-foreground/70">TomIA - Assistant Mathématiques</div>
              </div>

              {/* Chat Content */}
              <div className="p-6 space-y-6 text-left">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md">
                    <p className="text-sm">Je ne comprends pas comment calculer l&apos;hypoténuse...</p>
                  </div>
                </div>

                {/* AI Message */}
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[90%]">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0 shadow-lg">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-secondary/80 backdrop-blur-sm px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-border/50">
                      <p className="text-sm text-foreground">Pas de panique ! Commençons par le début. Te souviens-tu de la condition principale pour utiliser le théorème de Pythagore ? 🤔</p>
                    </div>
                  </div>
                </div>

                {/* User Reply (Typing) */}
                <div className="flex justify-end">
                  <div className="bg-primary/10 text-primary px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] border border-primary/20">
                    <p className="text-sm">C&apos;est quand le triangle est rectangle ?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
