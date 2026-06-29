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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@repo/ui";
import type { IChild } from "@/lib/hooks/use-parent-dashboard";
import {
  validatePassword,
  getLevelLabel,
  type ChildFormInput,
  type SchoolLevelKey,
} from "@/lib/validation/child";

interface Level {
  key: string;
  ragAvailable: boolean;
  subjectsCount: number;
}

type UpdateChildFn = (args: {
  childId: string;
  data: {
    firstName?: string;
    lastName?: string;
    password?: string;
    schoolLevel?: SchoolLevelKey;
    dateOfBirth?: string;
  };
}) => Promise<unknown>;

interface EditChildDialogProps {
  child: IChild | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: Level[];
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
  const [form, setForm] = useState<ChildFormInput>({
    firstName: child?.firstName ?? "",
    lastName: child?.lastName ?? "",
    username: child?.username ?? "",
    password: "",
    dateOfBirth: child?.dateOfBirth ?? "",
    schoolLevel: child?.schoolLevel ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const levelKeys = levels.map((l) => l.key);

  function set<K extends keyof ChildFormInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setErrors({});
      setServerError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!child) return;
    setServerError(null);

    const fieldErrors: Record<string, string> = {};

    if (!form.firstName.trim()) fieldErrors.firstName = "Prénom requis";
    if (!form.lastName.trim()) fieldErrors.lastName = "Nom requis";
    if (!form.dateOfBirth) fieldErrors.dateOfBirth = "Date de naissance requise";

    const effectiveLevel = form.schoolLevel || child.schoolLevel;
    if (levelKeys.length > 0 && !levelKeys.includes(effectiveLevel)) {
      fieldErrors.schoolLevel = "Niveau scolaire invalide";
    }

    if (form.password) {
      const pwErr = validatePassword(form.password);
      if (pwErr) fieldErrors.password = pwErr;
    }

    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      fieldErrors.dateOfBirth = "Format : AAAA-MM-JJ";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    const data: {
      firstName?: string;
      lastName?: string;
      password?: string;
      schoolLevel?: SchoolLevelKey;
      dateOfBirth?: string;
    } = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      schoolLevel: effectiveLevel as SchoolLevelKey,
      dateOfBirth: form.dateOfBirth || undefined,
    };
    if (form.password) data.password = form.password;

    try {
      await updateChild({ childId: child.id, data });
      toast.success(`Profil de ${form.firstName.trim()} mis à jour`);
      handleOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    }
  }

  const effectiveLevel = form.schoolLevel || (child?.schoolLevel ?? "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le profil</DialogTitle>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-firstName">Prénom</Label>
              <Input
                id="edit-firstName"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "edit-firstName-err" : undefined}
              />
              {errors.firstName && (
                <p id="edit-firstName-err" className="text-xs text-destructive">
                  {errors.firstName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-lastName">Nom</Label>
              <Input
                id="edit-lastName"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "edit-lastName-err" : undefined}
              />
              {errors.lastName && (
                <p id="edit-lastName-err" className="text-xs text-destructive">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-password">
              Nouveau mot de passe{" "}
              <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Input
              id="edit-password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              placeholder="Laisser vide pour ne pas changer"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "edit-password-err" : undefined}
            />
            {errors.password && (
              <p id="edit-password-err" className="text-xs text-destructive">
                {errors.password}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-dob">Date de naissance</Label>
              <Input
                id="edit-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                aria-invalid={!!errors.dateOfBirth}
                aria-describedby={errors.dateOfBirth ? "edit-dob-err" : undefined}
              />
              {errors.dateOfBirth && (
                <p id="edit-dob-err" className="text-xs text-destructive">
                  {errors.dateOfBirth}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-level">Niveau scolaire</Label>
              <Select
                value={effectiveLevel}
                onValueChange={(v) => set("schoolLevel", v)}
              >
                <SelectTrigger id="edit-level" aria-invalid={!!errors.schoolLevel}>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.key} value={l.key}>
                      {getLevelLabel(l.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.schoolLevel && (
                <p className="text-xs text-destructive">{errors.schoolLevel}</p>
              )}
            </div>
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
