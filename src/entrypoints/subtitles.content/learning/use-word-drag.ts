import type { PointerEvent, RefObject } from "react"
import type { WordToken } from "@/utils/subtitles/segment-words"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { displaySubtitleAtom } from "../atoms"
import { dragRangeAtom, openWordLookupAtom } from "./atoms"

const CARD_GAP_ABOVE_SUBTITLES_PX = 8

const WORD_SELECTOR = '[data-slot="subtitle-word"]'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface WordDrag {
  pointerId: number
  cueStart: number
  anchorIndex: number
  focusIndex: number
}

function getWordRects(line: HTMLElement, start: number, end: number) {
  return [...line.querySelectorAll<HTMLElement>(WORD_SELECTOR)]
    .filter((el) => {
      const index = Number(el.dataset.index)
      return index >= start && index <= end
    })
    .map((el) => el.getBoundingClientRect())
}

function getLookupAnchor(line: HTMLElement, wordsRect: Rect) {
  const boxTop = line.closest(`.${SUBTITLES_BOX_CLASS}`)?.getBoundingClientRect().top
  return {
    x: wordsRect.left + wordsRect.width / 2,
    y: (boxTop ?? wordsRect.top) - CARD_GAP_ABOVE_SUBTITLES_PX,
  }
}

function joinWordText(tokens: WordToken[], start: number, end: number) {
  return tokens
    .slice(start, end + 1)
    .map((token) => token.text)
    .join("")
    .trim()
}

function unionRect(rects: DOMRect[]): Rect {
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { top, left, width: right - left, height: bottom - top }
}

export function useWordDrag(
  tokens: WordToken[],
  lineRef: RefObject<HTMLElement | null>,
  dragEnabled: boolean,
) {
  const cueStart = useAtomValue(displaySubtitleAtom)?.start ?? -1
  const openLookup = useSetAtom(openWordLookupAtom)
  const setDragRange = useSetAtom(dragRangeAtom)
  const dragRef = useRef<WordDrag | null>(null)

  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null
      setDragRange(null)
    }

    const finishDrag = ({ pointerId }: { pointerId: number }) => {
      const drag = dragRef.current
      const line = lineRef.current
      if (!drag || drag.pointerId !== pointerId || !line) {
        return
      }
      if (drag.cueStart !== cueStart) {
        clearDrag()
        return
      }
      dragRef.current = null

      const start = Math.min(drag.anchorIndex, drag.focusIndex)
      const end = Math.max(drag.anchorIndex, drag.focusIndex)
      if (!dragEnabled && start !== end) {
        clearDrag()
        return
      }
      const wordRects = getWordRects(line, start, end)
      if (wordRects.length === 0) {
        setDragRange(null)
        return
      }

      openLookup({
        start,
        end,
        text: joinWordText(tokens, start, end),
        anchor: getLookupAnchor(line, unionRect(wordRects)),
      })
    }

    const cancelDrag = ({ pointerId }: { pointerId: number }) => {
      if (dragRef.current?.pointerId === pointerId) {
        clearDrag()
      }
    }

    window.addEventListener("pointerup", finishDrag)
    window.addEventListener("pointercancel", cancelDrag)
    return () => {
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", cancelDrag)
      if (dragRef.current) {
        clearDrag()
      }
    }
  }, [cueStart, dragEnabled, lineRef, openLookup, setDragRange, tokens])

  const startDrag = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0 || dragRef.current) {
      return
    }
    if (dragEnabled) {
      event.preventDefault()
    }
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = {
      pointerId: event.pointerId,
      cueStart,
      anchorIndex: index,
      focusIndex: index,
    }
    setDragRange(null)
  }

  const extendDrag = (event: PointerEvent<HTMLElement>, index: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    drag.focusIndex = index
    if (!dragEnabled) {
      return
    }
    setDragRange({
      cueStart,
      start: Math.min(drag.anchorIndex, index),
      end: Math.max(drag.anchorIndex, index),
    })
  }

  return { startDrag, extendDrag }
}
