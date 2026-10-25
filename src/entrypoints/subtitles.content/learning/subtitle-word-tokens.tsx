import { useAtomValue, useSetAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { displaySubtitleAtom } from "../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "./atoms"

/**
 * Ref for a cue's line: a text selection on the line goes with it. Removing the line collapses the
 * selection anyway, but without the `selectionchange` the selection toolbar closes on.
 */
function clearSelectionWithLine(line: HTMLSpanElement | null) {
  return () => {
    const selection = window.getSelection()
    if (!line || !selection || selection.rangeCount === 0) {
      return
    }
    // Chrome reports a selection made inside a shadow root as a caret by the host, which only
    // containsNode sees through; the range catches one wholly inside the line, which some
    // engines' containsNode misses.
    if (selection.containsNode(line, true) || selection.getRangeAt(0).intersectsNode(line)) {
      selection.removeAllRanges()
    }
  }
}

export function SubtitleWordTokens() {
  const cue = useAtomValue(displaySubtitleAtom)
  const tokens = useAtomValue(subtitleTokensAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const lookUp = useSetAtom(lookUpAtom)

  if (getBuiltInDictionaryAction(selectionToolbar).enabled === false) {
    return cue?.text ?? ""
  }

  const lookedUpIndex = lookup && lookup.cueStart === cue?.start ? lookup.index : null

  return (
    // One line per cue: if the next cue reused these word spans, a text selection would move onto
    // its words instead of going with the cue.
    <span key={cue?.start} ref={clearSelectionWithLine} data-slot="subtitle-line">
      {tokens.map((token, index) =>
        token.isWord ? (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
            key={index}
            data-slot="subtitle-word"
            data-index={index}
            className={cn(
              "cursor-pointer rounded-sm transition-colors",
              // The hover tint would wash out the highlight under the cursor that just clicked.
              index === lookedUpIndex ? "bg-amber-300 text-amber-950" : "hover:bg-white/25",
            )}
            // The subtitles' host already keeps clicks from the player.
            onClick={() => {
              // A click that ends a text selection belongs to the selection toolbar.
              if (!window.getSelection()?.toString()) {
                lookUp(index)
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
