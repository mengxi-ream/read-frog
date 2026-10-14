import type { PointerEvent, RefObject } from "react"
import type { WordToken } from "@/utils/subtitles/segment-words"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { displaySubtitleAtom } from "../atoms"
import { dragRangeAtom, openWordLookupAtom } from "./atoms"

const WORD_SELECTOR = '[data-slot="subtitle-word"]'

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

function getLookupAnchor(wordRects: DOMRect[]) {
  const lastRect = wordRects.at(-1)
  return lastRect ? { x: lastRect.right, y: lastRect.bottom } : null
}

function joinWordText(tokens: WordToken[], start: number, end: number) {
  return tokens
    .slice(start, end + 1)
    .map((token) => token.text)
    .join("")
    .trim()
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
      const anchor = getLookupAnchor(getWordRects(line, start, end))
      if (!anchor) {
        setDragRange(null)
        return
      }

      openLookup({
        start,
        end,
        text: joinWordText(tokens, start, end),
        anchor,
      })
    }

    const cancelDrag = ({ pointerId }: { pointerId: number }) => {
      if (dragRef.current?.pointerId === pointerId) {
        clearDrag()
      }
    }

    window.addEventListener("pointerup", finishDrag, true)
    window.addEventListener("pointercancel", cancelDrag, true)
    return () => {
      window.removeEventListener("pointerup", finishDrag, true)
      window.removeEventListener("pointercancel", cancelDrag, true)
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
