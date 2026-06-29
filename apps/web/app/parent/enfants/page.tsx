"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { useParentDashboard } from "@/lib/hooks/use-parent-dashboard";
import { ChildrenTable } from "@/components/parent/children-table";
import { AddChildDialog } from "@/components/parent/add-child-dialog";

export default function ParentChildrenPage() {
  const {
    children,
    levels,
    isLoading,
    isError,
    errorMessage,
    isCreating,
    isUpdating,
    isDeleting,
    createChild,
    updateChild,
    deleteChild,
  } = useParentDashboard();

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Mes enfants</h1>
        <Button onClick={() => setAddOpen(true)} disabled={isCreating}>
          Ajouter un enfant
        </Button>
      </div>

      <ChildrenTable
        items={children}
        levels={levels}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        updateChild={updateChild}
        deleteChild={deleteChild}
      />

      <AddChildDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        levels={levels}
        isCreating={isCreating}
        createChild={createChild}
      />
    </div>
  );
}
