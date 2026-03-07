/**
 * CreateChildModal Component
 *
 * Full-screen modal for creating a new child account.
 * Adapted from web version for React Native.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { X, UserPlus, RefreshCw, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useIconColors } from '@/hooks';
import { getLevelLabel } from '@/constants/levels';
import type { ICreateChildData, SchoolLevel } from '@/hooks/useParentDashboard';
import { LevelPickerModal } from './LevelPickerModal';

// ============================================================================
// HELPERS
// ============================================================================

function generateUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  const num = Math.floor(Math.random() * 900) + 100;
  return `${clean(firstName)}${clean(lastName).charAt(0)}${num}`;
}

function generatePassword(): string {
  const adjectives = ['Super', 'Cool', 'Brave', 'Smart', 'Happy', 'Magic'];
  const nouns = ['Lion', 'Chat', 'Ours', 'Etoile', 'Soleil', 'Lune'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 89) + 10;
  return `${adj}${noun}${num}!`;
}

// ============================================================================
// PROPS
// ============================================================================

interface CreateChildModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ICreateChildData) => Promise<void>;
  isSubmitting: boolean;
  levels: SchoolLevel[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateChildModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  levels,
}: CreateChildModalProps) {
  const toast = useToast();
  const iconColors = useIconColors();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const isFormValid =
    firstName.trim() &&
    lastName.trim() &&
    dateOfBirth.trim() &&
    schoolLevel &&
    username.trim() &&
    password.trim();

  const resetForm = useCallback(() => {
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setSchoolLevel('');
    setUsername('');
    setPassword('');
  }, []);

  const handleGenerateCredentials = useCallback(() => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.warning('Attention', 'Saisissez d\'abord le prénom et le nom');
      return;
    }
    setUsername(generateUsername(firstName, lastName));
    setPassword(generatePassword());
  }, [firstName, lastName, toast]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      password: password.trim(),
      schoolLevel: schoolLevel as ICreateChildData['schoolLevel'],
      dateOfBirth: dateOfBirth.trim(),
    });

    // Reset form on success (onClose will be called by parent)
    resetForm();
  }, [
    isFormValid,
    firstName,
    lastName,
    username,
    password,
    schoolLevel,
    dateOfBirth,
    onSubmit,
    resetForm,
  ]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const selectedLevelLabel = schoolLevel ? getLevelLabel(schoolLevel) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              className="p-2"
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <X color={iconColors.muted} size={24} />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="text-lg font-semibold">Créer un compte enfant</Text>
            </View>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Personal Info Section */}
            <Text className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              INFORMATIONS PERSONNELLES
            </Text>

            <View className="mb-4 gap-4">
              {/* First Name */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium">Prénom *</Text>
                <Input
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Prénom de l'enfant"
                  autoCapitalize="words"
                  disabled={isSubmitting}
                />
              </View>

              {/* Last Name */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium">Nom *</Text>
                <Input
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Nom de famille"
                  autoCapitalize="words"
                  disabled={isSubmitting}
                />
              </View>

              {/* Date of Birth */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium">Date de naissance *</Text>
                <Input
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="JJ/MM/AAAA"
                  keyboardType="numeric"
                  disabled={isSubmitting}
                />
              </View>

              {/* School Level Picker */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium">Niveau scolaire *</Text>
                <TouchableOpacity
                  onPress={() => setShowLevelPicker(true)}
                  disabled={isSubmitting}
                  className="h-12 flex-row items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3"
                >
                  <Text
                    className={selectedLevelLabel ? '' : 'text-slate-500 dark:text-slate-400'}
                  >
                    {selectedLevelLabel ?? 'Sélectionner le niveau'}
                  </Text>
                  <ChevronDown color={iconColors.muted} size={20} />
                </TouchableOpacity>
              </View>

            </View>

            {/* Credentials Section */}
            <View className="mb-4 mt-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  IDENTIFIANTS DE CONNEXION
                </Text>
                <TouchableOpacity
                  onPress={handleGenerateCredentials}
                  disabled={isSubmitting}
                  className="flex-row items-center gap-1"
                  accessibilityLabel="Générer les identifiants"
                >
                  <RefreshCw color={iconColors.foreground} size={14} />
                  <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Générer
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="gap-4">
                {/* Username */}
                <View className="gap-1.5">
                  <Text className="text-sm font-medium">Nom d'utilisateur *</Text>
                  <Input
                    value={username}
                    onChangeText={setUsername}
                    placeholder="username123"
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={isSubmitting}
                  />
                </View>

                {/* Password */}
                <View className="gap-1.5">
                  <Text className="text-sm font-medium">Mot de passe *</Text>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="SuperChat42!"
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={isSubmitting}
                  />
                  <Text variant="muted" className="text-xs">
                    Gardez ces identifiants en lieu sûr !
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="border-t border-slate-200 dark:border-slate-700 px-4 py-4">
            <Button
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="flex-row items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <RefreshCw color="white" size={18} className="animate-spin" />
              ) : (
                <UserPlus color="white" size={18} />
              )}
              <Text className="font-semibold text-white dark:text-slate-900">
                {isSubmitting ? 'Création...' : 'Créer le compte'}
              </Text>
            </Button>
          </View>
        </KeyboardAvoidingView>

        {/* Level Picker Modal */}
        <LevelPickerModal
          visible={showLevelPicker}
          onClose={() => setShowLevelPicker(false)}
          levels={levels}
          selectedLevel={schoolLevel}
          onSelect={(levelKey) => {
            setSchoolLevel(levelKey);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
