import type { StateData, SubtitlesFragment } from "./types"
import type { SubtitlesDisplayMode } from "@/types/config/subtitles"

export function hasRenderableSubtitleByMode(
  subtitle: SubtitlesFragment | null,
  displayMode: SubtitlesDisplayMode,
): boolean {
  if (!subtitle) return false

  if (displayMode === "translationOnly") return !!subtitle.translation

  return true
}

export function isAwaitingTranslation(
  subtitle: SubtitlesFragment | null,
  stateData: StateData | null,
): boolean {
  return subtitle ? !subtitle.translation : stateData?.state === "loading"
}

/** True when a cue exists but translation has not been filled in yet (undefined/null). */
export function isTranslationPending(subtitle: SubtitlesFragment | null): boolean {
  return !!subtitle && (subtitle.translation === undefined || subtitle.translation === null)
}
