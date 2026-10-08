/** Who is signed in, as `/api/me` tells it; null for a visitor without a session. And their devices. */

import { queryOptions } from '@tanstack/react-query';
import { api, isProblem, parseResponse } from './api';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    try {
      return await parseResponse(api.me.$get());
    } catch (error) {
      if (isProblem(error, 'UNAUTHENTICATED')) return null;
      throw error;
    }
  },
});

/** The devices paired to the signed-in account, the newest first. */
export const devicesQuery = queryOptions({
  queryKey: ['me', 'devices'],
  queryFn: () => parseResponse(api.me.devices.$get()),
});
