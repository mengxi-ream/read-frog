import type { MouseEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
} from "@/utils/constants/custom-action"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { displaySubtitleAtom } from "../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "./atoms"
import { getSelectedWordRange } from "./selected-word-range"

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

export function SubtitleWordTokens() {
  const cue = useAtomValue(displaySubtitleAtom)
  const tokens = useAtomValue(subtitleTokensAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const lookUp = useSetAtom(lookUpAtom)
  const lineRef = useRef<HTMLSpanElement>(null)
  const isEnabled = (actionId: string) =>
    findSelectionToolbarAction(selectionToolbar, actionId)?.enabled !== false
  const clickEnabled = isEnabled(BUILT_IN_DICTIONARY_ACTION_ID)
  const dragEnabled = isEnabled(BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID)

  if (!clickEnabled && !dragEnabled) {
    return cue?.text ?? ""
  }

  // A drag across words is a native text selection. Read it when the button
  // comes up, wherever that is, and look up the words it covers instead of
  // letting the selection toolbar open on it.
  const watchSelection = () => {
    if (!dragEnabled) {
      return
    }
    window.addEventListener(
      "mouseup",
      (event) => {
        const range = lineRef.current ? getSelectedWordRange(lineRef.current) : null
        if (!range || range.start === range.end) {
          return
        }
        event.stopPropagation()
        window.getSelection()?.removeAllRanges()
        lookUp(range)
      },
      { capture: true, once: true },
    )
  }

  const isLookedUp = (index: number) =>
    lookup !== null &&
    lookup.cueStart === cue?.start &&
    index >= lookup.start &&
    index <= lookup.end

  return (
    <span
      ref={lineRef}
      data-slot="subtitle-line"
      onMouseDown={(event) => {
        stopPlayerToggle(event)
        watchSelection()
      }}
      onClick={stopPlayerToggle}
      onDoubleClick={stopPlayerToggle}
    >
      {tokens.map((token, index) =>
        token.isWord ? (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
            key={index}
            data-slot="subtitle-word"
            data-index={index}
            className={cn(
              clickEnabled && "cursor-pointer rounded-sm transition-colors hover:bg-white/25",
              isLookedUp(index) && "bg-amber-300 text-amber-950",
            )}
            onClick={() => {
              // A click that ends a selection inside one word is a selection, not a lookup.
              const selecting = lineRef.current && getSelectedWordRange(lineRef.current)
              if (clickEnabled && !selecting) {
                lookUp({ start: index, end: index })
              }
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
