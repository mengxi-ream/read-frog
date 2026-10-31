import type { ContentScriptContext } from "#imports"
import { edxTrackSource, TrackSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { getEdxConfig } from "./platforms/edx/config"
import { markActiveEdxVideo } from "./platforms/edx/dom"
import { pollPlayerSubtitles } from "./poll-player-subtitles"
import { UniversalVideoAdapter } from "./universal-adapter"

export function initEdxSubtitles(ctx: ContentScriptContext) {
  // The course page shows each unit in a frame from this host, which is where the video plays.
  if (window.location.hostname !== "courses.edx.org") {
    return
  }

  const config = getEdxConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new TrackSubtitlesFetcher(edxTrackSource) },
  })
  pollPlayerSubtitles(ctx, {
    adapter,
    config,
    selectPlayer: markActiveEdxVideo,
  })
}
