import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Données considérées fraîches pendant 30 secondes
      staleTime: 30 * 1000,
      // Garde en cache pendant 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry intelligent avec backoff
      retry: (failureCount, error: unknown) => {
        const httpError = error as { status?: number };
        if (httpError?.status === 404) return false;
        if (httpError?.status === 401) return false;
        return failureCount < 2;
      },
      // Refetch automatique en arrière-plan
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      // Garde les données précédentes pendant le refetch
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry sur erreur réseau uniquement
      retry: 1,
    },
  },
});

