import type { PlatformConfig } from "."
import type { SubtitlesFetcherFactories } from "../adapter/subtitles-switch"
import { AiSubtitlesFetcher } from "@/utils/subtitles/fetchers"

/** The AI fetcher factory of a platform that can key its video for the server; none otherwise. */
export function aiFetcherFactories({
  createAiSubtitlesContext,
}: Pick<PlatformConfig, "createAiSubtitlesContext">): Pick<SubtitlesFetcherFactories, "ai"> {
  return createAiSubtitlesContext
    ? { ai: () => new AiSubtitlesFetcher(createAiSubtitlesContext) }
    : {}
}
