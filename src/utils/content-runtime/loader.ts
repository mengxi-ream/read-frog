import type { ContentRuntime, ContentRuntimePart } from "./parts"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { getEffectiveSiteControlUrl, isFrameSiteEnabled } from "@/utils/site-control"
import { isSubtitlesOffOnHost } from "@/utils/subtitles/platform-host"
import { shouldSkipDocument } from "./page-guards"
import { CONTENT_RUNTIME_MODULE_FILE } from "./parts"

export interface ContentLoaderOptions {
  /**
   * The url of the page in the tab, for a loader the manifest injects into
   * frames on other sites' pages, such as an embedded video player. Site
   * control then goes by that page as well as the frame (see
   * isFrameSiteEnabled). When it can't be found out, the frame counts as a
   * page of its own.
   */
  getTopPageUrl?: () => Promise<string | null>
}

// The checks below read the stored config as it is, unparsed: they only spare
// a page the runtime import. Each part parses the config and checks again, so
// anything unexpected here lets the import go ahead.
async function readStoredConfig(): Promise<Config | null> {
  try {
    const { [CONFIG_STORAGE_KEY]: config } = await browser.storage.local.get(CONFIG_STORAGE_KEY)
    return (config as Config | undefined) ?? null
  } catch {
    return null
  }
}

function isFrameSiteEnabledByStoredConfig(
  frameUrl: string,
  pageUrl: string,
  config: Config | null,
) {
  try {
    return isFrameSiteEnabled(frameUrl, pageUrl, config)
  } catch {
    return true
  }
}

// Subtitles run in every frame of a video site, so with them off for this
// frame's site the loader spares the frame the import. The other parts check
// their own switches once loaded.
function isSwitchedOff(part: ContentRuntimePart, config: Config | null) {
  return (
    part === "subtitles" && isSubtitlesOffOnHost(config?.videoSubtitles, window.location.hostname)
  )
}

/** The parts worth importing the runtime for in this document: none on a disabled site. */
export async function selectPartsToRun(
  parts: readonly ContentRuntimePart[],
  { getTopPageUrl }: ContentLoaderOptions = {},
): Promise<readonly ContentRuntimePart[]> {
  const config = await readStoredConfig()
  const partsToRun = parts.filter((part) => !isSwitchedOff(part, config))
  if (partsToRun.length === 0) return []

  const frameUrl = getEffectiveSiteControlUrl(window.location.href)
  const pageUrl = (await getTopPageUrl?.().catch(() => null)) ?? frameUrl
  return isFrameSiteEnabledByStoredConfig(frameUrl, pageUrl, config) ? partsToRun : []
}

/**
 * Loads the shared content runtime and runs `parts` in this document. Shared
 * by the loader content script every page gets, the subtitles loader on video
 * sites and the ebook section script.
 */
export async function runContentLoader(
  parts: readonly ContentRuntimePart[],
  options?: ContentLoaderOptions,
) {
  if (parts.length === 0 || shouldSkipDocument(document)) return
  const partsToRun = await selectPartsToRun(parts, options)
  if (partsToRun.length === 0) return

  const runtimeModule = await import(
    /* @vite-ignore */ browser.runtime.getURL(CONTENT_RUNTIME_MODULE_FILE)
  )
  const runtime: ContentRuntime = await runtimeModule.default
  await runtime.runContentParts(partsToRun)
}
