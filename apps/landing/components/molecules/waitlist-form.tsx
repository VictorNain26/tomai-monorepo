"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Info, Loader2, ArrowRight } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { joinWaitlist } from "@/lib/actions/waitlist";

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
  const [status, setStatus] = useState<"idle" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn("flex items-center gap-2 text-success font-medium", className)}
      >
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        <span>Vous serez notifié du lancement !</span>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className={cn("flex items-center gap-2 text-primary font-medium", className)}>
        <Info className="h-5 w-5" />
        <span>Cet email est déjà dans la liste d&apos;attente, vous serez notifié !</span>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    startTransition(async () => {
      const result = await joinWaitlist(email, source);
      if (result.success && result.alreadyExists) {
        setStatus("already");
      } else if (result.success) {
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
        <label htmlFor="waitlist-email" className="sr-only">
          Adresse e-mail
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={status === "error" ? "waitlist-error" : undefined}
          className="h-12 flex-1 rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="lg" disabled={isPending} aria-busy={isPending} className="group">
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Chargement…</span>
            </>
          ) : (
            <>
              {buttonText}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
      {status === "error" && (
        <p id="waitlist-error" role="alert" className="text-sm text-destructive">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
