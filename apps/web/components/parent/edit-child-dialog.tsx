"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@repo/ui";
import type { IChild, SchoolLevel } from "@/lib/hooks/use-parent-dashboard";
import { getLevelLabel, type SchoolLevelKey } from "@/lib/validation/child";

type UpdateChildFn = (args: {
  childId: string;
  data: { schoolLevel: SchoolLevelKey };
}) => Promise<unknown>;

interface EditChildDialogProps {
  child: IChild | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: SchoolLevel[];
  isUpdating: boolean;
  updateChild: UpdateChildFn;
}

export function EditChildDialog({
  child,
  open,
  onOpenChange,
  levels,
  isUpdating,
  updateChild,
}: EditChildDialogProps) {
  const [schoolLevel, setSchoolLevel] = useState(child?.schoolLevel ?? "");
  const [levelError, setLevelError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const levelKeys = levels.map((l) => l.key);
  // The child's current level may not be ragAvailable (e.g. level added before
  // RAG support). We still accept it to avoid blocking edits on unchanged data.
  const currentLevelMissing =
    !!child?.schoolLevel &&
    !(levelKeys as string[]).includes(child.schoolLevel);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setLevelError(undefined);
      setServerError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!child) return;
    setServerError(null);

    const effective = schoolLevel || child.schoolLevel;
    const allowedKeys: string[] = [
      ...levelKeys,
      ...(child.schoolLevel ? [child.schoolLevel] : []),
    ];
    if (allowedKeys.length > 0 && !allowedKeys.includes(effective)) {
      setLevelError("Niveau scolaire invalide");
      return;
    }
    setLevelError(undefined);

    try {
      await updateChild({ childId: child.id, data: { schoolLevel: effective as SchoolLevelKey } });
      toast.success(`Niveau de ${child.firstName} mis à jour`);
      handleOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    }
  }

  const effective = schoolLevel || (child?.schoolLevel ?? "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier le niveau scolaire</DialogTitle>
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
            <Label htmlFor="edit-level">Niveau scolaire</Label>
            <Select
              value={effective}
              onValueChange={(v) => {
                setSchoolLevel(v);
                if (levelError) setLevelError(undefined);
              }}
            >
              <SelectTrigger
                id="edit-level"
                aria-invalid={!!levelError}
                aria-describedby={levelError ? "edit-level-err" : undefined}
              >
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {currentLevelMissing && child?.schoolLevel && (
                  <SelectItem
                    key={child.schoolLevel}
                    value={child.schoolLevel}
                  >
                    {getLevelLabel(child.schoolLevel as SchoolLevelKey)}
                  </SelectItem>
                )}
                {levels.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {getLevelLabel(l.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {levelError && (
              <p id="edit-level-err" className="text-xs text-destructive">
                {levelError}
              </p>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
