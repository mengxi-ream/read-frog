import type { PointerEvent, RefObject } from "react"
import type { WordToken } from "@/utils/subtitles/segment-words"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { displaySubtitleAtom } from "../atoms"
import {
  clearWordSelectionAtom,
  openWordLookupAtom,
  selectWordsAtom,
  wordSelectionAtom,
} from "./atoms"

const CARD_GAP_ABOVE_SUBTITLES_PX = 8

const WORD_SELECTOR = '[data-slot="subtitle-word"]'

interface WordDrag {
  anchorIndex: number
  focusIndex: number
}

function unionRect(rects: DOMRect[]) {
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { top, left, width: right - left, height: bottom - top }
}

export function useWordDrag(tokens: WordToken[], lineRef: RefObject<HTMLElement | null>) {
  const cueStart = useAtomValue(displaySubtitleAtom)?.start ?? -1
  const openLookup = useSetAtom(openWordLookupAtom)
  const selectWords = useSetAtom(selectWordsAtom)
  const clearSelection = useSetAtom(clearWordSelectionAtom)
  const setSelection = useSetAtom(wordSelectionAtom)
  const dragRef = useRef<WordDrag | null>(null)

  useEffect(() => {
    const finishDrag = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current
      const line = lineRef.current
      if (!drag || !line) {
        return
      }
      dragRef.current = null

      const { anchorIndex, focusIndex } = drag
      const start = Math.min(anchorIndex, focusIndex)
      const end = Math.max(anchorIndex, focusIndex)
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
            x: firstRect.left + firstRect.width / 2,
            y: (boxTop ?? firstRect.top) - CARD_GAP_ABOVE_SUBTITLES_PX,
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
        direction: focusIndex >= anchorIndex ? "bottom-right" : "bottom-left",
      })
    }

    window.addEventListener("pointerup", finishDrag)
    return () => window.removeEventListener("pointerup", finishDrag)
  }, [lineRef, openLookup, selectWords, tokens])

  const startDrag = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { anchorIndex: index, focusIndex: index }
    clearSelection()
  }

  const extendDrag = (index: number) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    drag.focusIndex = index
    setSelection({
      cueStart,
      start: Math.min(drag.anchorIndex, index),
      end: Math.max(drag.anchorIndex, index),
    })
  }

  return { startDrag, extendDrag }
}
