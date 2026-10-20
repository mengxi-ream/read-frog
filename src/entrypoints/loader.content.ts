import type { Config } from "@/types/config/config"
import type { ContentRuntime } from "@/utils/content-runtime/parts"
import { browser, defineContentScript } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { shouldSkipDocument } from "@/utils/content-runtime/page-guards"
import { CONTENT_RUNTIME_MODULE_FILE, takeRequestedParts } from "@/utils/content-runtime/parts"
import { getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"

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

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  async main() {
    const parts = takeRequestedParts(globalThis, window === window.top)

    if (parts.length === 0 || shouldSkipDocument(document)) return
    if (!(await isSiteEnabledByStoredConfig())) return

    const runtimeModule = await import(
      /* @vite-ignore */ browser.runtime.getURL(CONTENT_RUNTIME_MODULE_FILE)
    )
    const runtime: ContentRuntime = await runtimeModule.default
    await runtime.runContentParts(parts)
  },
})
