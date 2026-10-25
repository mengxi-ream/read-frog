import type { MouseEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { displaySubtitleAtom } from "../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "./atoms"

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

export function SubtitleWordTokens() {
  const cue = useAtomValue(displaySubtitleAtom)
  const tokens = useAtomValue(subtitleTokensAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const lookUp = useSetAtom(lookUpAtom)
  const dictionary = findSelectionToolbarAction(selectionToolbar, BUILT_IN_DICTIONARY_ACTION_ID)

  if (!dictionary || dictionary.enabled === false) {
    return cue?.text ?? ""
  }

  const isLookedUp = (index: number) =>
    lookup !== null &&
    lookup.cueStart === cue?.start &&
    index >= lookup.start &&
    index <= lookup.end

  return (
    <span data-slot="subtitle-line">
      {tokens.map((token, index) =>
        token.isWord ? (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
            key={index}
            data-slot="subtitle-word"
            data-index={index}
            className={cn(
              "cursor-pointer rounded-sm transition-colors hover:bg-white/25",
              isLookedUp(index) && "bg-amber-300 text-amber-950",
            )}
            onMouseDown={stopPlayerToggle}
            onDoubleClick={stopPlayerToggle}
            onClick={(event) => {
              stopPlayerToggle(event)
              lookUp({ start: index, end: index })
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
