import type { ContentRuntime, ContentRuntimePart } from "./parts"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"
import { shouldSkipDocument } from "./page-guards"
import { CONTENT_RUNTIME_MODULE_FILE } from "./parts"

export interface ContentLoaderOptions {
  /**
   * The url of the page this frame is in, for a loader the manifest injects
   * into frames on other sites' pages, such as an embedded video player. Site
   * control then follows that page too, as it does for the frames the
   * background injects.
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

function isSiteEnabledByStoredConfig(url: string, config: Config | null) {
  try {
    return isSiteEnabled(url, config)
  } catch {
    return true
  }
}

// Subtitles run in every frame of a video site, so with them switched off the
// loader spares those frames the import. The other parts check their own
// switches once loaded.
function isSwitchedOff(part: ContentRuntimePart, config: Config | null) {
  return part === "subtitles" && config?.videoSubtitles?.enabled === false
}

/** The parts worth importing the runtime for in this document: none on a disabled site. */
export async function selectPartsToRun(
  parts: readonly ContentRuntimePart[],
  { getTopPageUrl }: ContentLoaderOptions = {},
): Promise<readonly ContentRuntimePart[]> {
  const config = await readStoredConfig()
  if (!isSiteEnabledByStoredConfig(getEffectiveSiteControlUrl(window.location.href), config)) {
    return []
  }

  const partsToRun = parts.filter((part) => !isSwitchedOff(part, config))
  if (partsToRun.length === 0 || !getTopPageUrl) return partsToRun

  const topPageUrl = await getTopPageUrl().catch(() => null)
  return topPageUrl && !isSiteEnabledByStoredConfig(topPageUrl, config) ? [] : partsToRun
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
