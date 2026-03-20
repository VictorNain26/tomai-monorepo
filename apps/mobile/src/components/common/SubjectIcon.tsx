/**
 * SubjectIcon - Renders a Lucide icon for a school subject
 *
 * Uses enrichSubjectKey() to resolve the subject, then renders
 * the corresponding Lucide icon with theme-aware color.
 */

import { type LucideIcon } from 'lucide-react-native';
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Leaf,
  Globe,
  Languages,
  MessageCircle,
  Book,
  Drama,
  Cog,
  GraduationCap,
} from 'lucide-react-native';
import { enrichSubjectKey, getSubjectStyles } from '@/constants/subjects';
import { useTheme } from '@/hooks/useTheme';

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  BookOpen,
  FlaskConical,
  Leaf,
  Globe,
  Languages,
  MessageCircle,
  Book,
  Drama,
  Cog,
  GraduationCap,
};

interface SubjectIconProps {
  subject: string;
  size?: number;
  className?: string;
}

export function SubjectIcon({ subject, size = 20, className }: SubjectIconProps) {
  const { isDark } = useTheme();
  const metadata = enrichSubjectKey(subject);
  const styles = getSubjectStyles(metadata.color);
  const IconComponent = ICON_MAP[metadata.icon] ?? GraduationCap;
  const color = isDark ? styles.iconColor.dark : styles.iconColor.light;

  return <IconComponent size={size} color={color} className={className} />;
}
