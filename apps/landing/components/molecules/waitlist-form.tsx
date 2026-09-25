"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button, Input, cn } from "@repo/ui";
import { joinWaitlist } from "@/lib/actions/waitlist";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistFormProps {
  source: string;
  className?: string;
  buttonText?: string;
  tone?: "default" | "inverted";
}

export function WaitlistForm({
  source,
  className,
  buttonText = "Rejoindre la liste d'attente",
  tone = "default",
}: WaitlistFormProps) {
  const [status, setStatus] = useState<"idle" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = `waitlist-email-${source}`;
  const errorId = `waitlist-error-${source}`;

  if (status === "success" || status === "already") {
    const Icon = status === "success" ? CheckCircle2 : Info;
    return (
      <div role="status" aria-live="polite" className={cn("flex items-center gap-2 font-medium", className)}>
        <Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
        <span>
          {status === "success"
            ? "C'est noté, vous serez prévenu du lancement."
            : "Cet email est déjà inscrit, vous serez prévenu du lancement."}
        </span>
      </div>
    );
  }

  function showError(message: string) {
    setStatus("error");
    setErrorMsg(message);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const email = e.currentTarget.value;
    if (email && !EMAIL_REGEX.test(email)) showError("Adresse email invalide");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg("");
    const email = new FormData(e.currentTarget).get("email");
    startTransition(async () => {
      const result = await joinWaitlist(typeof email === "string" ? email : "", source);
      if (!result.success) showError(result.error);
      else setStatus(result.alreadyExists ? "already" : "success");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Adresse e-mail
        </label>
        {/* Uncontrolled: a controlled value would overwrite what the visitor typed before hydration. */}
        <Input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="votre@email.fr"
          onChange={() => {
            if (status === "error") setStatus("idle");
          }}
          onBlur={handleBlur}
          variant={status === "error" ? "error" : "default"}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? errorId : undefined}
          className={cn(
            "h-12 rounded-full px-5 text-base sm:flex-1",
            tone === "inverted" && "border-background/30 bg-background text-foreground",
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          aria-busy={isPending}
          className={cn("group", tone === "inverted" && "bg-background text-foreground hover:bg-background/90")}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span className="sr-only">Envoi en cours</span>
            </>
          ) : (
            <>
              {buttonText}
              <ArrowRight className="transition-transform duration-base group-hover:translate-x-1" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
      {status === "error" && (
        <p id={errorId} role="alert" className={cn("text-sm", tone === "inverted" ? "text-background" : "text-destructive")}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
