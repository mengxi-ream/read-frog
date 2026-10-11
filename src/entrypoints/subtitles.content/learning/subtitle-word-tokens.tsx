import type { MouseEvent, PointerEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo, useRef } from "react"
import { configAtom } from "@/utils/atoms/config"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { resolveWordLookupAction } from "@/utils/custom-actions"
import { cn } from "@/utils/styles/utils"
import { segmentWords } from "@/utils/subtitles/segment-words"
import { displaySubtitleAtom, sourceLanguageAtom } from "../atoms"
import {
  clearWordSelectionAtom,
  openWordLookupAtom,
  selectWordsAtom,
  wordLookupAtom,
  wordSelectionAtom,
} from "./atoms"

const CARD_CLEARANCE_ABOVE_SUBTITLES_PX = 300

const WORD_SELECTOR = '[data-slot="subtitle-word"]'

function stopPlayerToggle(event: MouseEvent) {
  event.stopPropagation()
}

function tokenIndexFromEvent(event: Event) {
  const target = event
    .composedPath()
    .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches(WORD_SELECTOR))
  return target ? Number(target.dataset.index) : null
}

function unionRect(rects: DOMRect[]) {
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { top, left, width: right - left, height: bottom - top }
}

export function SubtitleWordTokens() {
  const locale = useAtomValue(sourceLanguageAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const selection = useAtomValue(wordSelectionAtom)
  const config = useAtomValue(configAtom)
  const openLookup = useSetAtom(openWordLookupAtom)
  const selectWords = useSetAtom(selectWordsAtom)
  const clearSelection = useSetAtom(clearWordSelectionAtom)
  const setSelection = useSetAtom(wordSelectionAtom)
  const text = cue?.text ?? ""
  const tokens = useMemo(() => segmentWords(text, locale ?? undefined), [locale, text])
  const dragAnchorRef = useRef<number | null>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const cueStart = cue?.start ?? -1

  useEffect(() => {
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const anchor = dragAnchorRef.current
      const line = lineRef.current
      if (anchor === null || !line) {
        return
      }
      dragAnchorRef.current = null

      const released = tokenIndexFromEvent(event) ?? anchor
      const start = Math.min(anchor, released)
      const end = Math.max(anchor, released)
      const wordRects = [...line.querySelectorAll<HTMLElement>(WORD_SELECTOR)]
        .filter((el) => {
          const index = Number(el.dataset.index)
          return index >= start && index <= end
        })
        .map((el) => el.getBoundingClientRect())
      const firstRect = wordRects[0]
      if (!firstRect) {
        return
      }

      if (start === end) {
        const boxTop = line.closest(`.${SUBTITLES_BOX_CLASS}`)?.getBoundingClientRect().top
        openLookup({
          tokenIndex: start,
          term: tokens[start]?.text ?? "",
          anchor: {
            x: firstRect.left,
            y: (boxTop ?? firstRect.top) - CARD_CLEARANCE_ABOVE_SUBTITLES_PX,
          },
        })
        return
      }

      selectWords({
        start,
        end,
        text: tokens
          .slice(start, end + 1)
          .map((token) => token.text)
          .join("")
          .trim(),
        rect: unionRect(wordRects),
        anchor: { x: event.clientX, y: event.clientY },
        direction: released >= anchor ? "bottom-right" : "bottom-left",
      })
    }

    window.addEventListener("pointerup", handlePointerUp)
    return () => window.removeEventListener("pointerup", handlePointerUp)
  }, [openLookup, selectWords, tokens])

  if (resolveWordLookupAction(config).enabled === false) {
    return text
  }

  const highlightedIndex = lookup?.cueStart === cueStart ? lookup.tokenIndex : null
  const selected = selection?.cueStart === cueStart ? selection : null
  const isSelected = (index: number) =>
    selected ? index >= selected.start && index <= selected.end : false

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>, index: number) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    dragAnchorRef.current = index
    clearSelection()
  }

  const handlePointerEnter = (index: number) => {
    const anchor = dragAnchorRef.current
    if (anchor === null) {
      return
    }
    setSelection({ cueStart, start: Math.min(anchor, index), end: Math.max(anchor, index) })
  }

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
            onPointerDown={(event) => handlePointerDown(event, index)}
            onPointerEnter={() => handlePointerEnter(index)}
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
