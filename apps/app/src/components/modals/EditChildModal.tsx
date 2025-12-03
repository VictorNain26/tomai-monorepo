/**
 * EditChildModal - Version refactorisée Tom 2025
 * ✅ Respecte standards shadcn/ui + Tom CLAUDE.md
 * ✅ UI simplifiée sans over-engineering
 * ✅ TypeScript strict + ESLint zero warnings
 * ✅ Better Auth + TanStack Query patterns optimisés
 */

import React, { useState, useEffect } from 'react';
import { User, Calendar, GraduationCap, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parentMutations, invalidationHelpers } from "@/lib/query-factories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { getSchoolLevelOptions } from '@/constants/schoolLevels';
import { Lv2Selector } from '../Lv2Selector';
import type { IChild, Lv2Option } from '@/types';

interface EditChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: IChild;
  onSuccess: () => void;
}

const EditChildModal: React.FC<EditChildModalProps> = ({
  isOpen,
  onClose,
  child,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    schoolLevel: string;
    selectedLv2: Lv2Option | null;
  }>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    schoolLevel: '',
    selectedLv2: null
  });

  // Removed subject selection - all subjects now available via RAG system

  useEffect(() => {
    if (child && isOpen) {
      setFormData({
        firstName: child.firstName ?? '',
        lastName: child.lastName ?? '',
        dateOfBirth: child.dateOfBirth ?? '',
        schoolLevel: child.schoolLevel ?? '',
        selectedLv2: child.selectedLv2 ?? null
      });
    }
  }, [child, isOpen]);

  // Removed subject selection effect - all subjects now available via RAG system

  const updateChildMutation = useMutation({
    ...parentMutations.updateChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('✅ Profil mis à jour avec succès !');
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur: ${error.message || 'Échec de la mise à jour'}`);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim() ||
        !formData.dateOfBirth || !formData.schoolLevel) {
      toast.error('Tous les champs obligatoires sont requis');
      return;
    }

    try {
      await updateChildMutation.mutateAsync({
        childId: child.id,
        data: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          dateOfBirth: formData.dateOfBirth,
          schoolLevel: formData.schoolLevel,
          selectedLv2: formData.selectedLv2
        }
      });

      // Removed subject comparison logic - all subjects now available via RAG system

    } catch {
      // Erreurs gérées par les mutations
    }
  };

  const isLoading = updateChildMutation.isPending;
  const isFormValid = formData.firstName.trim() && formData.lastName.trim() &&
                     formData.dateOfBirth && formData.schoolLevel;

  const schoolLevels = getSchoolLevelOptions('only-cinquieme');

  return (
    <Dialog open={isOpen} onOpenChange={isLoading ? () => {} : onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Modifier le profil de {child?.firstName}
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations personnelles et les préférences de matières de votre enfant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations personnelles
            </Label>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Prénom de l'enfant"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom de famille *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Nom de famille"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date de naissance *
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolLevel" className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Niveau scolaire *
                </Label>
                <Select
                  value={formData.schoolLevel}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, schoolLevel: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir le niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* LV2 Selection - apparaît uniquement pour 5ème+ */}
            <div className="col-span-full">
              <Lv2Selector
                schoolLevel={formData.schoolLevel}
                selectedLv2={formData.selectedLv2}
                onLv2Change={(lv2) => setFormData(prev => ({ ...prev, selectedLv2: lv2 }))}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Identifiant de connexion */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <span className="text-xl">@</span>
              Identifiant de connexion
            </Label>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <span className="font-mono text-lg font-semibold">
                {child.username}
              </span>
              <Badge variant="outline">
                Non modifiable
              </Badge>
            </div>
          </div>

          {/* All subjects now available automatically via RAG system */}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditChildModal;
