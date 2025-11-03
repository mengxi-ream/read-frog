/* eslint-disable node/prefer-global/process */
import type { RouterClient } from '@orpc/server'
import type { ORPCRouterClient, router } from '@repo/orpc'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { BatchLinkPlugin } from '@orpc/client/plugins'
import { WEBSITE_DEV_PORT } from '@repo/definitions'
import { ORPC_PREFIX } from './constant'

/**
 * This is part of the Optimize SSR setup.
 *
 * @see {@link https://orpc.unnoq.com/docs/adapters/next#optimize-ssr}
 */
declare global {
  // eslint-disable-next-line vars-on-top
  var $client: RouterClient<typeof router> | undefined
}

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return window.location.origin
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? WEBSITE_DEV_PORT}`
}

const link = new RPCLink({
  url: `${getBaseUrl()}${ORPC_PREFIX}`,
  plugins: [
    new BatchLinkPlugin({
      groups: [
        {
          condition: () => true,
          context: {},
        },
      ],
    }),
  ],
})

export const client: ORPCRouterClient
  = globalThis.$client ?? createORPCClient(link)
