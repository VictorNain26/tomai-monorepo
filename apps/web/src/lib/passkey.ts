/** The signed-in guardian's passkeys, by better-auth's passkey plugin. */

import { queryOptions } from '@tanstack/react-query';
import { authClient, authMessage } from './auth';

export const passkeysQuery = queryOptions({
  queryKey: ['passkeys'],
  queryFn: async () => {
    const { data, error } = await authClient.passkey.listUserPasskeys();
    if (error) throw new Error(authMessage(error));
    return data;
  },
});
