import type { SubtitlesFragment } from "../types"
import { optimizeSubtitles } from "./optimizer"

export function processFetchedSourceSubtitles(
  fragments: SubtitlesFragment[],
  sourceLanguage: string,
): SubtitlesFragment[] {
  return optimizeSubtitles(fragments, sourceLanguage)
}
