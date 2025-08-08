import type { AppRouter } from '@repo/api'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { toast } from 'sonner'
import SuperJSON from 'superjson'
import { getBaseUrl } from '../url'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const errorDescription
      = query.meta?.errorDescription || 'Something went wrong'
      toast.error(`${errorDescription}: ${error.message}`)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const errorDescription
      = mutation.meta?.errorDescription || 'Something went wrong'
      toast.error(`${errorDescription}: ${error.message}`)
    },
  }),
})

const trpcClient = createTRPCClient<AppRouter>({
  links: [loggerLink({
    enabled: op =>
      import.meta.env.DEV
        || (op.direction === 'down' && op.result instanceof Error),
  }), httpBatchLink({ url: `${getBaseUrl()}/api/trpc`, transformer: SuperJSON })],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
