/**
 * useStudentDashboard Hook Tests
 *
 * Tests for student dashboard data fetching.
 * Follows TanStack Query testing best practices.
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/testing
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '@repo/api';

import { createTestWrapper } from '../utils/test-utils';

// Mock dependencies BEFORE importing the hook
jest.mock('@repo/api', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('../../src/lib/auth', () => ({
  useUser: jest.fn(() => ({
    id: 'user-1',
    name: 'Jean Dupont',
    email: 'jean@example.com',
    schoolLevel: 'quatrieme',
  })),
}));

// Import after mocks are set up
import { useStudentDashboard } from '../../src/hooks/useStudentDashboard';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useStudentDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock responses
    mockApiClient.get.mockImplementation((url: string) => {
      if (url === '/api/subscriptions/usage') {
        return Promise.resolve({
          userId: 'user-1',
          plan: 'free',
          window: {
            tokensUsed: 5000,
            tokensRemaining: 15000,
            limit: 20000,
            usagePercent: 25,
            refreshIn: '2h',
          },
          daily: {
            tokensUsed: 2000,
            tokensRemaining: 8000,
            limit: 10000,
            usagePercent: 20,
            resetsIn: '12h',
          },
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('should fetch token usage', async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useStudentDashboard(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingUsage).toBe(false);
    });

    expect(result.current.usage).not.toBeNull();
    expect(result.current.usage?.plan).toBe('free');
    expect(result.current.usage?.window.usagePercent).toBe(25);
    expect(result.current.usage?.daily.limit).toBe(10000);

    queryClient.clear();
  });

  it('should extract user name correctly', async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useStudentDashboard(), { wrapper });

    expect(result.current.userName).toBe('Jean');
    expect(result.current.schoolLevel).toBe('quatrieme');

    queryClient.clear();
  });

  it('should handle API errors gracefully', async () => {
    mockApiClient.get.mockRejectedValue(new Error('API Error'));

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useStudentDashboard(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingUsage).toBe(false);
    });

    expect(result.current.usageError).toBe('API Error');
    expect(result.current.usage).toBeNull();

    queryClient.clear();
  });
});
