import { backgroundFetch } from "./background-fetch-client"

const EXTENSION_PROTOCOLS = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
])

const resolvedAssetBlobCache = new Map<string, Blob>()
const pendingAssetBlobCache = new Map<string, Promise<Blob | null>>()

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

export async function resolveContentScriptAssetBlob(resourceUrl: string) {
  if (!shouldProxyAssetUrl(resourceUrl)) {
    return null
  }

  const cachedAssetBlob = resolvedAssetBlobCache.get(resourceUrl)
  if (cachedAssetBlob) {
    return cachedAssetBlob
  }

  const pendingAssetBlob = pendingAssetBlobCache.get(resourceUrl)
  if (pendingAssetBlob) {
    return pendingAssetBlob
  }

  const assetBlobPromise = (async () => {
    try {
      const response = await backgroundFetch(resourceUrl, undefined, {
        credentials: "omit",
        responseType: "base64",
      })
      if (!response.ok) {
        return null
      }

      const assetBlob = await response.blob()
      if (assetBlob.size === 0) {
        return null
      }

      resolvedAssetBlobCache.set(resourceUrl, assetBlob)
      return assetBlob
    }
    catch {
      return null
    }
    finally {
      pendingAssetBlobCache.delete(resourceUrl)
    }
  })()

  pendingAssetBlobCache.set(resourceUrl, assetBlobPromise)
  return assetBlobPromise
}

export function clearResolvedContentScriptAssetBlobs() {
  resolvedAssetBlobCache.clear()
  pendingAssetBlobCache.clear()
}
