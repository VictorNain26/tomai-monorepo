"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinWaitlist } from "@/lib/actions/waitlist";
import { cn } from "@/lib/utils";

interface WaitlistFormProps {
  source: string;
  className?: string;
  buttonText?: string;
}

export function WaitlistForm({
  source,
  className,
  buttonText = "Rejoindre la liste d'attente",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  if (status === "success") {
    return (
      <div className={cn("flex items-center gap-2 text-green-600 dark:text-green-400 font-medium", className)}>
        <CheckCircle2 className="h-5 w-5" />
        <span>Vous serez notifié du lancement !</span>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    startTransition(async () => {
      const result = await joinWaitlist(email, source);
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Une erreur est survenue");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 flex-1 rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="lg" disabled={isPending} className="group">
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {buttonText}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
      {status === "error" && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}
    </form>
  );
}
