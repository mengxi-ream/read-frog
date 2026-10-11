import type { MouseEvent } from "react"
import { useAtomValue } from "jotai"
import { useMemo, useRef } from "react"
import { configAtom } from "@/utils/atoms/config"
import { resolveWordLookupAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"
import { wordLookupAtom, wordSelectionAtom } from "./atoms"
import { useWordDrag } from "./use-word-drag"

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

export function SubtitleWordTokens() {
  const locale = useAtomValue(sourceLanguageAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selection = useAtomValue(wordSelectionAtom)
  const config = useAtomValue(configAtom)
  const text = cue?.text ?? ""
  const tokens = useMemo(() => segmentWords(text, locale ?? undefined), [locale, text])
  const lineRef = useRef<HTMLSpanElement>(null)
  const { startDrag, extendDrag } = useWordDrag(tokens, lineRef)
  const cueStart = cue?.start ?? -1

  if (resolveWordLookupAction(config).enabled === false) {
    return text
  }

  const highlightedIndex = lookup?.cueStart === cueStart ? lookup.tokenIndex : null
  const selected = selection?.cueStart === cueStart ? selection : null
  const isSelected = (index: number) =>
    selected ? index >= selected.start && index <= selected.end : false

  return (
    <span ref={lineRef} data-slot="subtitle-line">
      {tokens.map((token, index) =>
        token.isWord ? (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
            key={index}
            data-slot="subtitle-word"
            data-index={index}
            className={cn(
              "cursor-pointer rounded-sm transition-colors hover:bg-white/25",
              highlightedIndex === index && "bg-amber-300 text-amber-950",
              isSelected(index) && "bg-sky-300 text-sky-950",
            )}
            onPointerDown={(event) => startDrag(event, index)}
            onPointerEnter={() => extendDrag(index)}
            onClick={stopPlayerToggle}
            onDoubleClick={stopPlayerToggle}
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
