import { _api } from "@iconify/react"
import { sendMessage } from "@/utils/message"

let isConfigured = false

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit): [string, string][] | undefined {
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined)
  if (!headers) {
    return undefined
  }

  const entries = Array.from(new Headers(headers).entries())
  return entries.length > 0 ? entries : undefined
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  return (init?.method ?? (input instanceof Request ? input.method : undefined) ?? "GET").toUpperCase()
}

function getRequestBody(init?: RequestInit) {
  if (typeof init?.body === "string") {
    return init.body
  }

  if (init?.body instanceof URLSearchParams) {
    return init.body.toString()
  }

  return undefined
}

async function iconifyBackgroundFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = getRequestMethod(input, init)
  const response = await sendMessage("backgroundFetch", {
    url: getRequestUrl(input),
    method,
    headers: getRequestHeaders(input, init),
    body: getRequestBody(init),
    credentials: "omit",
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export function ensureIconifyBackgroundFetch() {
  if (isConfigured) {
    return
  }

  // Content scripts cannot rely on direct icon fetches because site CSP can block them.
  _api.setFetch(iconifyBackgroundFetch)
  isConfigured = true
}
