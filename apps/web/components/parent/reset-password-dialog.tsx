"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@repo/ui";
import type { IChild } from "@/lib/hooks/use-parent-dashboard";
import { validatePassword } from "@/lib/validation/child";

type UpdateChildFn = (args: {
  childId: string;
  data: { password: string };
}) => Promise<unknown>;

interface ResetPasswordDialogProps {
  child: IChild | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUpdating: boolean;
  updateChild: UpdateChildFn;
}

export function ResetPasswordDialog({
  child,
  open,
  onOpenChange,
  isUpdating,
  updateChild,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPassword("");
      setFieldError(undefined);
      setServerError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!child) return;
    setServerError(null);

    const err = validatePassword(password);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(undefined);

    try {
      await updateChild({ childId: child.id, data: { password } });
      toast.success(`Mot de passe de ${child.firstName} réinitialisé`);
      handleOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Une erreur est survenue."
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Réinitialiser le mot de passe
            {child ? ` de ${child.firstName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {serverError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">Nouveau mot de passe</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError) setFieldError(undefined);
              }}
              autoComplete="new-password"
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "reset-password-err" : undefined}
            />
            {fieldError && (
              <p id="reset-password-err" className="text-xs text-destructive">
                {fieldError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Enregistrement…" : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
