import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { TextTrackFetcher } from "@/utils/subtitles/fetchers"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getCurrentXcomSubtitlesVideo } from "./dom"

export function createXcomSubtitlesAdapter(config: PlatformConfig) {
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () =>
        new TextTrackFetcher({
          resolveVideo: getCurrentXcomSubtitlesVideo,
          getVideoId: getXcomStatusId,
        }),
    },
  })
}
