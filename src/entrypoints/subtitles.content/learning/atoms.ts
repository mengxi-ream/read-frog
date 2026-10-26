import { atom } from "jotai"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configAtom } from "@/utils/atoms/config"
import { resolveWordLookupAction } from "@/utils/custom-actions"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"

/** The word being looked up, by its place in the cue's tokens. The only lookup state. */
export const wordLookupAtom = atom<{ cueStart: number; index: number } | null>(null)

/** Whether the pointer is over the subtitles. */
export const subtitlesHoveredAtom = atom(false)

/**
 * Whether the subtitles hold still, while the pointer is on them or a lookup is
 * open: the video stays paused and the box stays where it is.
 */
export const subtitlesHeldAtom = atom(
  (get) => get(subtitlesHoveredAtom) || get(wordLookupAtom) !== null,
)

/** The cue on screen, cut into words and the text between them. */
export const subtitleTokensAtom = atom((get) =>
  segmentWords(get(displaySubtitleAtom)?.text ?? "", get(sourceLanguageAtom) ?? undefined),
)

let nextSessionKey = 0

/**
 * The one way in: looks up the word at `index` in the cue on screen, or closes
 * the lookup with `null`. Also hands the shared AI action card the action
 * picked for word lookups in settings.
 */
export const lookUpAtom = atom(null, (get, set, index: number | null) => {
  const cue = get(displaySubtitleAtom)
  const word = index === null ? undefined : get(subtitleTokensAtom)[index]
  const action = resolveWordLookupAction(get(configAtom))
  if (!cue || index === null || !word?.isWord || action.enabled === false) {
    set(wordLookupAtom, null)
    set(customActionRequestAtom, null)
    return
  }

  nextSessionKey += 1
  set(wordLookupAtom, { cueStart: cue.start, index })
  set(customActionRequestAtom, {
    actionId: action.id,
    selectionText: word.text,
    cleanSelection: word.text,
    contextText: [cue.text, cue.translation].filter(Boolean).join("\n\n"),
    surface: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
    sessionKey: nextSessionKey,
    rerunNonce: 0,
  })
})
