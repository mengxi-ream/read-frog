import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
} from "@/utils/constants/custom-action"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"

/** A run of tokens in the cue on screen, both ends inclusive. */
export interface WordRange {
  start: number
  end: number
}

/** The words being looked up, and the cue they belong to. The only lookup state. */
export const wordLookupAtom = atom<(WordRange & { cueStart: number }) | null>(null)

/** The cue on screen, cut into words and the text between them. */
export const subtitleTokensAtom = atom((get) =>
  segmentWords(get(displaySubtitleAtom)?.text ?? "", get(sourceLanguageAtom) ?? undefined),
)

let nextSessionKey = 0

/**
 * The one way in: every gesture looks up a range of words, and `null` closes
 * the lookup. Also hands the shared AI action card what to run: Dictionary for
 * one word, Sentence Analysis for several.
 */
export const lookUpAtom = atom(null, (get, set, range: WordRange | null) => {
  if (!range) {
    set(wordLookupAtom, null)
    set(customActionRequestAtom, null)
    return
  }

  const cue = get(displaySubtitleAtom)
  const text = get(subtitleTokensAtom)
    .slice(range.start, range.end + 1)
    .map((token) => token.text)
    .join("")
    .trim()

  nextSessionKey += 1
  set(wordLookupAtom, { cueStart: cue?.start ?? -1, start: range.start, end: range.end })
  set(customActionRequestAtom, {
    actionId:
      range.start === range.end
        ? BUILT_IN_DICTIONARY_ACTION_ID
        : BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
    selectionText: text,
    contextText: cue ? [cue.text, cue.translation].filter(Boolean).join("\n\n") : text,
    surface: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
    sessionKey: nextSessionKey,
    rerunNonce: 0,
  })
})
