/**
 * Test Utilities
 *
 * Shared test utilities following TanStack Query best practices.
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/testing
 * @see https://tkdodo.eu/blog/testing-react-query
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Creates a new QueryClient configured for testing.
 *
 * Best practices (TanStack Query v5):
 * - gcTime: Infinity prevents "Jest did not exit" warnings
 * - retry: false prevents retries during tests
 * - throwOnError: false prevents unhandled errors in tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

/**
 * Creates a wrapper component for renderHook.
 *
 * Usage:
 * ```ts
 * const { wrapper, queryClient } = createTestWrapper();
 * const { result } = renderHook(() => useMyHook(), { wrapper });
 * ```
 */
export function createTestWrapper(): {
  wrapper: React.FC<WrapperProps>;
  queryClient: QueryClient;
} {
  const queryClient = createTestQueryClient();

  const Wrapper: React.FC<WrapperProps> = ({ children }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };

  return { wrapper: Wrapper, queryClient };
}

/**
 * Flushes all pending promises.
 * Useful for waiting for async operations to complete in tests.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
