import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { netflixSiteAdapter } from "@/utils/subtitles/fetchers/netflix"
import { StreamingSubtitlesFetcher } from "@/utils/subtitles/fetchers/streaming/streaming-fetcher"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getNetflixConfig } from "./config"

export { getNetflixConfig }

export function createNetflixSubtitlesAdapter(config: PlatformConfig = getNetflixConfig()) {
  return new UniversalVideoAdapter({
    config,
    subtitlesFetcher: new StreamingSubtitlesFetcher(netflixSiteAdapter),
  })
}
