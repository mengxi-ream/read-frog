import type { StateData, SubtitlesFragment } from "@/utils/subtitles/types"
import { atom, createStore } from "jotai"
import { DEFAULT_SUBTITLE_POSITION } from "@/utils/constants/subtitles"

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
