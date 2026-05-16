import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"

export function createYoutubeSubtitlesAdapter(config: PlatformConfig) {
  const subtitlesFetcher = new YoutubeSubtitlesFetcher()
  return new UniversalVideoAdapter({
    config,
    subtitlesFetcher,
  })
}
