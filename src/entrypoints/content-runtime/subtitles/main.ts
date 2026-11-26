import type { ContentScriptContext } from "#imports"
import type { Config } from "@/types/config/config"
import { bootstrapSubtitlesRuntime } from "@/entrypoints/subtitles.content/runtime"
import { getLocalConfig } from "@/utils/config/storage"
import { getTopPageUrl } from "@/utils/content-runtime/top-page-url"
import { initI18n } from "@/utils/i18n"
import { getEffectiveSiteControlUrl, isFrameSiteEnabled } from "@/utils/site-control"
import { isSubtitlesOffOnHost } from "@/utils/subtitles/platform-host"

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
  if (
    !config ||
    isSubtitlesOffOnHost(config.videoSubtitles, window.location.hostname) ||
    !(await isSiteEnabledHere(config))
  ) {
    window.__READ_FROG_SUBTITLES_INJECTED__ = false
    return
  }

  await initI18n(config.uiLanguage)

  ctx.onInvalidated(() => {
    window.__READ_FROG_SUBTITLES_INJECTED__ = false
  })

  bootstrapSubtitlesRuntime(ctx)
}

// The subtitles loader's site check again, with the parsed config
async function isSiteEnabledHere(config: Config) {
  const frameUrl = getEffectiveSiteControlUrl(window.location.href)
  const pageUrl = (await getTopPageUrl()) ?? frameUrl
  return isFrameSiteEnabled(frameUrl, pageUrl, config)
}
