import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { isSiteEnabled, SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"
import { resolveSiteControlUrl } from "./iframe-injection-utils"

const pendingDocumentKeys = new Set<string>()
const injectedDocumentKeysByFrame = new Map<string, string>()

function getDocumentInjectionKey(details: { tabId: number, frameId: number, documentId?: string }) {
  // Gracefully skip document-level deduplication when Chromium does not expose documentId.
  if (!details.documentId) {
    return null
  }

  return `${details.tabId}:${details.frameId}:${details.documentId}`
}

function getFrameInjectionKey(details: { tabId: number, frameId: number }) {
  return `${details.tabId}:${details.frameId}`
}

function clearTabDocumentState(tabId: number) {
  for (const key of pendingDocumentKeys) {
    if (key.startsWith(`${tabId}:`)) {
      pendingDocumentKeys.delete(key)
    }
  }

  for (const key of injectedDocumentKeysByFrame.keys()) {
    if (key.startsWith(`${tabId}:`)) {
      injectedDocumentKeysByFrame.delete(key)
    }
  }
}

function clearFrameInjectedDocumentState(tabId: number, frameId: number) {
  injectedDocumentKeysByFrame.delete(getFrameInjectionKey({ tabId, frameId }))
}

function pruneInjectedFrames(tabId: number, liveFrameIds: Set<number>) {
  for (const frameKey of injectedDocumentKeysByFrame.keys()) {
    if (!frameKey.startsWith(`${tabId}:`)) {
      continue
    }

    const frameId = Number(frameKey.slice(frameKey.indexOf(":") + 1))
    if (!liveFrameIds.has(frameId)) {
      injectedDocumentKeysByFrame.delete(frameKey)
    }
  }
}

function getParentFrameIdHint(details: object): number | undefined {
  if ("parentFrameId" in details && typeof details.parentFrameId === "number") {
    return details.parentFrameId
  }

  return undefined
}

function setInjectedSiteControlUrl(propertyName: string, siteControlUrl: string) {
  ;(globalThis as Record<string, unknown>)[propertyName] = siteControlUrl
}

function getInjectionTarget(details: { tabId: number, frameId: number, documentId?: string }) {
  if (details.documentId) {
    return { tabId: details.tabId, documentIds: [details.documentId] }
  }

  return { tabId: details.tabId, frameIds: [details.frameId] }
}

export function setupIframeInjection() {
  browser.tabs.onRemoved.addListener(clearTabDocumentState)
  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
      clearTabDocumentState(details.tabId)
      return
    }

    clearFrameInjectedDocumentState(details.tabId, details.frameId)
  })

  // Listen for iframe loads and inject content scripts programmatically
  // This catches iframes that Chrome's manifest-based all_frames: true misses
  // (e.g., dynamically created iframes, sandboxed iframes like edX)
  browser.webNavigation.onCompleted.addListener(async (details) => {
    // Skip main frame (frameId === 0), only handle iframes
    if (details.frameId === 0)
      return

    const frameKey = getFrameInjectionKey(details)
    const documentKey = getDocumentInjectionKey(details)
    if (documentKey) {
      if (
        pendingDocumentKeys.has(documentKey)
        || injectedDocumentKeysByFrame.get(frameKey) === documentKey
      ) {
        return
      }

      pendingDocumentKeys.add(documentKey)
    }

    try {
      let siteControlUrl: string | undefined

      try {
        const config = await getLocalConfig()
        const frames = await browser.webNavigation.getAllFrames({ tabId: details.tabId }) ?? []
        const liveFrameIds = new Set(frames.map(frame => frame.frameId))
        liveFrameIds.add(details.frameId)
        pruneInjectedFrames(details.tabId, liveFrameIds)

        siteControlUrl = resolveSiteControlUrl(
          details.frameId,
          details.url,
          frames,
          getParentFrameIdHint(details),
        )

        if (!siteControlUrl || !isSiteEnabled(siteControlUrl, config)) {
          return
        }
      }
      catch (error) {
        logger.error("[Background][IframeInjection] Failed to resolve iframe injection prerequisites", error)
        return
      }

      try {
        const target = getInjectionTarget(details) as Parameters<typeof browser.scripting.executeScript>[0]["target"]

        await browser.scripting.executeScript({
          target,
          func: setInjectedSiteControlUrl,
          args: [SITE_CONTROL_URL_WINDOW_KEY, siteControlUrl],
        })

        // Inject host.content script into the iframe
        await browser.scripting.executeScript({
          target,
          files: ["/content-scripts/host.js"],
        })

        // Inject selection.content script into the iframe
        await browser.scripting.executeScript({
          target,
          files: ["/content-scripts/selection.js"],
        })

        if (documentKey) {
          injectedDocumentKeysByFrame.set(frameKey, documentKey)
        }
      }
      catch (error) {
        logger.warn("[Background][IframeInjection] Failed to inject iframe content scripts", error)
      }
    }
    finally {
      if (documentKey) {
        pendingDocumentKeys.delete(documentKey)
      }
    }
  })
}
