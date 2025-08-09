import type { TRPCQueryOptions } from '@trpc/tanstack-react-query'
import { appRouter } from '@repo/api'
import { createTRPCContext } from '@repo/api/trpc'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { headers } from 'next/headers'
import { cache } from 'react'
import { createQueryClient } from './query-client'
import 'server-only'

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers())
  heads.set('x-trpc-source', 'rsc')

  return createTRPCContext({
    headers: heads,
  })
})

const getQueryClient = cache(createQueryClient)

/**
 * Server-side tRPC options proxy bound to the server `QueryClient` for RSC.
 *
 * Use this to generate `queryOptions` for calls like `prefetchQuery` on the server
 * and `useQuery`/`useSuspenseQuery` inside client components via `useTRPC()`.
 *
 * @example
 * In a server component:
 *
 * prefetch(
 *   trpc.hello.queryOptions({ text: 'world' }),
 * )
 *
 * @example
 * In a client component:
 *
 * const trpc = useTRPC()
 * const { data } = useQuery(trpc.hello.queryOptions({ text: 'world' }))
 *
 * @see https://trpc.io/docs/client/tanstack-react-query/usage
 */
export const trpc = createTRPCOptionsProxy({
  ctx: createContext,
  router: appRouter,
  queryClient: getQueryClient,
})

// If your router is on a separate server, you would pass a client instead of `router`.
// That setup is not used here because the API router is hosted within this Next.js app under `/api/trpc`.
// createTRPCOptionsProxy({
//   client: createTRPCClient({
//     links: [httpLink({ url: '...' })],
//   }),
//   queryClient: getQueryClient,
// });

/**
 * Wraps children in a `HydrationBoundary` using the dehydrated state
 * from the server `QueryClient`.
 *
 * Call `prefetch(...)` or `queryClient.fetchQuery(...)` in the parent RSC
 * before rendering this to have data ready on the client.
 *
 * @example
 * <HydrateClient>
 *   <ClientGreeting />
 * </HydrateClient>
 *
 * @see https://trpc.io/docs/client/tanstack-react-query/server-components
 */
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  )
}

/**
 * Prefetch a query (or infinite query) on the server into the shared `QueryClient`.
 * The prefetched data will be dehydrated and made available after hydration on the client.
 *
 * @example
 * function Home() {
 *   prefetch(
 *     trpc.hello.queryOptions({
 *       // input
 *     }),
 *   );
 *   return (
 *     <HydrateClient>
 *       <div>...</div>
 *       <ClientGreeting />
 *     </HydrateClient>
 *   );
 * }
 *
 * @see https://trpc.io/docs/client/tanstack-react-query/server-components
 */
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    void queryClient.prefetchInfiniteQuery(queryOptions as any)
  }
  else {
    void queryClient.prefetchQuery(queryOptions)
  }
}

/**
 * Server-only tRPC caller for invoking procedures directly in server components
 * or route handlers. Detached from React Query cache.
 *
 * @example
 * const greeting = await caller.hello()
 *         ^? { greeting: string }
 *
 * return <div>{greeting.greeting}</div>;
 *
 * @see https://trpc.io/docs/client/tanstack-react-query/server-components
 */
export const caller = appRouter.createCaller(createContext)
