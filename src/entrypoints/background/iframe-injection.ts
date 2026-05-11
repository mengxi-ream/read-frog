import type { FrameInfoForSiteControl } from "./iframe-injection-utils"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { isSiteEnabled, SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"
import { matchDomainPattern } from "@/utils/url"
import { resolveSiteControlUrl } from "./iframe-injection-utils"
import { getPageTranslationEnabled } from "./page-translation-state"

const HOST_CONTENT_SCRIPT_FILE = "/content-scripts/host.js" as const
const SELECTION_CONTENT_SCRIPT_FILE = "/content-scripts/selection.js" as const
const IFRAME_FULL_RUNTIME_AUTO_INJECT_PATTERNS = ["browse.library.kiwix.org"] as const

type IframeContentScriptFile
  = | typeof HOST_CONTENT_SCRIPT_FILE
    | typeof SELECTION_CONTENT_SCRIPT_FILE

const pendingScriptDocumentKeys = new Set<string>()
const injectedDocumentKeysByFrameAndScript = new Map<string, string>()
const fullRuntimeAutoInjectUrlByTab = new Map<number, string>()

interface FrameInjectionDetails {
  tabId: number
  frameId: number
  documentId?: string
  parentFrameId?: number
  url?: string
}

interface InjectHostContentIntoTabIframesOptions {
  requirePageTranslationEnabled?: boolean
  includeSelectionContent?: boolean
  siteControlUrlOverride?: string
}

function getDocumentInjectionKey(details: FrameInjectionDetails) {
  // documentId is best, but getAllFrames may not expose it. Fall back to URL so
  // explicit per-tab injections still dedupe until the frame navigates.
  return `${details.tabId}:${details.frameId}:${details.documentId ?? details.url ?? "unknown"}`
}

function getFrameInjectionKey(details: { tabId: number, frameId: number }) {
  return `${details.tabId}:${details.frameId}`
}

function getScriptDocumentInjectionKey(details: FrameInjectionDetails, file: IframeContentScriptFile) {
  return `${getDocumentInjectionKey(details)}:${file}`
}

function getScriptFrameInjectionKey(details: FrameInjectionDetails, file: IframeContentScriptFile) {
  return `${getFrameInjectionKey(details)}:${file}`
}

function clearTabDocumentState(tabId: number) {
  for (const key of pendingScriptDocumentKeys) {
    if (key.startsWith(`${tabId}:`)) {
      pendingScriptDocumentKeys.delete(key)
    }
  }

  for (const key of injectedDocumentKeysByFrameAndScript.keys()) {
    if (key.startsWith(`${tabId}:`)) {
      injectedDocumentKeysByFrameAndScript.delete(key)
    }
  }

  fullRuntimeAutoInjectUrlByTab.delete(tabId)
}

function clearFrameInjectedDocumentState(tabId: number, frameId: number) {
  const frameKeyPrefix = `${getFrameInjectionKey({ tabId, frameId })}:`
  for (const key of injectedDocumentKeysByFrameAndScript.keys()) {
    if (key.startsWith(frameKeyPrefix)) {
      injectedDocumentKeysByFrameAndScript.delete(key)
    }
  }
}

function pruneInjectedFrames(tabId: number, liveFrameIds: Set<number>) {
  for (const frameKey of injectedDocumentKeysByFrameAndScript.keys()) {
    if (!frameKey.startsWith(`${tabId}:`)) {
      continue
    }

    const frameId = Number(frameKey.split(":")[1])
    if (!liveFrameIds.has(frameId)) {
      injectedDocumentKeysByFrameAndScript.delete(frameKey)
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

function isFullRuntimeAutoInjectUrl(url: string | undefined): url is string {
  if (!url)
    return false

  return IFRAME_FULL_RUNTIME_AUTO_INJECT_PATTERNS.some(pattern => matchDomainPattern(url, pattern))
}

function getIframeContentScriptFiles(options: InjectHostContentIntoTabIframesOptions): IframeContentScriptFile[] {
  return options.includeSelectionContent
    ? [HOST_CONTENT_SCRIPT_FILE, SELECTION_CONTENT_SCRIPT_FILE]
    : [HOST_CONTENT_SCRIPT_FILE]
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
  options: InjectHostContentIntoTabIframesOptions = {},
) {
  const documentKey = getDocumentInjectionKey(details)
  const filesToInject = getIframeContentScriptFiles(options).filter((file) => {
    const scriptDocumentKey = getScriptDocumentInjectionKey(details, file)
    const scriptFrameKey = getScriptFrameInjectionKey(details, file)
    return !pendingScriptDocumentKeys.has(scriptDocumentKey)
      && injectedDocumentKeysByFrameAndScript.get(scriptFrameKey) !== documentKey
  })

  if (filesToInject.length === 0) {
    return
  }

  for (const file of filesToInject) {
    pendingScriptDocumentKeys.add(getScriptDocumentInjectionKey(details, file))
  }

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

      siteControlUrl = options.siteControlUrlOverride ?? resolveSiteControlUrl(
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

      for (const file of filesToInject) {
        await browser.scripting.executeScript({
          target,
          files: [file],
        })

        injectedDocumentKeysByFrameAndScript.set(
          getScriptFrameInjectionKey(details, file),
          documentKey,
        )
      }
    }
    catch (error) {
      logger.warn("[Background][IframeInjection] Failed to inject iframe content scripts", error)
    }
  }
  finally {
    for (const file of filesToInject) {
      pendingScriptDocumentKeys.delete(getScriptDocumentInjectionKey(details, file))
    }
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
    }, frames, config, options)))
}

export async function injectHostContentIntoCurrentTabIframesAfterNodeTranslation(tabId: number) {
  await injectHostContentIntoTabIframes(tabId, { requirePageTranslationEnabled: false })
}

export function setupIframeInjection() {
  browser.tabs.onRemoved.addListener(clearTabDocumentState)
  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
      clearTabDocumentState(details.tabId)
      if (isFullRuntimeAutoInjectUrl(details.url)) {
        fullRuntimeAutoInjectUrlByTab.set(details.tabId, details.url)
      }
      return
    }

    clearFrameInjectedDocumentState(details.tabId, details.frameId)
  })

  // Only page translation eagerly injects host content into newly completed
  // subframes. Top-frame node translation can separately scan existing iframes
  // once, but it does not enable late iframe injection.
  browser.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId === 0) {
      if (!isFullRuntimeAutoInjectUrl(details.url)) {
        fullRuntimeAutoInjectUrlByTab.delete(details.tabId)
        return
      }

      fullRuntimeAutoInjectUrlByTab.set(details.tabId, details.url)
      await injectHostContentIntoTabIframes(details.tabId, {
        requirePageTranslationEnabled: false,
        includeSelectionContent: true,
        siteControlUrlOverride: details.url,
      })
      return
    }

    const fullRuntimeAutoInjectUrl = fullRuntimeAutoInjectUrlByTab.get(details.tabId)
      ?? (isFullRuntimeAutoInjectUrl(details.url) ? details.url : undefined)
    if (fullRuntimeAutoInjectUrl) {
      await injectHostContentIntoFrame(details, undefined, undefined, {
        includeSelectionContent: true,
        siteControlUrlOverride: fullRuntimeAutoInjectUrl,
      })
      return
    }

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
