import type { ContentScriptContext } from "#imports"
import {
  bilibiliTrackSource,
  TrackSubtitlesFetcher,
  watchBilibiliTrackChoices,
} from "@/utils/subtitles/fetchers"
import { getBilibiliConfig } from "./platforms/bilibili/config"
import { pollPlayerSubtitles } from "./poll-player-subtitles"
import { UniversalVideoAdapter } from "./universal-adapter"

export function initBilibiliSubtitles(ctx: ContentScriptContext) {
  if (window.location.hostname !== "www.bilibili.com") {
    return
  }

  ctx.onInvalidated(watchBilibiliTrackChoices())
  const config = getBilibiliConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new TrackSubtitlesFetcher(bilibiliTrackSource) },
  })
  // The track key carries the player pick and the reader's languages, so a change loads ours again.
  pollPlayerSubtitles(ctx, {
    adapter,
    config,
    onStay: () => void adapter.handleSourceTrackChanged(),
  })
}
