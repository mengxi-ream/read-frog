import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { XCOM_RENDER_TRACK_LABEL } from "@/utils/constants/subtitles"
import { AiSubtitlesFetcher, TextTrackFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getCurrentXcomSubtitlesVideo, getCurrentXcomVideoId } from "./dom"

export function createXcomSubtitlesAdapter(config: PlatformConfig) {
  const { createAiSubtitlesContext } = config
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () =>
        new TextTrackFetcher({
          resolveVideo: getCurrentXcomSubtitlesVideo,
          getVideoId: getCurrentXcomVideoId,
          isSourceTrack: (track) => track.label !== XCOM_RENDER_TRACK_LABEL,
        }),
      ...(createAiSubtitlesContext
        ? { ai: () => new AiSubtitlesFetcher(createAiSubtitlesContext) }
        : {}),
    },
  })
}
