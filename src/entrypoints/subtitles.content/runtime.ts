import type { ContentScriptContext } from "#imports"
import { initBilibiliSubtitles } from "./init-bilibili-subtitles"
import { initNetflixSubtitles } from "./init-netflix-subtitles"
import { initUdemySubtitles } from "./init-udemy-subtitles"
import { initXcomSubtitles } from "./init-xcom-subtitles"
import { initYoutubeSubtitles } from "./init-youtube-subtitles"

let hasBootstrappedSubtitlesRuntime = false

export function bootstrapSubtitlesRuntime(ctx: ContentScriptContext) {
  if (hasBootstrappedSubtitlesRuntime) {
    return
  }

  hasBootstrappedSubtitlesRuntime = true
  initYoutubeSubtitles(ctx)
  initXcomSubtitles(ctx)
  initNetflixSubtitles(ctx)
  initBilibiliSubtitles(ctx)
  initUdemySubtitles(ctx)
}
