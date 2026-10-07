/** Who is signed in, as `/api/me` tells it; null for a visitor without a session. */

import { queryOptions } from '@tanstack/react-query';
import { api, parseResponse, problemOf } from './api';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    try {
      return await parseResponse(api.me.$get());
    } catch (error) {
      if (problemOf(error)?.status === 401) return null;
      throw error;
    }
  },
});
