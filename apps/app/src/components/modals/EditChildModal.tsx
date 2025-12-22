/**
 * EditChildModal - Formulaire modification enfant
 * Reset automatique LV2 si niveau non éligible
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User, Calendar, GraduationCap, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentMutations, invalidationHelpers, educationQueries } from '@/lib/query-factories';
import { SCHOOL_LEVELS, CYCLES } from '@/constants/schoolLevels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Lv2Selector } from '../Lv2Selector';
import { isLv2EligibleLevel, type IChild, type Lv2Option } from '@/types';

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

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    schoolLevel: '',
    selectedLv2: null as Lv2Option | null
  });

  // Charger données enfant à l'ouverture
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

  // Niveaux scolaires depuis Qdrant
  const { data: levelsData, isLoading: isLoadingLevels } = useQuery(educationQueries.levels());

  // Grouper niveaux par cycle (Primaire, Collège, Lycée)
  const levelGroups = useMemo(() => {
    if (!levelsData?.levels) return [];

    const ragLevels = levelsData.levels
      .filter((l) => l.ragAvailable)
      .map((l) => l.key);

    return Object.entries(CYCLES).map(([, cycle]) => ({
      name: cycle.name,
      levels: cycle.levels
        .filter((lvl) => ragLevels.includes(lvl))
        .map((lvl) => ({
          value: lvl,
          label: SCHOOL_LEVELS[lvl]?.description ?? lvl,
        })),
    })).filter((g) => g.levels.length > 0);
  }, [levelsData?.levels]);

  // Reset LV2 automatiquement si niveau non éligible
  useEffect(() => {
    if (formData.schoolLevel && !isLv2EligibleLevel(formData.schoolLevel) && formData.selectedLv2) {
      setFormData(prev => ({ ...prev, selectedLv2: null }));
    }
  }, [formData.schoolLevel, formData.selectedLv2]);

  const updateChildMutation = useMutation({
    ...parentMutations.updateChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('✅ Profil mis à jour avec succès !');
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message || 'Échec de la mise à jour'}`);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim() ||
        !formData.dateOfBirth || !formData.schoolLevel) {
      toast.error('Tous les champs obligatoires sont requis');
      return;
    }

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
  };

  const isLoading = updateChildMutation.isPending || isLoadingLevels;
  const isFormValid = formData.firstName.trim() && formData.lastName.trim() &&
                     formData.dateOfBirth && formData.schoolLevel;

  return (
    <Dialog open={isOpen} onOpenChange={isLoading ? () => {} : onClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Modifier le profil de {child?.firstName}
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations personnelles de votre enfant.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form id="edit-child-form" onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-6">
            {/* Informations personnelles */}
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Informations personnelles
              </Label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
                      {isLoadingLevels ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement...
                        </span>
                      ) : (
                        <SelectValue placeholder="Choisir le niveau" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {levelGroups.map((group) => (
                        <SelectGroup key={group.name}>
                          <SelectLabel>{group.name}</SelectLabel>
                          {group.levels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* LV2 - Apparaît uniquement pour 5ème+ */}
              <Lv2Selector
                schoolLevel={formData.schoolLevel}
                selectedLv2={formData.selectedLv2}
                onLv2Change={(lv2) => setFormData(prev => ({ ...prev, selectedLv2: lv2 }))}
                disabled={isLoading}
              />
            </div>

            {/* Identifiant de connexion (non modifiable) */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">@</span>
                Identifiant de connexion
              </Label>

              <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <span className="font-mono text-base font-semibold sm:text-lg">
                  {child.username}
                </span>
                <Badge variant="outline" className="w-fit">
                  Non modifiable
                </Badge>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="edit-child-form"
            disabled={!isFormValid || isLoading}
            className="w-full sm:w-auto"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditChildModal;
