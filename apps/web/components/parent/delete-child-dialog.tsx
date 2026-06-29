"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toast,
} from "@repo/ui";
import type { IChild } from "@/lib/hooks/use-parent-dashboard";

type DeleteChildFn = (childId: string) => Promise<unknown>;

interface DeleteChildDialogProps {
  child: IChild | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  deleteChild: DeleteChildFn;
}

export function DeleteChildDialog({
  child,
  open,
  onOpenChange,
  isDeleting,
  deleteChild,
}: DeleteChildDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setServerError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!child) return;
    setServerError(null);
    try {
      await deleteChild(child.id);
      toast.success(
        `Le compte de ${child.firstName} ${child.lastName} a été supprimé`
      );
      handleOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
          <AlertDialogDescription>
            {child ? (
              <>
                Cette action est irréversible. Le compte de{" "}
                <strong>
                  {child.firstName} {child.lastName}
                </strong>{" "}
                sera définitivement supprimé.
              </>
            ) : (
              "Cette action est irréversible."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
