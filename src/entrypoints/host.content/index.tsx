import "@/utils/zod-config"
import type { ContentScriptContext } from "#imports"
import { defineContentScript } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { initI18n } from "@/utils/i18n"
import {
  clearEffectiveSiteControlUrl,
  getEffectiveSiteControlUrl,
  isSiteEnabled,
} from "@/utils/site-control"
import { waitForHostContentReady } from "./host-readiness"

declare global {
  interface Window {
    __READ_FROG_HOST_INJECTED__?: boolean
  }
}

async function initializeHostContent(ctx: ContentScriptContext): Promise<boolean> {
  const initialConfig = await getLocalConfig()
  const siteControlUrl = getEffectiveSiteControlUrl(window.location.href)

  if (!isSiteEnabled(siteControlUrl, initialConfig)) {
    window.__READ_FROG_HOST_INJECTED__ = false
    clearEffectiveSiteControlUrl()
    return false
  }

  await initI18n(initialConfig?.uiLanguage)

  const { bootstrapHostContent } = await import("./runtime")
  await bootstrapHostContent(ctx, initialConfig)
  return ctx.isValid
}

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  cssInjectionMode: "manual",
  async main(ctx) {
    // Prevent double injection (manifest-based + programmatic injection)
    if (window.__READ_FROG_HOST_INJECTED__) return
    window.__READ_FROG_HOST_INJECTED__ = true

    const ready = initializeHostContent(ctx)
    if (import.meta.env.FIREFOX) {
      await waitForHostContentReady(ctx, ready)
    } else {
      await ready
    }
  },
})
