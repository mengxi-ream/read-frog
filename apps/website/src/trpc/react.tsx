/* eslint-disable node/prefer-global/process */
'use client'

import type { AppRouter } from '@repo/api'
import type { QueryClient } from '@tanstack/react-query'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { WEBSITE_DEV_PORT } from '@repo/definitions'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import SuperJSON from 'superjson'
import { createQueryClient } from './query-client'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

let clientQueryClientSingleton: QueryClient | undefined
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return createQueryClient()
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient()

  return clientQueryClientSingleton
}

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: op =>
            process.env.NODE_ENV === 'development'
            || (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${getBaseUrl()}/api/trpc`,
          headers: () => {
            const headers = new Headers()
            headers.set('x-trpc-source', 'nextjs-react')
            return headers
          },
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return window.location.origin
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? WEBSITE_DEV_PORT}`
}
