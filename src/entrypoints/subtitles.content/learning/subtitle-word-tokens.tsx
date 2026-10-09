import type { MouseEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"
import { openWordLookupAtom, wordLookupAtom } from "./atoms"

/** Room above the subtitle line for the card, so it does not open on top of the words. */
const CARD_CLEARANCE_PX = 300

function stopPlayerToggle(event: MouseEvent) {
  // The host player toggles playback on a click anywhere over the video,
  // including over this overlay.
  event.stopPropagation()
}

export function SubtitleWordTokens({ text }: { text: string }) {
  const locale = useAtomValue(sourceLanguageAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const openLookup = useSetAtom(openWordLookupAtom)
  const tokens = useMemo(() => segmentWords(text, locale ?? undefined), [locale, text])
  const dictionary = findSelectionToolbarAction(selectionToolbar, BUILT_IN_DICTIONARY_ACTION_ID)

  if (!dictionary || dictionary.enabled === false) {
    return text
  }

  const highlightedIndex = lookup && lookup.cueStart === cue?.start ? lookup.tokenIndex : null

  return tokens.map((token, index) =>
    token.isWord ? (
      <span
        // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
        key={index}
        data-slot="subtitle-word"
        className={cn(
          "cursor-pointer rounded-sm transition-colors hover:bg-white/25",
          highlightedIndex === index && "bg-amber-300 text-amber-950",
        )}
        onMouseDown={stopPlayerToggle}
        onDoubleClick={stopPlayerToggle}
        onClick={(event) => {
          stopPlayerToggle(event)
          const wordRect = event.currentTarget.getBoundingClientRect()
          const boxRect = event.currentTarget
            .closest(`.${SUBTITLES_BOX_CLASS}`)
            ?.getBoundingClientRect()
          openLookup({
            tokenIndex: index,
            term: token.text,
            anchor: {
              x: wordRect.left,
              y: Math.max(0, (boxRect?.top ?? wordRect.top) - CARD_CLEARANCE_PX),
            },
          })
        }}
      >
        {token.text}
      </span>
    ) : (
      token.text
    ),
  )
}
