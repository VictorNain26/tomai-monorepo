/**
 * useNetworkStatus — Online/offline detection
 *
 * Uses expo NetInfo to detect connectivity changes.
 * Provides isOnline state for disabling chat send and showing banners.
 */

import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial check
    Network.getNetworkStateAsync().then(state => {
      if (mounted) {
        setIsOnline(state.isConnected ?? true);
      }
    });

    // Poll every 5s (expo-network doesn't have a listener API like NetInfo)
    const interval = setInterval(async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsOnline(state.isConnected ?? true);
        }
      } catch {
        // Ignore errors during polling
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline };
}
