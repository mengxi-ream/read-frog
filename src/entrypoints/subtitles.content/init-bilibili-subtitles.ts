import type { ContentScriptContext } from "#imports"
import { bilibiliTrackSource, TrackSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { getBilibiliConfig } from "./platforms/bilibili/config"
import { pollPlayerSubtitles } from "./poll-player-subtitles"
import { UniversalVideoAdapter } from "./universal-adapter"

export function initBilibiliSubtitles(ctx: ContentScriptContext) {
  if (window.location.hostname !== "www.bilibili.com") {
    return
  }

  const config = getBilibiliConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new TrackSubtitlesFetcher(bilibiliTrackSource) },
  })
  pollPlayerSubtitles(ctx, { adapter, config })
}
