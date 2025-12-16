/**
 * CreateChildModal - Version refactorisée Tom 2025
 * ✅ Respecte standards shadcn/ui + Tom CLAUDE.md
 * ✅ UX simplifiée : 1 écran au lieu de 3 steps complexes
 * ✅ TypeScript strict + ESLint zero warnings
 * ✅ Better Auth + TanStack Query patterns
 */

import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parentMutations, invalidationHelpers } from '@/lib/query-factories';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { getSchoolLevelOptions } from '@/constants/schoolLevels';
import { generateUsername } from '@/utils/generateUsername';
import { Lv2Selector } from '../Lv2Selector';
import type { Lv2Option } from '@/types';

interface CreateChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Génère un nombre aléatoire cryptographiquement sécurisé entre 0 et max (exclus)
 */
const getSecureRandomInt = (max: number): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
};

const generatePassword = (): string => {
  const adjectives = ['Super', 'Cool', 'Brave', 'Smart', 'Happy', 'Magic'];
  const nouns = ['Lion', 'Chat', 'Ours', 'Etoile', 'Soleil', 'Lune'];
  const adjective = adjectives[getSecureRandomInt(adjectives.length)];
  const noun = nouns[getSecureRandomInt(nouns.length)];
  const number = getSecureRandomInt(89) + 10; // 10-99
  return `${adjective}${noun}${number}!`;
};

const CreateChildModal: React.FC<CreateChildModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    schoolLevel: string;
    selectedLv2: Lv2Option | null;
    username: string;
    password: string;
  }>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    schoolLevel: '',
    selectedLv2: null,
    username: '',
    password: ''
  });

  // Removed subject selection - all subjects now available via RAG system

  // Focus management (accessibility)
  useEffect(() => {
    if (!isOpen || !firstInputRef.current) return;

    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const createChildMutation = useMutation({
    ...parentMutations.createChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);

      toast.success('🎉 Compte créé avec succès !', {
        description: `${formData.firstName} peut maintenant utiliser Tom.`
      });

      onSuccess();
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du compte');
    }
  });

  const handleClose = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      schoolLevel: '',
      selectedLv2: null,
      username: '',
      password: ''
    });
    // Subject selection removed - using RAG system
    onClose();
  };

  // Form validation
  const isFormValid =
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.dateOfBirth &&
    formData.schoolLevel &&
    formData.username.trim() &&
    formData.password.trim();

  const generateCredentials = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Saisissez d\'abord le prénom et le nom');
      return;
    }
    const username = generateUsername(formData.firstName, formData.lastName);
    const password = generatePassword();
    setFormData(prev => ({ ...prev, username, password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      toast.error('Tous les champs requis doivent être remplis');
      return;
    }

    await createChildMutation.mutateAsync({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      dateOfBirth: formData.dateOfBirth,
      schoolLevel: formData.schoolLevel,
      selectedLv2: formData.selectedLv2,
      username: formData.username.trim(),
      password: formData.password
      // subjects removed - all subjects available via RAG system
    });
  };

  const schoolLevels = getSchoolLevelOptions('only-cinquieme');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Créer un compte enfant
          </DialogTitle>
          <DialogDescription>
            Ajoutez un nouvel enfant à votre compte famille Tom
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form id="create-child-form" onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-6">
            {/* Informations personnelles */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    ref={firstInputRef}
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Prénom de l'enfant"
                    disabled={createChildMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Nom de famille"
                    disabled={createChildMutation.isPending}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    disabled={createChildMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolLevel">Niveau scolaire *</Label>
                  <Select
                    value={formData.schoolLevel}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, schoolLevel: value }))}
                    disabled={createChildMutation.isPending}
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
              <Lv2Selector
                schoolLevel={formData.schoolLevel}
                selectedLv2={formData.selectedLv2}
                onLv2Change={(lv2) => setFormData(prev => ({ ...prev, selectedLv2: lv2 }))}
                disabled={createChildMutation.isPending}
              />
            </div>

            {/* Identifiants de connexion */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-medium">Identifiants de connexion</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateCredentials}
                  disabled={createChildMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Générer
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="username123"
                    className="font-mono"
                    disabled={createChildMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="SuperChat42!"
                    className="font-mono"
                    disabled={createChildMutation.isPending}
                  />
                </div>
              </div>
            </div>
          </form>
        </ScrollArea>

        {/* Footer fixe avec boutons d'action */}
        <DialogFooter className="flex-shrink-0 flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createChildMutation.isPending}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="create-child-form"
            disabled={!isFormValid || createChildMutation.isPending}
            className="w-full sm:w-auto"
          >
            {createChildMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Créer le compte
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChildModal;
