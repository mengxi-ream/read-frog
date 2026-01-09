import type { StateData, SubtitlesFragment, SubtitlesTranslationBlock } from '@/utils/subtitles/types'
import { atom, createStore } from 'jotai'

export const subtitlesStore = createStore()

export const subtitlesTranslationBlocksAtom = atom<SubtitlesTranslationBlock[]>([])

export const currentSubtitleAtom = atom<SubtitlesFragment | null>(null)

export const subtitlesStateAtom = atom<StateData | null>(null)

export const subtitlesVisibleAtom = atom<boolean>(false)

export const subtitlesTopPercentAtom = atom<number>(70)

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
