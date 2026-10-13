import type { MouseEvent } from "react"
import type { CueWordRange } from "./atoms"
import { useAtomValue } from "jotai"
import { useMemo, useRef } from "react"
import { configAtom } from "@/utils/atoms/config"
import { resolveClickLookupAction, resolveDragLookupAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"
import { dragRangeAtom, wordLookupAtom } from "./atoms"
import { useWordDrag } from "./use-word-drag"

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

export function SubtitleWordTokens() {
  const locale = useAtomValue(sourceLanguageAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const dragRange = useAtomValue(dragRangeAtom)
  const config = useAtomValue(configAtom)
  const text = cue?.text ?? ""
  const tokens = useMemo(() => segmentWords(text, locale ?? undefined), [locale, text])
  const lineRef = useRef<HTMLSpanElement>(null)
  const { startDrag, extendDrag } = useWordDrag(tokens, lineRef)
  const cueStart = cue?.start ?? -1

  const canLookUp = [resolveClickLookupAction, resolveDragLookupAction].some(
    (resolve) => resolve(config).enabled !== false,
  )

  if (!canLookUp) {
    return text
  }

  const isWithin = (range: CueWordRange | null, index: number) =>
    range?.cueStart === cueStart && index >= range.start && index <= range.end

  return (
    <span ref={lineRef} data-slot="subtitle-line" className="select-none">
      {tokens.map((token, index) =>
        token.isWord ? (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- tokens have no identity beyond their position in the line
            key={index}
            data-slot="subtitle-word"
            data-index={index}
            className={cn(
              "cursor-pointer touch-none rounded-sm transition-colors hover:bg-white/25",
              isWithin(lookup, index) && "bg-amber-300 text-amber-950",
              isWithin(dragRange, index) && "bg-sky-300 text-sky-950",
            )}
            onPointerDown={(event) => startDrag(event, index)}
            onPointerEnter={(event) => extendDrag(event, index)}
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
