import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/utils/auth/auth-client"
import { orpc } from "@/utils/orpc/client"

export interface HostedAiStatusResult {
  status: HostedAiStatus | undefined
  /** False until the session resolves, so guest-only UI never flashes for members. */
  isSignedIn: boolean
  isPending: boolean
  isError: boolean
}

/**
 * One query per identity, shared by every hosted-AI surface (provider dropdowns,
 * the built-in provider editor, the quota section), so the options page issues a
 * single status request instead of one per widget. This TanStack cache is the
 * only status cache on UI surfaces — content scripts reuse via the
 * page-translation session snapshot instead, and there is deliberately no
 * module-level cache underneath either.
 */
export function useHostedAiStatus(options: { enabled?: boolean } = {}): HostedAiStatusResult {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const statusQuery = useQuery(
    orpc.hostedAi.status.queryOptions({
      input: {},
      // oRPC's generated key ignores identity; sign-in must refetch, so scope
      // the entry per user (suffixing keeps orpc.hostedAi.key() invalidation
      // prefix-matching intact).
      queryKey: [...orpc.hostedAi.status.queryKey({ input: {} }), session?.user?.id ?? "guest"],
      enabled: (options.enabled ?? true) && !isSessionPending,
      retry: false,
      staleTime: 60_000,
      meta: { suppressToast: true },
    }),
  )

  return {
    status: statusQuery.data,
    isSignedIn: session?.user?.id !== undefined,
    isPending: isSessionPending || statusQuery.isPending,
    isError: statusQuery.isError,
  }
}
