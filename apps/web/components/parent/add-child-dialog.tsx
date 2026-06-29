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
import type { ICreateChildData, SchoolLevel } from "@/lib/hooks/use-parent-dashboard";
import {
  validateChildForm,
  getLevelLabel,
  type ChildFormInput,
} from "@/lib/validation/child";

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: SchoolLevel[];
  isCreating: boolean;
  createChild: (data: ICreateChildData) => Promise<unknown>;
}

const EMPTY_FORM: ChildFormInput = {
  firstName: "",
  lastName: "",
  username: "",
  password: "",
  dateOfBirth: "",
  schoolLevel: "",
};

export function AddChildDialog({
  open,
  onOpenChange,
  levels,
  isCreating,
  createChild,
}: AddChildDialogProps) {
  const [form, setForm] = useState<ChildFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const levelKeys = levels.map((l) => l.key);
  const defaultLevel = levelKeys[0] ?? "";

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
      setForm(EMPTY_FORM);
      setErrors({});
      setServerError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const input: ChildFormInput = {
      ...form,
      schoolLevel: form.schoolLevel || defaultLevel,
    };

    const result = validateChildForm(input, levelKeys);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    try {
      await createChild(result.data);
      toast.success(`${result.data.firstName} ${result.data.lastName} ajouté`);
      handleOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un enfant</DialogTitle>
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
              <Label htmlFor="add-firstName">Prénom</Label>
              <Input
                id="add-firstName"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder="Alice"
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "add-firstName-err" : undefined}
              />
              {errors.firstName && (
                <p id="add-firstName-err" className="text-xs text-destructive">
                  {errors.firstName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-lastName">Nom</Label>
              <Input
                id="add-lastName"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder="Dupont"
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "add-lastName-err" : undefined}
              />
              {errors.lastName && (
                <p id="add-lastName-err" className="text-xs text-destructive">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-username">Identifiant</Label>
            <Input
              id="add-username"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="alice.dupont"
              autoComplete="username"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "add-username-err" : undefined}
            />
            {errors.username && (
              <p id="add-username-err" className="text-xs text-destructive">
                {errors.username}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-password">Mot de passe</Label>
            <Input
              id="add-password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "add-password-err" : undefined}
            />
            {errors.password && (
              <p id="add-password-err" className="text-xs text-destructive">
                {errors.password}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-dob">Date de naissance</Label>
              <Input
                id="add-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                aria-invalid={!!errors.dateOfBirth}
                aria-describedby={errors.dateOfBirth ? "add-dob-err" : undefined}
              />
              {errors.dateOfBirth && (
                <p id="add-dob-err" className="text-xs text-destructive">
                  {errors.dateOfBirth}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-level">Niveau scolaire</Label>
              <Select
                value={form.schoolLevel || defaultLevel}
                onValueChange={(v) => set("schoolLevel", v)}
              >
                <SelectTrigger
                  id="add-level"
                  aria-invalid={!!errors.schoolLevel}
                  aria-describedby={errors.schoolLevel ? "add-level-err" : undefined}
                >
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
                <p id="add-level-err" className="text-xs text-destructive">
                  {errors.schoolLevel}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Création…" : "Créer le profil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
