import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { isSiteEnabled, SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"
import { resolveSiteControlUrl } from "./iframe-injection-utils"

const pendingDocumentKeys = new Set<string>()
const injectedDocumentKeysByFrame = new Map<string, string>()

function getDocumentInjectionKey(details: { tabId: number, frameId: number, documentId?: string }) {
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

function resolveSiteControlUrlSafe(details: object) {
  try {
    return (resolveSiteControlUrl as (details: object) => string)(details)
  }
  catch {
    const maybeDetails = details as { url?: string }
    return (resolveSiteControlUrl as (url?: string, parentFrameId?: number) => string)(maybeDetails.url, getParentFrameIdHint(details))
  }
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

  browser.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId === 0) {
      try {
        const frames = await browser.webNavigation.getAllFrames({ tabId: details.tabId })
        pruneInjectedFrames(details.tabId, new Set(frames.map(frame => frame.frameId)))
      }
      catch (error) {
        logger.warn("Failed to prune injected iframe state", { tabId: details.tabId, error })
      }
      return
    }

    const documentKey = getDocumentInjectionKey(details)
    const frameKey = getFrameInjectionKey(details)

    if (documentKey && pendingDocumentKeys.has(documentKey)) {
      return
    }

    if (documentKey && injectedDocumentKeysByFrame.get(frameKey) === documentKey) {
      return
    }

    if (documentKey) {
      pendingDocumentKeys.add(documentKey)
    }

    try {
      const config = await getLocalConfig()
      if (!config) {
        return
      }

      const siteControlUrl = resolveSiteControlUrlSafe(details)
      const enabled = (isSiteEnabled as (...args: unknown[]) => boolean)(siteControlUrl, config)
      if (!enabled) {
        return
      }

      await browser.scripting.executeScript({
        target: getInjectionTarget(details),
        world: "MAIN",
        func: setInjectedSiteControlUrl,
        args: [SITE_CONTROL_URL_WINDOW_KEY, siteControlUrl],
      })

      if (documentKey) {
        injectedDocumentKeysByFrame.set(frameKey, documentKey)
      }
    }
    catch (error) {
      logger.warn("Failed to inject iframe site-control bridge", { details, error })
    }
    finally {
      if (documentKey) {
        pendingDocumentKeys.delete(documentKey)
      }
    }
  })
}
