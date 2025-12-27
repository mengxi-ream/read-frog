import type { StateData, SubtitlesFragment, TranslationBatch } from '@/utils/subtitles/types'
import { atom, createStore } from 'jotai'

export const subtitlesStore = createStore()

export const translationBatchesAtom = atom<TranslationBatch[]>([])

export const currentTranslatingBatchIdAtom = atom<number | null>(null)

export const currentSubtitleAtom = atom<SubtitlesFragment | null>(null)

export const subtitlesStateAtom = atom<StateData | null>(null)

export const subtitlesVisibleAtom = atom<boolean>(false)

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
