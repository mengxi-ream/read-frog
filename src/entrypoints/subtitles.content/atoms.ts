import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { atom, createStore } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SUBTITLE_POSITION } from "@/utils/constants/subtitles"
import { hasRenderableSubtitleByMode, isAwaitingTranslation } from "@/utils/subtitles/display-rules"

export const subtitlesStore = createStore()

export const currentTimeMsAtom = atom<number>(0)

export const currentSubtitleAtom = atom<SubtitlesFragment | null>(null)

export const subtitlesStateAtom = atom<StateData | null>(null)

export const subtitlesVisibleAtom = atom<boolean>(false)

export interface SubtitlePosition {
  percent: number
  anchor: "top" | "bottom"
}

export const subtitlesPositionAtom = atom<SubtitlePosition>({ ...DEFAULT_SUBTITLE_POSITION })

export const subtitlesDisplayAtom = atom((get) => {
  const subtitle = get(currentSubtitleAtom)
  const stateData = get(subtitlesStateAtom)
  const isVisible = get(subtitlesVisibleAtom)

  return {
    subtitle,
    stateData,
    isVisible,
  }
})

export const subtitlesShowStateAtom = atom((get): Exclude<SubtitlesState, "idle"> | undefined => {
  const { subtitle, stateData } = get(subtitlesDisplayAtom)
  const { style } = get(configFieldsAtomMap.videoSubtitles)
  const hasRenderable = hasRenderableSubtitleByMode(subtitle, style.displayMode)
  const isError = stateData?.state === "error"

  if (isError)
    return "error"

  return isAwaitingTranslation(subtitle, stateData) && !hasRenderable ? "loading" : undefined
})

export const subtitlesShowContentAtom = atom((get): boolean => {
  const { subtitle, stateData, isVisible } = get(subtitlesDisplayAtom)
  const { style } = get(configFieldsAtomMap.videoSubtitles)

  if (!isVisible)
    return false

  if (stateData?.state === "error")
    return false

  return hasRenderableSubtitleByMode(subtitle, style.displayMode)
})
