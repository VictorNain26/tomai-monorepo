import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { getDatabase } from '@/db/client';

jest.mock('@/db/client', () => ({
  getDatabase: jest.fn(),
}));

describe('useOfflineCache on web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.clearAllMocks();
  });

  it('never touches SQLite: cacheMessages no-ops, getCachedMessages returns null', async () => {
    const { result } = renderHook(() => useOfflineCache());

    await result.current.cacheMessages('session-1', [
      { id: 'm1', role: 'user', content: 'salut', timestamp: '2026-07-15T10:00:00Z', aiModel: null, attachedFile: null },
    ]);
    const cached = await result.current.getCachedMessages('session-1');

    expect(cached).toBeNull();
    expect(getDatabase).not.toHaveBeenCalled();
  });
});
