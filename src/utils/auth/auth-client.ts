import type { CacheConfig } from "@/types/proxy-fetch"
import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { createAuthClient } from "better-auth/react"
import { env } from "@/env"
import { sendMessage } from "@/utils/message"
import { normalizeHeaders } from "../http"

// Avoid CORS in content scripts by using background proxy
function createCustomFetch(cacheConfig?: CacheConfig) {
  return async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url)
    const url = inputUrl.startsWith("http")
      ? inputUrl
      : `${env.WXT_API_URL}${inputUrl.startsWith("/") ? "" : "/"}${inputUrl}`

    const method = init?.method
    const headers = normalizeHeaders(init?.headers)
    const body = typeof init?.body === "string" ? init.body : undefined

    const resp = await sendMessage("backgroundFetch", {
      url,
      method,
      headers,
      body,
      credentials: "include",
      cacheConfig,
    })

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: new Headers(resp.headers),
    })
  }
}

export const authClient = createAuthClient({
  baseURL: env.WXT_API_URL,
  basePath: AUTH_BASE_PATH,
  fetchOptions: {
    credentials: "include",
    customFetchImpl: createCustomFetch({
      enabled: true,
      groupKey: "auth",
    }),
  },
})
