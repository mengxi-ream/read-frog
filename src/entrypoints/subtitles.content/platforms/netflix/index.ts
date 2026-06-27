import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { NetflixSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { getNetflixConfig } from "./config"

export { getNetflixConfig }

export function createNetflixSubtitlesAdapter(config: PlatformConfig = getNetflixConfig()) {
  return new UniversalVideoAdapter({
    config,
    subtitlesFetcher: new NetflixSubtitlesFetcher(),
  })
}
