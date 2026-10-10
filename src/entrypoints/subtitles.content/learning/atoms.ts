import type { ExternalSelectionRequest } from "@/utils/external-selection"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configAtom } from "@/utils/atoms/config"
import { resolveWordLookupAction } from "@/utils/custom-actions"
import { clearExternalSelection, openExternalSelection } from "@/utils/external-selection"
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

export const wordLookupAtom = atom<{ cueStart: number; tokenIndex: number; anchor: Point } | null>(
  null,
)

export const wordSelectionAtom = atom<(WordRange & { cueStart: number }) | null>(null)

function getCueParagraphs(cue: SubtitlesFragment | null, fallback: string) {
  return cue ? [cue.text, cue.translation].filter((text): text is string => !!text) : [fallback]
}

let nextSessionKey = 0

export const openWordLookupAtom = atom(
  null,
  (get, set, { tokenIndex, term, anchor }: { tokenIndex: number; term: string; anchor: Point }) => {
    const cue = get(displaySubtitleAtom)

    nextSessionKey += 1
    set(wordSelectionAtom, null)
    set(wordLookupAtom, { cueStart: cue?.start ?? -1, tokenIndex, anchor })
    set(customActionRequestAtom, {
      actionId: resolveWordLookupAction(get(configAtom)).id,
      selectionText: term,
      contextText: getCueParagraphs(cue, term).join("\n\n"),
      surface: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
      sessionKey: nextSessionKey,
      rerunNonce: 0,
    })
  },
)

export const shiftWordLookupAtom = atom(null, (get, set, step: -1 | 1) => {
  const lookup = get(wordLookupAtom)
  const cue = get(displaySubtitleAtom)
  if (!lookup || !cue || cue.start !== lookup.cueStart) {
    return
  }

  const tokens = segmentWords(cue.text, get(sourceLanguageAtom) ?? undefined)
  for (let index = lookup.tokenIndex + step; index >= 0 && index < tokens.length; index += step) {
    const token = tokens[index]
    if (token?.isWord) {
      set(openWordLookupAtom, { tokenIndex: index, term: token.text, anchor: lookup.anchor })
      return
    }
  }
})

export const closeWordLookupAtom = atom(null, (_get, set) => {
  set(wordLookupAtom, null)
  set(customActionRequestAtom, null)
})

export const selectWordsAtom = atom(
  null,
  (
    get,
    set,
    { start, end, ...selection }: WordRange & Omit<ExternalSelectionRequest, "contextParagraphs">,
  ) => {
    const cue = get(displaySubtitleAtom)

    set(wordSelectionAtom, { cueStart: cue?.start ?? -1, start, end })
    openExternalSelection({
      ...selection,
      contextParagraphs: getCueParagraphs(cue, selection.text),
    })
  },
)

export const clearWordSelectionAtom = atom(null, (_get, set) => {
  set(wordSelectionAtom, null)
  clearExternalSelection()
})
