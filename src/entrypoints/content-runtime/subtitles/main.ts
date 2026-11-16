import type { ContentScriptContext } from "#imports"
import { bootstrapSubtitlesRuntime } from "@/entrypoints/subtitles.content/runtime"
import { getLocalConfig } from "@/utils/config/storage"
import { initI18n } from "@/utils/i18n"
import { isSiteEnabled } from "@/utils/site-control"

declare global {
  interface Window {
    __READ_FROG_SUBTITLES_INJECTED__?: boolean
  }
}

// Video subtitles. Runs inside the shared content runtime, which the subtitles
// loader imports in every frame of the video sites (see
// entrypoints/subtitles-loader.content.ts). The platform code is still in
// entrypoints/subtitles.content.
export async function runSubtitlesContent(ctx: ContentScriptContext) {
  if (window.__READ_FROG_SUBTITLES_INJECTED__) return
  window.__READ_FROG_SUBTITLES_INJECTED__ = true

  const config = await getLocalConfig()
  if (!config?.videoSubtitles.enabled || !isSiteEnabled(window.location.href, config)) {
    window.__READ_FROG_SUBTITLES_INJECTED__ = false
    return
  }

  await initI18n(config.uiLanguage)

  ctx.onInvalidated(() => {
    window.__READ_FROG_SUBTITLES_INJECTED__ = false
  })

  bootstrapSubtitlesRuntime(ctx)
}
