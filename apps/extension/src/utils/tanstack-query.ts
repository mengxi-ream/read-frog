import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const errorDescription
        = query.meta?.errorDescription || 'Something went wrong'
      toast.error(`${errorDescription}`, {
        description: error.message || undefined,
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const errorDescription
        = mutation.meta?.errorDescription || 'Something went wrong'
      toast.error(`${errorDescription}`, {
        description: error.message || undefined,
      })
    },
  }),
})
