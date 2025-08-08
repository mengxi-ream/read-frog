import type { AppRouter } from '@repo/api'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { toast } from 'sonner'
import SuperJSON from 'superjson'
import { sendMessage } from '@/utils/message'
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
  }), httpBatchLink({
    transformer: SuperJSON,
    url: `${getBaseUrl()}/api/trpc`,
    headers: () => {
      const headers = new Headers()
      headers.set('x-trpc-source', 'browser-extension')
      return headers
    },
    // Proxy fetch through background to avoid CORS in content scripts
    fetch: async (url, init) => {
      const method = init?.method ?? 'POST'

      let headerEntries: [string, string][] = []
      // init.headers: HeadersInit is a union of Headers, [string, string][], and Record<string, string>
      if (init?.headers instanceof Headers) {
        headerEntries = Array.from(init.headers.entries())
      }
      else if (Array.isArray(init?.headers)) {
        headerEntries = (init.headers as Array<[string, string]>).map(([k, v]) => [k, v])
      }
      else if (init?.headers && typeof init.headers === 'object') {
        headerEntries = Object.entries(init.headers as Record<string, string>)
          .map(([k, v]) => [k, String(v)])
      }

      const body = typeof init?.body === 'string' ? init.body : undefined

      const resp = await sendMessage('backgroundFetch', {
        url: typeof url === 'string' ? url : url.toString(),
        method,
        headers: headerEntries,
        body,
        credentials: 'include',
      })

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: new Headers(resp.headers),
      })
    },
  })],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
