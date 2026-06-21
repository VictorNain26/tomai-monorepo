/**
 * Shared types for the Pronote onboarding wizard (Task 13).
 * Consumed by pronote-connect.tsx, ChildAccessCard, and ResultStep.
 */

import type { EducationLevelType } from '@/constants/levels';
import type { DiscoveredChild } from '@/hooks/usePronoteConnect';

export interface AccessForm {
  mode: 'create' | 'link';
  username: string;
  password: string;
  schoolLevel: EducationLevelType;
  linkToChildId: string | undefined;
}

export function buildDefaultAccessForm(child: DiscoveredChild): AccessForm {
  const level = (child.suggested.schoolLevel as EducationLevelType | null) ?? 'sixieme';
  if (child.existingChildId !== null) {
    return {
      mode: 'link',
      username: '',
      password: '',
      schoolLevel: level,
      linkToChildId: child.existingChildId,
    };
  }
  return {
    mode: 'create',
    username: '',
    password: '',
    schoolLevel: level,
    linkToChildId: undefined,
  };
}
