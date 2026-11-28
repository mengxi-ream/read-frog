import type { ExtensionORPCClient, ExtensionORPCClientContext } from "./client-context"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { ORPC_PREFIX } from "@read-frog/definitions"
import { env } from "@/env"
import { fetchWithSessionToken } from "../auth/safari-session"
import { buildExtensionORPCHeaders } from "./client-context"

const link = new RPCLink<ExtensionORPCClientContext>({
  url: `${env.WXT_API_URL}${ORPC_PREFIX}`,
  headers: ({ context }) => buildExtensionORPCHeaders(context),
  fetch: (request, init) => {
    // In Safari a request to the API carries the session itself.
    return (import.meta.env.BROWSER === "safari" ? fetchWithSessionToken : fetch)(request, {
      ...init,
      credentials: "include",
    })
  },
})

export const backgroundOrpcClient: ExtensionORPCClient = createORPCClient(link)
