import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { StreamingSiteAdapter } from "@/utils/subtitles/fetchers/streaming/streaming-fetcher"
import { netflixSiteAdapter } from "@/utils/subtitles/fetchers/netflix"
import { StreamingSubtitlesFetcher } from "@/utils/subtitles/fetchers/streaming/streaming-fetcher"
import { UniversalVideoAdapter } from "../universal-adapter"
import { getNetflixConfig } from "./netflix/config"

export interface StreamingSite {
  adapter: StreamingSiteAdapter
  getConfig: () => PlatformConfig
}

const STREAMING_SITES: StreamingSite[] = [
  {
    adapter: netflixSiteAdapter,
    getConfig: getNetflixConfig,
  },
]

export function findStreamingSite(url: URL): StreamingSite | null {
  return STREAMING_SITES.find(site => site.adapter.matches(url)) ?? null
}

export function createStreamingSubtitlesAdapter(site: StreamingSite): { config: PlatformConfig, adapter: UniversalVideoAdapter } {
  const config = site.getConfig()
  return {
    config,
    adapter: new UniversalVideoAdapter({
      config,
      subtitlesFetcher: new StreamingSubtitlesFetcher(site.adapter),
    }),
  }
}
