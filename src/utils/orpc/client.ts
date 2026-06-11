import type { ORPCRouterClient } from "@read-frog/api-contract"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { ORPC_PREFIX } from "@read-frog/definitions"
import { env } from "@/env"
import { normalizeHeaders } from "../http"
import { sendMessage } from "../message"

const link = new RPCLink({
  url: `${env.WXT_API_URL}${ORPC_PREFIX}`,
  headers: {
    "x-orpc-source": "extension",
  },
  // Proxy fetch through background to avoid CORS in content scripts
  fetch: async (request, init) => {
    const url = request.url
    const method = request.method
    const headerEntries = normalizeHeaders(request.headers)
    const body = request.body ? await request.text() : undefined

    const resp = await sendMessage("backgroundFetch", {
      url,
      method,
      headers: headerEntries,
      body,
      credentials: "include",
      redirect: init.redirect,
    })

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: new Headers(resp.headers),
    })
  },
})

export const orpcClient: ORPCRouterClient = createORPCClient(link)
export const orpc = createTanstackQueryUtils(orpcClient)
