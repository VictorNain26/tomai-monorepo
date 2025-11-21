import { MessageCircle } from "lucide-react";

export function HeroMockup() {
  return (
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
  );
}
