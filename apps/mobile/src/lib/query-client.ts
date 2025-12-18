/**
 * TanStack Query Client Configuration
 *
 * Shared query client for the mobile app.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Optimized for mobile
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false, // Mobile doesn't have window focus
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
