import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { XcomSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"

export function createXcomSubtitlesAdapter(config: PlatformConfig) {
  const subtitlesFetcher = new XcomSubtitlesFetcher()
  return new UniversalVideoAdapter({
    config,
    subtitlesFetcher,
  })
}
