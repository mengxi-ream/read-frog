import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { createAuthClient } from "better-auth/client"
import { env } from "@/env"
import { fetchWithSessionToken } from "./safari-session"

// Background scripts can fetch the API directly. UI authClient intentionally
// proxies through backgroundFetch for content-script contexts.
export const backgroundAuthClient = createAuthClient({
  baseURL: env.WXT_API_URL,
  basePath: AUTH_BASE_PATH,
  // In Safari a request to the API carries the session itself.
  fetchOptions:
    import.meta.env.BROWSER === "safari"
      ? { credentials: "include", cache: "no-store", customFetchImpl: fetchWithSessionToken }
      : { credentials: "include", cache: "no-store" },
})
