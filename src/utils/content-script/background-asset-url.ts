import { backgroundFetch } from "./background-fetch-client"

const EXTENSION_PROTOCOLS = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
])

const resolvedAssetUrlCache = new Map<string, string>()
const pendingAssetUrlCache = new Map<string, Promise<string | null>>()

function isRemoteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function getCurrentPageUrl() {
  return typeof window === "undefined" ? "https://example.com/" : window.location.href
}

export function shouldProxyAssetUrl(resourceUrl: string, pageUrl = getCurrentPageUrl()) {
  if (!isRemoteHttpUrl(resourceUrl)) {
    return false
  }

  try {
    const protocol = new URL(pageUrl).protocol
    return !EXTENSION_PROTOCOLS.has(protocol)
  }
  catch {
    return true
  }
}

export async function resolveContentScriptAssetUrl(resourceUrl: string) {
  if (!shouldProxyAssetUrl(resourceUrl)) {
    return resourceUrl
  }

  const cachedAssetUrl = resolvedAssetUrlCache.get(resourceUrl)
  if (cachedAssetUrl) {
    return cachedAssetUrl
  }

  const pendingAssetUrl = pendingAssetUrlCache.get(resourceUrl)
  if (pendingAssetUrl) {
    return pendingAssetUrl
  }

  const assetUrlPromise = (async () => {
    try {
      const response = await backgroundFetch(resourceUrl, undefined, {
        credentials: "omit",
        responseType: "base64",
      })
      if (!response.ok) {
        return null
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        return null
      }

      const objectUrl = URL.createObjectURL(blob)
      resolvedAssetUrlCache.set(resourceUrl, objectUrl)
      return objectUrl
    }
    catch {
      return null
    }
    finally {
      pendingAssetUrlCache.delete(resourceUrl)
    }
  })()

  pendingAssetUrlCache.set(resourceUrl, assetUrlPromise)
  return assetUrlPromise
}

export function clearResolvedContentScriptAssetUrls() {
  for (const assetUrl of resolvedAssetUrlCache.values()) {
    URL.revokeObjectURL(assetUrl)
  }

  resolvedAssetUrlCache.clear()
  pendingAssetUrlCache.clear()
}
