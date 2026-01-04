/**
 * CreateChildModal - Formulaire création enfant
 * Adapté au système scolaire français :
 * - Niveaux groupés par cycle (Primaire/Collège/Lycée)
 * - LV2 uniquement à partir de la 5ème (reset auto si niveau change)
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserPlus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentMutations, invalidationHelpers, educationQueries } from '@/lib/query-factories';
import { SCHOOL_LEVELS, CYCLES } from '@/constants/schoolLevels';
import { BaseModal } from '../shared/BaseModal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { generateUsername } from '@/utils/generateUsername';
import { Lv2Selector } from '../Lv2Selector';
import { isLv2EligibleLevel, type Lv2Option } from '@/types';

interface CreateChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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
  const number = getSecureRandomInt(89) + 10;
  return `${adjective}${noun}${number}!`;
};

const CreateChildModal: React.FC<CreateChildModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    schoolLevel: '',
    selectedLv2: null as Lv2Option | null,
    username: '',
    password: ''
  });

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

  // Focus premier champ à l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => firstInputRef.current?.focus(), 100);
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
    onClose();
  };

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
    });
  };

  const titleElement = (
    <>
      <UserPlus className="h-5 w-5" />
      Créer un compte enfant
    </>
  );

  const footerElement = (
    <>
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
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={titleElement}
      description="Ajoutez un nouvel enfant à votre compte famille Tom"
      footer={footerElement}
      preventClose={createChildMutation.isPending}
      noPadding
    >
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
                disabled={createChildMutation.isPending || isLoadingLevels}
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
    </BaseModal>
  );
};

export default CreateChildModal;
