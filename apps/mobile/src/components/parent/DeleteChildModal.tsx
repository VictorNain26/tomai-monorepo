/**
 * DeleteChildModal Component
 *
 * Confirmation modal for deleting a child account.
 * Requires typing the child's first name to confirm.
 *
 * Best Practice 2026: Destructive actions require explicit confirmation
 * with friction (typing name) to prevent accidental deletions.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { X, AlertTriangle, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIconColors } from '@/hooks/useIconColors';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface DeleteChildModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  childName: string;
  childUsername: string;
  isDeleting: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DeleteChildModal({
  visible,
  onClose,
  onConfirm,
  childName,
  childUsername,
  isDeleting,
}: DeleteChildModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const iconColors = useIconColors();

  // Must type the child's first name exactly to confirm
  const isConfirmValid = confirmText.toLowerCase() === childName.toLowerCase();

  const handleConfirm = useCallback(async () => {
    if (!isConfirmValid || isDeleting) return;
    await onConfirm();
    setConfirmText('');
  }, [isConfirmValid, isDeleting, onConfirm]);

  const handleClose = useCallback(() => {
    setConfirmText('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: bgColors.black[60] }}>
          <SafeAreaView className="w-full max-w-sm">
            <View className="rounded-2xl bg-white dark:bg-slate-800">
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.destructive[10] }}>
                    <AlertTriangle color={iconColors.destructive} size={20} />
                  </View>
                  <Text className="text-lg font-semibold">
                    Supprimer le compte
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isDeleting}
                  className="p-2"
                >
                  <X color={iconColors.muted} size={20} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View className="p-4">
                <Text className="mb-4 leading-relaxed text-slate-500 dark:text-slate-400">
                  Vous allez supprimer le compte de{' '}
                  <Text className="font-semibold text-slate-800 dark:text-slate-100">
                    {childName}
                  </Text>{' '}
                  (@{childUsername}).
                </Text>

                <View className="mb-4 rounded-xl p-3" style={{ backgroundColor: bgColors.destructive[5] }}>
                  <Text className="text-sm text-red-600 dark:text-red-400">
                    Cette action est irréversible. Toutes les données de l'enfant
                    seront définitivement supprimées :
                  </Text>
                  <View className="mt-2 gap-1">
                    <Text className="text-sm text-red-600 dark:text-red-400">
                      • Historique des conversations
                    </Text>
                    <Text className="text-sm text-red-600 dark:text-red-400">
                      • Decks de révision créés
                    </Text>
                    <Text className="text-sm text-red-600 dark:text-red-400">
                      • Données de progression
                    </Text>
                  </View>
                </View>

                {/* Confirmation input */}
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium">
                    Tapez <Text className="font-bold">{childName}</Text> pour
                    confirmer
                  </Text>
                  <Input
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder={childName}
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={isDeleting}
                    className={
                      confirmText && !isConfirmValid
                        ? 'border-red-600 dark:border-red-400'
                        : ''
                    }
                  />
                  {confirmText && !isConfirmValid && (
                    <Text className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Le prénom ne correspond pas
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <Button
                    variant="outline"
                    onPress={handleClose}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    <Text className="font-medium">Annuler</Text>
                  </Button>
                  <Button
                    variant="destructive"
                    onPress={handleConfirm}
                    disabled={!isConfirmValid || isDeleting}
                    className="flex-1 flex-row items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <Text className="font-semibold text-white">
                        Suppression...
                      </Text>
                    ) : (
                      <>
                        <Trash2 color="white" size={16} />
                        <Text className="font-semibold text-white">
                          Supprimer
                        </Text>
                      </>
                    )}
                  </Button>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
