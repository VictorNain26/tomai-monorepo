/**
 * useSubscriptionStatus Hook (web)
 *
 * Fetches the parent's family subscription status from the server.
 * Server endpoint: GET /api/subscriptions/status?parentId=<id>
 */

import { useQuery } from "@tanstack/react-query";
import { getTreaty, unwrap, type ResponseData } from "@repo/api";
import { useUserState } from "@/lib/auth-client";

type SubscriptionsApi = ReturnType<typeof getTreaty>["api"]["subscriptions"];
export type SubscriptionStatusData = ResponseData<
  SubscriptionsApi["status"]["get"]
>;

const queryKeys = {
  subscriptionStatus: (parentId: string) =>
    ["subscriptions", "status", parentId] as const,
};

async function fetchSubscriptionStatus(
  parentId: string
): Promise<SubscriptionStatusData> {
  return unwrap(
    await getTreaty().api.subscriptions.status.get({
      query: { parentId },
    })
  );
}

export function useSubscriptionStatus() {
  const { user, isPending: sessionPending } = useUserState();

  const query = useQuery({
    queryKey: user?.id ? queryKeys.subscriptionStatus(user.id) : ([] as const),
    queryFn: () => fetchSubscriptionStatus(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isLoading: sessionPending || query.isLoading,
    isError: query.isError,
  };
}
