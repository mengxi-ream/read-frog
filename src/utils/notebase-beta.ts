import { ORPCError } from "@orpc/client"
import { useQuery } from "@tanstack/react-query"
import { orpc } from "@/utils/orpc/client"

export function useNotebaseBetaStatus(enabled: boolean) {
  return useQuery(orpc.notebaseBeta.status.queryOptions({
    input: {},
    enabled,
    staleTime: 60_000,
    meta: {
      suppressToast: true,
    },
  }))
}

export function isORPCForbiddenError(error: unknown) {
  return error instanceof ORPCError && (error.code === "FORBIDDEN" || error.status === 403)
}
