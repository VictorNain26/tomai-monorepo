/**
 * usePronoteStatus — server-status hook tests.
 *
 * Verifies:
 * 1. data.hasPronote === true when the server returns hasPronote: true.
 * 2. error is set (and hasPronote is not assumed true) when the endpoint returns 403.
 * 3. Query is disabled when childId is falsy.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { getTreaty } from '@repo/api';

import { createTestWrapper } from '../utils/test-utils';
import { usePronoteStatus } from '../../src/hooks/usePronoteStatus';

const mockGetTreaty = getTreaty as jest.MockedFunction<typeof getTreaty>;

function mockStatusGet(impl: jest.Mock) {
  mockGetTreaty.mockReturnValue({
    api: {
      pronote: {
        children: jest.fn(() => ({
          status: { get: impl },
        })),
      },
    },
  } as unknown as ReturnType<typeof getTreaty>);
}

describe('usePronoteStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes data.hasPronote === true on success', async () => {
    mockStatusGet(
      jest.fn().mockResolvedValue({
        data: { success: true, data: { hasPronote: true, establishmentName: 'X', className: '4eB' } },
        error: null,
      }),
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => usePronoteStatus('child-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.hasPronote).toBe(true);
    expect(result.current.data?.establishmentName).toBe('X');
    expect(result.current.data?.className).toBe('4eB');
  });

  it('sets error and does not expose hasPronote on 403', async () => {
    mockStatusGet(
      jest.fn().mockResolvedValue({
        data: null,
        error: { status: 403, value: { message: 'Access denied', code: 'forbidden' } },
      }),
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => usePronoteStatus('child-2'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('does not run the query when childId is empty', () => {
    const statusGet = jest.fn();
    mockStatusGet(statusGet);

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => usePronoteStatus(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(statusGet).not.toHaveBeenCalled();
  });
});
