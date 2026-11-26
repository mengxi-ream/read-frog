import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { aiFetcherFactories } from "../ai-fetcher"

export function createYoutubeSubtitlesAdapter(config: PlatformConfig) {
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () => new YoutubeSubtitlesFetcher(),
      ...aiFetcherFactories(config),
    },
  })
}
