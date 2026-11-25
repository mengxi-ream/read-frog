import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  XCOM_AUTO_GENERATED_TRACK_MARK,
  XCOM_RENDER_TRACK_LABEL,
} from "@/utils/constants/subtitles"
import { AiSubtitlesFetcher, TextTrackFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getCurrentXcomSubtitlesVideo, getCurrentXcomVideoId } from "./dom"

// In-band captions, as a broadcast replay's, arrive just ahead of playback: one read would keep
// only their first seconds. Uploaded and auto-generated tracks are "subtitles".
export function isXcomSourceTrack(track: Pick<TextTrack, "kind" | "label">): boolean {
  return track.kind !== "captions" && track.label !== XCOM_RENDER_TRACK_LABEL
}

export function createXcomSubtitlesAdapter(config: PlatformConfig) {
  const { createAiSubtitlesContext } = config
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () =>
        new TextTrackFetcher({
          resolveVideo: getCurrentXcomSubtitlesVideo,
          getVideoId: getCurrentXcomVideoId,
          isSourceTrack: isXcomSourceTrack,
          isBroadcastTimed: (track) => !track.label.includes(XCOM_AUTO_GENERATED_TRACK_MARK),
        }),
      ...(createAiSubtitlesContext
        ? { ai: () => new AiSubtitlesFetcher(createAiSubtitlesContext) }
        : {}),
    },
  })
}
