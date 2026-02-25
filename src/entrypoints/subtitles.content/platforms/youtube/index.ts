import { YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"
import { youtubeConfig } from "./config"

export function setupYoutubeSubtitles() {
  const subtitlesFetcher = new YoutubeSubtitlesFetcher()

  const adapter = new UniversalVideoAdapter({
    config: youtubeConfig,
    subtitlesFetcher,
  })

  void adapter.initialize()
}
