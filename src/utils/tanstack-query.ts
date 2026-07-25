import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { toastManager } from "@/components/ui/base-ui/toast"

function getErrorDescription(errorDescription: unknown): string {
  return typeof errorDescription === "string" && errorDescription
    ? errorDescription
    : "Something went wrong"
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressToast) return

      const errorDescription = getErrorDescription(query.meta?.errorDescription)
      toastManager.add({
        type: "error",
        title: errorDescription,
        description: error.message || undefined,
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressToast) return

      const errorDescription = getErrorDescription(mutation.meta?.errorDescription)
      toastManager.add({
        type: "error",
        title: errorDescription,
        description: error.message || undefined,
      })
    },
  }),
})
