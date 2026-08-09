import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/utils/auth/auth-client"
import { getHostedAiStatus } from "@/utils/hosted-ai/status"
import { orpcClient } from "@/utils/orpc/client"

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
 * single status request instead of one per widget.
 */
export function useHostedAiStatus(options: { enabled?: boolean } = {}): HostedAiStatusResult {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const statusQuery = useQuery({
    queryKey: ["hosted-ai", "status", session?.user?.id ?? "guest"],
    queryFn: () => getHostedAiStatus(orpcClient, { force: true }),
    enabled: (options.enabled ?? true) && !isSessionPending,
    retry: false,
    staleTime: 60_000,
    meta: { suppressToast: true },
  })

  return {
    status: statusQuery.data,
    isSignedIn: session?.user?.id !== undefined,
    isPending: isSessionPending || statusQuery.isPending,
    isError: statusQuery.isError,
  }
}
