import type { AppRouter } from '@repo/api'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { toast } from 'sonner'
import SuperJSON from 'superjson'

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
  // TODO: change to the correct url on production
  links: [httpBatchLink({ url: 'http://localhost:8888/api/trpc', transformer: SuperJSON })],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
