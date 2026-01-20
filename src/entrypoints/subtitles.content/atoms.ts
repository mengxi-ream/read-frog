import type { StateData, SubtitlesFragment, SubtitlesTranslationBlock } from '@/utils/subtitles/types'
import { atom, createStore } from 'jotai'

export const subtitlesStore = createStore()

export const subtitlesTranslationBlocksAtom = atom<SubtitlesTranslationBlock[]>([])

export const currentTimeMsAtom = atom<number>(0)

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

export const currentBlockCompletedAtom = atom((get) => {
  const currentTimeMs = get(currentTimeMsAtom)
  const blocks = get(subtitlesTranslationBlocksAtom)

  const currentBlock = blocks.find(
    block => block.startMs <= currentTimeMs && block.endMs > currentTimeMs,
  )

  return currentBlock?.state === 'completed'
})
