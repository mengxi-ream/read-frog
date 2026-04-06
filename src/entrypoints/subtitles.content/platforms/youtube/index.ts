import { YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { youtubeConfig } from "./config"

export function setupYoutubeSubtitles() {
  const subtitlesFetcher = new YoutubeSubtitlesFetcher()

  return new UniversalVideoAdapter({
    config: youtubeConfig,
    subtitlesFetcher,
  })
}
