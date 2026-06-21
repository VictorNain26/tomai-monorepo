/**
 * ChildAccessCard — per-child access configuration card.
 *
 * Used in the Pronote onboarding wizard's "select/define-access" step.
 * - existingChildId ≠ null → defaults to link mode (shows "sera relié à…")
 * - existingChildId === null → defaults to create mode (shows ChildCredentialsFields)
 * Parent can switch mode via inline controls.
 */

import { TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { ChildCredentialsFields } from '@/components/parent/ChildCredentialsFields';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ChildCredentialsErrors } from '@/components/parent/ChildCredentialsFields';
import type { DiscoveredChild } from '@/hooks/usePronoteConnect';
import type { AccessForm } from './pronote-connect-types';

// ============================================================================
// TYPES
// ============================================================================

export interface ChildAccessCardProps {
  child: DiscoveredChild;
  form: AccessForm;
  errors: ChildCredentialsErrors;
  existingChildren: { id: string; firstName: string; lastName: string }[];
  onChange: (field: keyof AccessForm, value: string) => void;
  onModeChange: (mode: 'create' | 'link', linkToChildId?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildAccessCard({
  child,
  form,
  errors,
  existingChildren,
  onChange,
  onModeChange,
}: ChildAccessCardProps) {
  const colors = useThemeColors();

  return (
    <View className="mb-4">
      {/* Child header */}
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Text className="text-sm font-bold text-primary-foreground">
            {child.suggested.firstName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold">
            {child.suggested.firstName} {child.suggested.lastName}
          </Text>
          <Text variant="muted" className="text-xs">
            {child.className ? `${child.className} — ` : ''}{child.establishmentName}
          </Text>
        </View>
      </View>

      {/* Link mode: existing child auto-detected */}
      {child.existingChildId !== null && form.mode === 'link' && (
        <View
          testID={`define-access-link-mode-${child.resourceId}`}
          className="rounded-xl p-4"
          style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          accessibilityLabel={`Lier à ${child.suggested.firstName} (compte existant)`}
        >
          <Text className="text-sm font-medium">Sera relié au compte existant</Text>
          <Text variant="muted" className="mt-0.5 text-xs">
            {child.suggested.firstName} dispose déjà d&apos;un profil TomAI.
          </Text>

          {/* Option: manually link to a different child */}
          {existingChildren.length > 1 && (
            <View className="mt-3 gap-2">
              <Text variant="muted" className="text-xs font-semibold uppercase">
                Ou relier à un autre enfant
              </Text>
              {existingChildren.map((ec) => (
                <TouchableOpacity
                  key={ec.id}
                  onPress={() => onModeChange('link', ec.id)}
                  className="flex-row items-center gap-2 rounded-lg p-2"
                  style={{
                    backgroundColor:
                      form.linkToChildId === ec.id ? colors.primary + '20' : 'transparent',
                  }}
                  accessibilityLabel={`Relier à ${ec.firstName} ${ec.lastName}`}
                  accessibilityRole="button"
                >
                  <Text className="text-sm">
                    {ec.firstName} {ec.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => onModeChange('create')}
            className="mt-3"
            accessibilityLabel="Créer un nouveau compte TomAI"
            accessibilityRole="button"
          >
            <Text className="text-xs" style={{ color: colors.primary }}>
              Créer un nouveau compte à la place →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create mode for new child (no existingChildId) */}
      {child.existingChildId === null && form.mode === 'create' && (
        <ChildCredentialsFields
          username={form.username}
          password={form.password}
          schoolLevel={form.schoolLevel}
          onChange={(field, value) => onChange(field as keyof AccessForm, value)}
          errors={errors}
        />
      )}

      {/* Create mode for child with existingChildId (parent overrode link) */}
      {child.existingChildId !== null && form.mode === 'create' && (
        <View className="mt-3">
          <ChildCredentialsFields
            username={form.username}
            password={form.password}
            schoolLevel={form.schoolLevel}
            onChange={(field, value) => onChange(field as keyof AccessForm, value)}
            errors={errors}
          />
          <TouchableOpacity
            onPress={() => onModeChange('link', child.existingChildId ?? undefined)}
            className="mt-2"
            accessibilityLabel="Revenir au mode liaison"
            accessibilityRole="button"
          >
            <Text className="text-xs" style={{ color: colors.primary }}>
              ← Revenir à la liaison automatique
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual link mode (existingChildId is null, but parent chose link) */}
      {child.existingChildId === null && form.mode === 'link' && (
        <View className="rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.border }}>
          <Text className="text-sm font-medium">Relier à un enfant existant</Text>
          {existingChildren.map((ec) => (
            <TouchableOpacity
              key={ec.id}
              onPress={() => onModeChange('link', ec.id)}
              className="mt-2 flex-row items-center gap-2 rounded-lg p-2"
              style={{
                backgroundColor:
                  form.linkToChildId === ec.id ? colors.primary + '20' : 'transparent',
              }}
              accessibilityLabel={`Relier à ${ec.firstName} ${ec.lastName}`}
              accessibilityRole="button"
            >
              <Text className="text-sm">
                {ec.firstName} {ec.lastName}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => onModeChange('create')}
            className="mt-3"
            accessibilityLabel="Créer un nouveau compte"
            accessibilityRole="button"
          >
            <Text className="text-xs" style={{ color: colors.primary }}>
              Créer un nouveau compte →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
