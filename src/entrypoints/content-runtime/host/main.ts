import type { ContentScriptContext } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { initI18n } from "@/utils/i18n"
import {
  clearEffectiveSiteControlUrl,
  getEffectiveSiteControlUrl,
  isSiteEnabled,
} from "@/utils/site-control"
import { ensureRemoteSiteRulesLoaded } from "@/utils/site-rules/active"
import { bootstrapHostContent } from "./runtime"

declare global {
  interface Window {
    __READ_FROG_HOST_INJECTED__?: boolean
  }
}

// Page translation. Runs inside the shared content runtime, which the loader
// content script imports (see entrypoints/content-runtime).
export async function runHostContent(ctx: ContentScriptContext) {
  // Prevent double injection (manifest-based + programmatic injection)
  if (window.__READ_FROG_HOST_INJECTED__) return
  window.__READ_FROG_HOST_INJECTED__ = true

  const initialConfig = await getLocalConfig()
  const siteControlUrl = getEffectiveSiteControlUrl(window.location.href)

  if (!isSiteEnabled(siteControlUrl, initialConfig)) {
    window.__READ_FROG_HOST_INJECTED__ = false
    clearEffectiveSiteControlUrl()
    return
  }

  // Site rules resolve synchronously during translation, so the remote ones
  // must be in place before anything can start it.
  await Promise.all([initI18n(initialConfig?.uiLanguage), ensureRemoteSiteRulesLoaded()])

  await bootstrapHostContent(ctx, initialConfig)
}
