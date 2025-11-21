import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parentMutations, invalidationHelpers } from "@/lib/query-factories";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import type { IChild } from '@/types';

interface DeleteChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: IChild;
  onDelete: () => void;
}

export default function DeleteChildModal({
  isOpen,
  onClose,
  child,
  onDelete
}: DeleteChildModalProps) {
  const queryClient = useQueryClient();

  const deleteChildMutation = useMutation({
    ...parentMutations.deleteChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('Compte supprimé avec succès');
      onDelete();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Impossible de supprimer le compte');
    }
  });

  const handleDelete = async () => {
    await deleteChildMutation.mutateAsync(child.id);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-foreground">
              Supprimer {child?.firstName}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Êtes-vous sûr de vouloir supprimer le compte de <strong>{child?.firstName} {child?.lastName}</strong> ?
                Cette action ne peut pas être annulée.
              </p>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Les données suivantes seront supprimées définitivement :</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                    <li>Toutes les conversations et sessions d'apprentissage</li>
                    <li>L'historique des progrès et statistiques</li>
                    <li>Les préférences et paramètres personnalisés</li>
                    <li>Les données de connexion (username: <span className="font-mono">{child.username}</span>)</li>
                  </ul>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteChildMutation.isPending}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteChildMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteChildMutation.isPending ? (
              <>
                <Trash2 className="w-4 h-4 mr-2 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
