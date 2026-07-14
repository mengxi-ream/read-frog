import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { AiSubtitlesFetcher, YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"

export function createYoutubeSubtitlesAdapter(config: PlatformConfig) {
  const { createAiSubtitlesContext } = config
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () => new YoutubeSubtitlesFetcher(),
      ...(createAiSubtitlesContext
        ? { ai: () => new AiSubtitlesFetcher(createAiSubtitlesContext) }
        : {}),
    },
  })
}
