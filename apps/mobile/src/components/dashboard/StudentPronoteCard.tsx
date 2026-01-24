/**
 * StudentPronoteCard Component
 *
 * Displays Pronote status and quick stats for students.
 * Read-only view - connection is managed by parents.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  School,
  CheckCircle,
  XCircle,
  FileText,
  BarChart3,
  Calendar,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconColors } from '@/hooks';
import type { StudentPronoteStatus } from '@/hooks/useStudentPronote';

// ============================================================================
// TYPES
// ============================================================================

interface StudentPronoteCardProps {
  status: StudentPronoteStatus | undefined;
  upcomingHomework: number;
  averageGrade: number | null;
  isLoading?: boolean;
  onNavigate?: (section: 'homework' | 'grades' | 'timetable') => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StudentPronoteCard({
  status,
  upcomingHomework,
  averageGrade,
  isLoading = false,
  onNavigate,
}: StudentPronoteCardProps) {
  const iconColors = useIconColors();

  // Loading state
  if (isLoading) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <View className="flex-row items-center gap-3 border-b border-border pb-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <View className="flex-1">
            <Skeleton className="mb-1 h-4 w-24 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </View>
        </View>
        <View className="flex-row gap-3 pt-3">
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 flex-1 rounded-xl" />
        </View>
      </View>
    );
  }

  const isConnected = status?.isConnected ?? false;

  return (
    <View className="rounded-xl border border-border bg-card">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <School color={iconColors.primary} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold">Pronote</Text>
          <Text variant="muted" className="text-sm">
            Données scolaires officielles
          </Text>
        </View>
        {isConnected ? (
          <CheckCircle color={iconColors.success} size={20} />
        ) : (
          <XCircle color={iconColors.destructive} size={20} />
        )}
      </View>

      {/* Content */}
      <View className="p-4">
        {isConnected && status ? (
          <>
            {/* Connected state */}
            <View className="mb-4 rounded-xl bg-success/10 p-3">
              <Text className="font-medium text-success">
                {status.establishmentName ?? 'Établissement Pronote'}
              </Text>
              {status.className && (
                <Text className="text-sm text-success/80">
                  Classe: {status.className}
                </Text>
              )}
            </View>

            {/* Quick stats */}
            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 items-center rounded-xl bg-muted/50 p-3">
                <Text className="text-2xl font-bold">{upcomingHomework}</Text>
                <Text variant="muted" className="text-xs">
                  Devoirs à faire
                </Text>
              </View>
              <View className="flex-1 items-center rounded-xl bg-muted/50 p-3">
                <Text className="text-2xl font-bold">
                  {averageGrade !== null ? averageGrade.toFixed(1) : '-'}
                </Text>
                <Text variant="muted" className="text-xs">
                  Moyenne
                </Text>
              </View>
            </View>

            {/* Quick actions */}
            <View className="flex-row gap-3" accessibilityRole="toolbar">
              <TouchableOpacity
                onPress={() => onNavigate?.('homework')}
                className="flex-1 items-center rounded-xl border border-primary/30 p-3"
                accessibilityRole="button"
                accessibilityLabel="Voir les devoirs"
                accessibilityHint="Ouvre la liste des devoirs Pronote"
              >
                <FileText color={iconColors.primary} size={18} />
                <Text className="mt-1 text-xs font-medium">Devoirs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onNavigate?.('grades')}
                className="flex-1 items-center rounded-xl border border-primary/30 p-3"
                accessibilityRole="button"
                accessibilityLabel="Voir les notes"
                accessibilityHint="Ouvre la liste des notes Pronote"
              >
                <BarChart3 color={iconColors.primary} size={18} />
                <Text className="mt-1 text-xs font-medium">Notes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onNavigate?.('timetable')}
                className="flex-1 items-center rounded-xl border border-primary/30 p-3"
                accessibilityRole="button"
                accessibilityLabel="Voir l'emploi du temps"
                accessibilityHint="Ouvre l'emploi du temps Pronote"
              >
                <Calendar color={iconColors.primary} size={18} />
                <Text className="mt-1 text-xs font-medium">EDT</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Not connected state */
          <View className="items-center py-4">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <XCircle color={iconColors.muted} size={24} />
            </View>
            <Text className="mb-1 text-center font-medium">
              Pronote non connecté
            </Text>
            <Text variant="muted" className="text-center text-sm">
              Demande à ton parent de connecter Pronote pour voir tes notes,
              devoirs et emploi du temps.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
