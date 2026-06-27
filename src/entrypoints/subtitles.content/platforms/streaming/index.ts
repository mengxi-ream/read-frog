import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { StreamingSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getStreamingConfig } from "./config"

export function createStreamingSubtitlesAdapter(config: PlatformConfig = getStreamingConfig()) {
  return new UniversalVideoAdapter({
    config,
    subtitlesFetcher: new StreamingSubtitlesFetcher(),
  })
}
