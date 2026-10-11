import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { displaySubtitleAtom } from "../atoms"

interface Point {
  x: number
  y: number
}

export const wordLookupAtom = atom<{ cueStart: number; tokenIndex: number; anchor: Point } | null>(
  null,
)

let nextSessionKey = 0

export const openWordLookupAtom = atom(
  null,
  (get, set, { tokenIndex, term, anchor }: { tokenIndex: number; term: string; anchor: Point }) => {
    const cue = get(displaySubtitleAtom)

    nextSessionKey += 1
    set(wordLookupAtom, { cueStart: cue?.start ?? -1, tokenIndex, anchor })
    set(customActionRequestAtom, {
      actionId: BUILT_IN_DICTIONARY_ACTION_ID,
      selectionText: term,
      contextText: cue ? [cue.text, cue.translation].filter(Boolean).join("\n\n") : term,
      surface: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
      sessionKey: nextSessionKey,
      rerunNonce: 0,
    })
  },
)

export const closeWordLookupAtom = atom(null, (_get, set) => {
  set(wordLookupAtom, null)
  set(customActionRequestAtom, null)
})
