import type { ORPCRouterClient } from '@read-frog/api-contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { BatchLinkPlugin } from '@orpc/client/plugins'
import { WEBSITE_URL } from '../constants/url'
import { normalizeHeaders } from '../http'
import { sendMessage } from '../message'

const link = new RPCLink({
  // TODO: add and use ORPC_PREFIX from @read-frog/definitions
  url: `${WEBSITE_URL}/api/rpc`,
  headers: {
    'x-orpc-source': 'extension',
  },
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
  // Proxy fetch through background to avoid CORS in content scripts
  fetch: async (request) => {
    // request is already a Request object with method, headers, body
    const req = typeof request === 'string' ? new Request(request) : request

    const url = req.url
    const method = req.method
    const headerEntries = normalizeHeaders(req.headers)
    const body = req.body ? await req.text() : undefined

    const resp = await sendMessage('backgroundFetch', {
      url,
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
})

export const orpc: ORPCRouterClient = createORPCClient(link)
