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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, UserPlus, RefreshCw, ChevronDown, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getLevelLabel,
  isLv2Eligible,
  LV2_OPTIONS,
  LV2_ELIGIBLE_LEVELS,
  type Lv2Option,
} from '@/constants/levels';
import type { ICreateChildData, SchoolLevel } from '@/hooks/useParentDashboard';

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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('');
  const [selectedLv2, setSelectedLv2] = useState<Lv2Option | undefined>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showLv2Picker, setShowLv2Picker] = useState(false);

  const lv2Eligible = isLv2Eligible(schoolLevel);

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
    setSelectedLv2(undefined);
    setUsername('');
    setPassword('');
  }, []);

  const handleGenerateCredentials = useCallback(() => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Attention', 'Saisissez d\'abord le prénom et le nom');
      return;
    }
    setUsername(generateUsername(firstName, lastName));
    setPassword(generatePassword());
  }, [firstName, lastName]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      password: password.trim(),
      schoolLevel: schoolLevel as ICreateChildData['schoolLevel'],
      dateOfBirth: dateOfBirth.trim(),
      selectedLv2: lv2Eligible ? selectedLv2 : undefined,
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
    selectedLv2,
    lv2Eligible,
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
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              className="p-2"
            >
              <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="text-lg font-semibold">Créer un compte enfant</Text>
            </View>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Personal Info Section */}
            <Text className="mb-3 text-sm font-medium text-muted-foreground">
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
                  className="h-12 flex-row items-center justify-between rounded-md border border-input bg-background px-3"
                >
                  <Text
                    className={selectedLevelLabel ? '' : 'text-muted-foreground'}
                  >
                    {selectedLevelLabel ?? 'Sélectionner le niveau'}
                  </Text>
                  <ChevronDown color="hsl(215.4, 16.3%, 46.9%)" size={20} />
                </TouchableOpacity>
              </View>

              {/* LV2 Picker (only if eligible) */}
              {lv2Eligible && (
                <View className="gap-1.5">
                  <Text className="text-sm font-medium">Langue vivante 2</Text>
                  <TouchableOpacity
                    onPress={() => setShowLv2Picker(true)}
                    disabled={isSubmitting}
                    className="h-12 flex-row items-center justify-between rounded-md border border-input bg-background px-3"
                  >
                    <Text
                      className={selectedLv2 ? 'capitalize' : 'text-muted-foreground'}
                    >
                      {selectedLv2 ?? 'Optionnel'}
                    </Text>
                    <ChevronDown color="hsl(215.4, 16.3%, 46.9%)" size={20} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Credentials Section */}
            <View className="mb-4 mt-2 border-t border-border pt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-muted-foreground">
                  IDENTIFIANTS DE CONNEXION
                </Text>
                <TouchableOpacity
                  onPress={handleGenerateCredentials}
                  disabled={isSubmitting}
                  className="flex-row items-center gap-1"
                >
                  <RefreshCw color="hsl(222.2, 47.4%, 11.2%)" size={14} />
                  <Text className="text-sm font-medium text-primary">
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
          <View className="border-t border-border px-4 py-4">
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
              <Text className="font-semibold text-primary-foreground">
                {isSubmitting ? 'Création...' : 'Créer le compte'}
              </Text>
            </Button>
          </View>
        </KeyboardAvoidingView>

        {/* Level Picker Modal */}
        <Modal
          visible={showLevelPicker}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowLevelPicker(false)}
        >
          <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <Text className="text-lg font-semibold">Niveau scolaire</Text>
              <TouchableOpacity onPress={() => setShowLevelPicker(false)}>
                <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              {levels.map((level) => (
                <TouchableOpacity
                  key={level.key}
                  onPress={() => {
                    setSchoolLevel(level.key);
                    // Reset LV2 if new level is not eligible
                    if (!LV2_ELIGIBLE_LEVELS.includes(level.key)) {
                      setSelectedLv2(undefined);
                    }
                    setShowLevelPicker(false);
                  }}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text>{getLevelLabel(level.key)}</Text>
                  {schoolLevel === level.key && (
                    <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* LV2 Picker Modal */}
        <Modal
          visible={showLv2Picker}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowLv2Picker(false)}
        >
          <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <Text className="text-lg font-semibold">Langue vivante 2</Text>
              <TouchableOpacity onPress={() => setShowLv2Picker(false)}>
                <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              {/* None option */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedLv2(undefined);
                  setShowLv2Picker(false);
                }}
                className="flex-row items-center justify-between border-b border-border px-4 py-4"
              >
                <Text className="text-muted-foreground">Aucune</Text>
                {!selectedLv2 && (
                  <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                )}
              </TouchableOpacity>
              {LV2_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    setSelectedLv2(option.value);
                    setShowLv2Picker(false);
                  }}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text>{option.label}</Text>
                  {selectedLv2 === option.value && (
                    <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
