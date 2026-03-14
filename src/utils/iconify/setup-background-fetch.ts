import { _api } from "@iconify/react"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"

let isConfigured = false

async function iconifyBackgroundFetch(input: RequestInfo | URL, init?: RequestInit) {
  return backgroundFetch(input, init, {
    credentials: "omit",
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
