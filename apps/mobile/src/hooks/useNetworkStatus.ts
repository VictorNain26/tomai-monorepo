/**
 * useNetworkStatus — Online/offline detection
 *
 * Uses @react-native-community/netinfo (same as React Query's onlineManager)
 * to provide reactive isOnline state.
 */

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  return { isOnline };
}
