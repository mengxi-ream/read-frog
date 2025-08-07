import type { NextRequest } from 'next/server'
import { appRouter } from '@repo/api'
import { createTRPCContext } from '@repo/api/trpc'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { env } from '@/env'

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
async function createContext(req: NextRequest) {
  return createTRPCContext({
    headers: req.headers,
  })
}

function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`,
            )
          }
        : undefined,
  })
}

export { handler as GET, handler as POST }
