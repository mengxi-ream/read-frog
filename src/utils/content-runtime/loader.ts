import type { ContentRuntime, ContentRuntimePart } from "./parts"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"
import { shouldSkipDocument } from "./page-guards"
import { CONTENT_RUNTIME_MODULE_FILE } from "./parts"

// A first look at site control, from the stored config as it is. Each part
// parses the config and checks again; this only spares a disabled site the
// runtime import, so anything unexpected lets the import go ahead.
async function isSiteEnabledByStoredConfig() {
  try {
    const { [CONFIG_STORAGE_KEY]: config } = await browser.storage.local.get(CONFIG_STORAGE_KEY)
    // Unparsed: a malformed one throws into the catch below
    return isSiteEnabled(
      getEffectiveSiteControlUrl(window.location.href),
      (config as Config | undefined) ?? null,
    )
  } catch {
    return true
  }
}

/**
 * Loads the shared content runtime and runs `parts` in this document. Shared
 * by the loader content script every page gets and the ebook section script.
 */
export async function runContentLoader(parts: readonly ContentRuntimePart[]) {
  if (parts.length === 0 || shouldSkipDocument(document)) return
  if (!(await isSiteEnabledByStoredConfig())) return

  const runtimeModule = await import(
    /* @vite-ignore */ browser.runtime.getURL(CONTENT_RUNTIME_MODULE_FILE)
  )
  const runtime: ContentRuntime = await runtimeModule.default
  await runtime.runContentParts(parts)
}
