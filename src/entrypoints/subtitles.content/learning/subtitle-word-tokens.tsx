import type { MouseEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"
import { openWordLookupAtom, wordLookupAtom } from "./atoms"

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

export function SubtitleWordTokens() {
  const locale = useAtomValue(sourceLanguageAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const openLookup = useSetAtom(openWordLookupAtom)
  const text = cue?.text ?? ""
  const tokens = useMemo(() => segmentWords(text, locale ?? undefined), [locale, text])
  const dictionary = findSelectionToolbarAction(selectionToolbar, BUILT_IN_DICTIONARY_ACTION_ID)

  if (!dictionary || dictionary.enabled === false) {
    return text
  }

  const highlightedIndex = lookup?.cueStart === cue?.start ? lookup?.tokenIndex : null

  return (
    <span data-slot="subtitle-line">
      {tokens.map((token, index) =>
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
              openLookup({
                tokenIndex: index,
                term: token.text,
                anchor: { x: wordRect.right, y: wordRect.bottom },
              })
            }}
          >
            {token.text}
          </span>
        ) : (
          token.text
        ),
      )}
    </span>
  )
}
