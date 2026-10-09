import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { displaySubtitleAtom } from "../atoms"

export interface WordLookupSession {
  /** Start time of the cue the word was clicked in; the highlight only applies to that cue. */
  cueStart: number
  /** Index of the clicked token within that cue's original line. */
  tokenIndex: number
  term: string
  anchor: { x: number; y: number }
}

/** The word the viewer is looking up; null while no card is open. */
export const wordLookupAtom = atom<WordLookupSession | null>(null)

let nextSessionKey = 0

/**
 * Opens a lookup for one word of the current cue. Writes the session and the
 * custom action request together, so the card and the highlight never
 * disagree about what is being looked up.
 */
export const openWordLookupAtom = atom(
  null,
  (get, set, session: Omit<WordLookupSession, "cueStart">) => {
    const cue = get(displaySubtitleAtom)
    const contextText = cue
      ? [cue.text, cue.translation].filter(Boolean).join("\n\n")
      : session.term

    nextSessionKey += 1
    set(wordLookupAtom, { ...session, cueStart: cue?.start ?? -1 })
    set(customActionRequestAtom, {
      actionId: BUILT_IN_DICTIONARY_ACTION_ID,
      selectionText: session.term,
      contextText,
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
