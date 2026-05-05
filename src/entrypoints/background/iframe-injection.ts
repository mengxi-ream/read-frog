import type { FrameInfoForSiteControl } from "./iframe-injection-utils"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { isSiteEnabled, SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"
import { resolveSiteControlUrl } from "./iframe-injection-utils"
import { getPageTranslationEnabled } from "./page-translation-state"

const pendingDocumentKeys = new Set<string>()
const injectedDocumentKeysByFrame = new Map<string, string>()

interface FrameInjectionDetails {
  tabId: number
  frameId: number
  documentId?: string
  parentFrameId?: number
  url?: string
}

interface InjectHostContentIntoTabIframesOptions {
  requirePageTranslationEnabled?: boolean
}

function getDocumentInjectionKey(details: FrameInjectionDetails) {
  // documentId is best, but getAllFrames may not expose it. Fall back to URL so
  // explicit per-tab injections still dedupe until the frame navigates.
  return `${details.tabId}:${details.frameId}:${details.documentId ?? details.url ?? "unknown"}`
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

function getInjectionTarget(details: FrameInjectionDetails) {
  if (details.documentId) {
    return { tabId: details.tabId, documentIds: [details.documentId] }
  }

  return { tabId: details.tabId, frameIds: [details.frameId] }
}

async function getFrameSnapshot(tabId: number): Promise<FrameInfoForSiteControl[]> {
  return await browser.webNavigation.getAllFrames({ tabId }) ?? []
}

async function getShouldInjectHostContentIntoTabIframes(
  tabId: number,
  existingConfig?: Config | null,
  options: InjectHostContentIntoTabIframesOptions = {},
): Promise<{ config: Config | null, shouldInject: boolean }> {
  const requirePageTranslationEnabled = options.requirePageTranslationEnabled ?? true
  const [isPageTranslationEnabled, config] = await Promise.all([
    requirePageTranslationEnabled ? getPageTranslationEnabled(tabId) : Promise.resolve(true),
    existingConfig === undefined ? getLocalConfig() : Promise.resolve(existingConfig),
  ])

  return {
    config,
    shouldInject: isPageTranslationEnabled,
  }
}

async function injectHostContentIntoFrame(
  details: FrameInjectionDetails,
  frames?: FrameInfoForSiteControl[],
  existingConfig?: Config | null,
) {
  const frameKey = getFrameInjectionKey(details)
  const documentKey = getDocumentInjectionKey(details)

  if (
    pendingDocumentKeys.has(documentKey)
  ) {
    return
  }
  if (injectedDocumentKeysByFrame.get(frameKey) === documentKey) {
    return
  }

  pendingDocumentKeys.add(documentKey)

  try {
    let siteControlUrl: string | undefined

    try {
      const [config, frameSnapshot] = await Promise.all([
        existingConfig === undefined ? getLocalConfig() : Promise.resolve(existingConfig),
        frames === undefined ? getFrameSnapshot(details.tabId) : Promise.resolve(frames),
      ])
      const liveFrameIds = new Set(frameSnapshot.map(frame => frame.frameId))
      liveFrameIds.add(details.frameId)
      pruneInjectedFrames(details.tabId, liveFrameIds)

      siteControlUrl = resolveSiteControlUrl(
        details.frameId,
        details.url,
        frameSnapshot,
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

      await browser.scripting.executeScript({
        target,
        files: ["/content-scripts/host.js"],
      })

      injectedDocumentKeysByFrame.set(frameKey, documentKey)
    }
    catch (error) {
      logger.warn("[Background][IframeInjection] Failed to inject iframe content scripts", error)
    }
  }
  finally {
    pendingDocumentKeys.delete(documentKey)
  }
}

export async function injectHostContentIntoTabIframes(
  tabId: number,
  options: InjectHostContentIntoTabIframesOptions = {},
) {
  let config: Config | null
  let shouldInject: boolean
  try {
    ({ config, shouldInject } = await getShouldInjectHostContentIntoTabIframes(tabId, undefined, options))
  }
  catch (error) {
    logger.warn("[Background][IframeInjection] Failed to resolve iframe injection state", error)
    return
  }

  if (!shouldInject)
    return

  let frames: FrameInfoForSiteControl[]
  try {
    frames = await getFrameSnapshot(tabId)
  }
  catch (error) {
    logger.error("[Background][IframeInjection] Failed to resolve tab iframe injection prerequisites", error)
    return
  }

  const liveFrameIds = new Set(frames.map(frame => frame.frameId))
  pruneInjectedFrames(tabId, liveFrameIds)

  await Promise.all(frames
    .filter(frame => frame.frameId !== 0)
    .map(frame => injectHostContentIntoFrame({
      tabId,
      frameId: frame.frameId,
      parentFrameId: frame.parentFrameId,
      url: frame.url,
    }, frames, config)))
}

export async function injectHostContentIntoCurrentTabIframesAfterNodeTranslation(tabId: number) {
  await injectHostContentIntoTabIframes(tabId, { requirePageTranslationEnabled: false })
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

  // Only page translation eagerly injects host content into newly completed
  // subframes. Top-frame node translation can separately scan existing iframes
  // once, but it does not enable late iframe injection.
  browser.webNavigation.onCompleted.addListener(async (details) => {
    // Skip main frame (frameId === 0), only handle iframes
    if (details.frameId === 0)
      return

    let config: Config | null
    let shouldInject: boolean
    try {
      ({ config, shouldInject } = await getShouldInjectHostContentIntoTabIframes(details.tabId))
      if (!shouldInject)
        return
    }
    catch (error) {
      logger.warn("[Background][IframeInjection] Failed to resolve iframe injection state", error)
      return
    }

    await injectHostContentIntoFrame(details, undefined, config)
  })
}
