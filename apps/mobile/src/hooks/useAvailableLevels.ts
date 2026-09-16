/**
 * useAvailableLevels — school levels the server actually serves.
 *
 * Shared by child creation and child edition so both offer the same levels.
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap, type ResponseData } from '@repo/api';

type EducationApi = ReturnType<typeof getTreaty>['api']['education'];
type LevelsResponse = ResponseData<EducationApi['levels']['get']>;
type SchoolLevel = LevelsResponse['levels'][number];

async function fetchAvailableLevels(): Promise<SchoolLevel[]> {
  const { levels } = unwrap(await getTreaty().api.education.levels.get());
  return levels.filter((l) => l.available);
}

export function useAvailableLevels() {
  const query = useQuery({
    queryKey: ['education', 'levels'] as const,
    queryFn: fetchAvailableLevels,
    staleTime: 10 * 60 * 1000,
  });

  return {
    levels: query.data ?? [],
    isLoading: query.isLoading,
  };
}
