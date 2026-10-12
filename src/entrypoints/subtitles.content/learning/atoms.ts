import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configAtom } from "@/utils/atoms/config"
import { resolveClickLookupAction, resolveDragLookupAction } from "@/utils/custom-actions"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"

interface Point {
  x: number
  y: number
}

interface WordRange {
  start: number
  end: number
}

export type CueWordRange = WordRange & { cueStart: number }

export const wordLookupAtom = atom<(CueWordRange & { anchor: Point }) | null>(null)

export const dragRangeAtom = atom<CueWordRange | null>(null)

function getCueParagraphs(cue: SubtitlesFragment | null, fallback: string) {
  return cue ? [cue.text, cue.translation].filter((text): text is string => !!text) : [fallback]
}

let nextSessionKey = 0

export const openWordLookupAtom = atom(
  null,
  (get, set, { start, end, text, anchor }: WordRange & { text: string; anchor: Point }) => {
    const cue = get(displaySubtitleAtom)
    const config = get(configAtom)
    const action =
      start === end ? resolveClickLookupAction(config) : resolveDragLookupAction(config)

    nextSessionKey += 1
    set(dragRangeAtom, null)
    set(wordLookupAtom, { cueStart: cue?.start ?? -1, start, end, anchor })
    set(customActionRequestAtom, {
      actionId: action.id,
      selectionText: text,
      contextText: getCueParagraphs(cue, text).join("\n\n"),
      surface: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
      sessionKey: nextSessionKey,
      rerunNonce: 0,
    })
  },
)

export const shiftWordLookupAtom = atom(null, (get, set, step: -1 | 1) => {
  const lookup = get(wordLookupAtom)
  const cue = get(displaySubtitleAtom)
  if (!lookup || lookup.start !== lookup.end || !cue || cue.start !== lookup.cueStart) {
    return
  }

  const tokens = segmentWords(cue.text, get(sourceLanguageAtom) ?? undefined)
  for (let index = lookup.start + step; index >= 0 && index < tokens.length; index += step) {
    const token = tokens[index]
    if (token?.isWord) {
      set(openWordLookupAtom, { start: index, end: index, text: token.text, anchor: lookup.anchor })
      return
    }
  }
})

export const closeWordLookupAtom = atom(null, (_get, set) => {
  set(wordLookupAtom, null)
  set(customActionRequestAtom, null)
})
