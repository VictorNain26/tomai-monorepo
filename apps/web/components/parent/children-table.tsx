"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { IChild, SchoolLevel } from "@/lib/hooks/use-parent-dashboard";
import { getLevelLabel, type SchoolLevelKey } from "@/lib/validation/child";
import { EditChildDialog } from "./edit-child-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { DeleteChildDialog } from "./delete-child-dialog";

type UpdateChildFn = (args: {
  childId: string;
  data: {
    password?: string;
    schoolLevel?: SchoolLevelKey;
  };
}) => Promise<unknown>;

type DeleteChildFn = (childId: string) => Promise<unknown>;

interface ChildrenTableProps {
  items: IChild[];
  levels: SchoolLevel[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  isUpdating: boolean;
  isDeleting: boolean;
  updateChild: UpdateChildFn;
  deleteChild: DeleteChildFn;
}

export function ChildrenTable({
  items,
  levels,
  isLoading,
  isError,
  errorMessage,
  isUpdating,
  isDeleting,
  updateChild,
  deleteChild,
}: ChildrenTableProps) {
  const [editChild, setEditChild] = useState<IChild | null>(null);
  const [resetChild, setResetChild] = useState<IChild | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IChild | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement…">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage ?? "Impossible de charger les enfants."}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun enfant associé à ce compte.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Enfant</TableHead>
            <TableHead>Identifiant</TableHead>
            <TableHead>Niveau</TableHead>
            <TableHead>Date de naissance</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((child) => (
            <TableRow key={child.id}>
              <TableCell className="font-medium">
                {child.firstName} {child.lastName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                @{child.username}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{getLevelLabel(child.schoolLevel)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {child.dateOfBirth ?? "—"}
              </TableCell>
              <TableCell>
                {child.isActive ? (
                  <Badge variant="default">Actif</Badge>
                ) : (
                  <Badge variant="outline">Inactif</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditChild(child)}
                    disabled={isUpdating || isDeleting}
                    aria-label={`Modifier le profil de ${child.firstName} ${child.lastName}`}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetChild(child)}
                    disabled={isUpdating || isDeleting}
                    aria-label={`Réinitialiser le mot de passe de ${child.firstName} ${child.lastName}`}
                  >
                    Mot de passe
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTarget(child)}
                    disabled={isUpdating || isDeleting}
                    aria-label={`Supprimer le compte de ${child.firstName} ${child.lastName}`}
                  >
                    Supprimer
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EditChildDialog
        key={editChild?.id ?? "edit-none"}
        child={editChild}
        open={editChild !== null}
        onOpenChange={(open) => { if (!open) setEditChild(null); }}
        levels={levels}
        isUpdating={isUpdating}
        updateChild={updateChild}
      />
      <ResetPasswordDialog
        child={resetChild}
        open={resetChild !== null}
        onOpenChange={(open) => { if (!open) setResetChild(null); }}
        isUpdating={isUpdating}
        updateChild={updateChild}
      />
      <DeleteChildDialog
        child={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        isDeleting={isDeleting}
        deleteChild={deleteChild}
      />
    </>
  );
}
