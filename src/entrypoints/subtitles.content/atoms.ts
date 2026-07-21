import type { ViewId } from "./ui/subtitles-settings-panel/views"
import type { SubtitlesSource } from "@/utils/constants/subtitles"
import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { atom, createStore } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SUBTITLE_POSITION, SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { hasRenderableSubtitleByMode, isAwaitingTranslation } from "@/utils/subtitles/display-rules"
import { ROOT_VIEW } from "./ui/subtitles-settings-panel/views"

export const subtitlesStore = createStore()

export const currentTimeMsAtom = atom<number>(0)

/**
 * True while the host player is playing an ad (e.g. YouTube mid-roll).
 * Suppresses overlay content so main-video captions are not shown over ads.
 * Does not change user toggle intent (`subtitlesVisibleAtom`).
 */
export const adPlayingAtom = atom<boolean>(false)

/** Scheduler’s current *translated* cue only (null when no translated cue covers now). */
export const currentSubtitleAtom = atom<SubtitlesFragment | null>(null)

/** Best original track (baseline or AI-segmented). Read-only for display/coordinator consumers. */
export const sourceTrackAtom = atom<SubtitlesFragment[]>([])

/**
 * Display cue: prefer a translated scheduler cue; otherwise fall back to the source track
 * at the current time (used for original / pending bilingual UI).
 */
export const displaySubtitleAtom = atom((get): SubtitlesFragment | null => {
  if (get(adPlayingAtom)) {
    return null
  }

  const scheduled = get(currentSubtitleAtom)
  if (scheduled) {
    return scheduled
  }

  const timeMs = get(currentTimeMsAtom)
  return get(sourceTrackAtom).find((f) => f.start <= timeMs && f.end > timeMs) ?? null
})

export const subtitlesStateAtom = atom<StateData | null>(null)

export const subtitlesVisibleAtom = atom<boolean>(false)

export const subtitlesSourceAtom = atom<SubtitlesSource>(SUBTITLES_SOURCE.NATIVE)

export const subtitlesSettingsPanelOpenAtom = atom<boolean>(false)

export const subtitlesSettingsPanelViewAtom = atom<ViewId>(ROOT_VIEW)

export const TranslatedDownloadPhase = {
  Idle: "idle",
  Checking: "checking",
  Preparing: "preparing",
  Translating: "translating",
  Complete: "complete",
} as const

// eslint-disable-next-line ts/no-redeclare
export type TranslatedDownloadPhase =
  (typeof TranslatedDownloadPhase)[keyof typeof TranslatedDownloadPhase]

export const translatedSubtitlesDownloadStatusAtom = atom<{
  phase: TranslatedDownloadPhase
  progress: number | null
}>({
  phase: TranslatedDownloadPhase.Idle,
  progress: null,
})

export interface SubtitlePosition {
  percent: number
  anchor: "top" | "bottom"
}

export const subtitlesPositionAtom = atom<SubtitlePosition>({ ...DEFAULT_SUBTITLE_POSITION })

export const subtitlesDisplayAtom = atom((get) => {
  const subtitle = get(displaySubtitleAtom)
  const scheduled = get(currentSubtitleAtom)
  const stateData = get(subtitlesStateAtom)
  const isVisible = get(subtitlesVisibleAtom)
  const { style } = get(configFieldsAtomMap.videoSubtitles)

  // translationOnly must never fall back to source-only original for "content".
  const contentSubtitle =
    style.displayMode === "translationOnly" ? (scheduled?.translation ? scheduled : null) : subtitle

  return {
    subtitle: contentSubtitle,
    /** Raw display lookup including source fallback (for pending UI in bilingual). */
    displaySubtitle: subtitle,
    scheduled,
    stateData,
    isVisible,
  }
})

export const subtitlesShowStateAtom = atom((get): Exclude<SubtitlesState, "idle"> | undefined => {
  if (get(adPlayingAtom)) return undefined

  const { subtitle, stateData } = get(subtitlesDisplayAtom)
  const { style } = get(configFieldsAtomMap.videoSubtitles)
  const hasRenderable = hasRenderableSubtitleByMode(subtitle, style.displayMode)
  const isError = stateData?.state === "error"

  if (isError) return "error"

  return isAwaitingTranslation(subtitle, stateData) && !hasRenderable ? "loading" : undefined
})

export const subtitlesShowContentAtom = atom((get): boolean => {
  if (get(adPlayingAtom)) return false

  const { subtitle, stateData, isVisible } = get(subtitlesDisplayAtom)
  const { style } = get(configFieldsAtomMap.videoSubtitles)

  if (!isVisible) return false

  if (stateData?.state === "error") return false

  return hasRenderableSubtitleByMode(subtitle, style.displayMode)
})
