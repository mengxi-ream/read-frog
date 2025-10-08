import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MARGIN } from '@/utils/constants/selection'
import { AiButton, AiPopover } from './ai-button'
import { isTooltipVisibleAtom, selectionContentAtom, selectionRangeAtom } from './atom'
import { TranslateButton, TranslatePopover } from './translate-button'

export function SelectionToolbar() {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const selectionPositionRef = useRef<{ x: number, y: number } | null>(null) // store selection position
  const isDraggingFromTooltipRef = useRef(false) // track if dragging started from tooltip
  const [isTooltipVisible, setIsTooltipVisible] = useAtom(isTooltipVisibleAtom)
  const setSelectionContent = useSetAtom(selectionContentAtom)
  const setSelectionRange = useSetAtom(selectionRangeAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)

  const updatePosition = useCallback(() => {
    if (!isTooltipVisible || !tooltipRef.current || !selectionPositionRef.current)
      return

    const scrollY = window.scrollY
    const viewportHeight = window.innerHeight
    const clientWidth = document.documentElement.clientWidth
    const tooltipWidth = tooltipRef.current.offsetWidth
    const tooltipHeight = tooltipRef.current.offsetHeight

    // calculate strict boundaries
    const topBoundary = scrollY + MARGIN
    const bottomBoundary = scrollY + viewportHeight - tooltipHeight - MARGIN
    const leftBoundary = MARGIN
    const rightBoundary = clientWidth - tooltipWidth - MARGIN

    // calculate the position of the tooltip, but strictly limit it within the boundaries
    const clampedX = Math.max(leftBoundary, Math.min(rightBoundary, selectionPositionRef.current.x))
    const clampedY = Math.max(topBoundary, Math.min(bottomBoundary, selectionPositionRef.current.y))

    // directly operate the DOM, avoid React re-rendering
    tooltipRef.current.style.top = `${clampedY}px`
    tooltipRef.current.style.left = `${clampedX}px`
  }, [isTooltipVisible])

  useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition])

  useEffect(() => {
    let animationFrameId: number

    const handleMouseUp = (e: MouseEvent) => {
      // If dragging started from tooltip, don't hide it
      if (isDraggingFromTooltipRef.current) {
        isDraggingFromTooltipRef.current = false // reset state
        return
      }

      // Use requestAnimationFrame to delay selection check
      // This ensures selectionchange event fires first if text selection was cleared
      requestAnimationFrame(() => {
        const isInputOrTextarea = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement

        if (isInputOrTextarea && e.target !== document.activeElement) {
          return
        }

        // check if there is text selected
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() || ''

        if (!isInputOrTextarea && !selection?.containsNode(e.target as Node, true)) {
          return
        }

        if (selection && selectedText.length > 0) {
          setSelectionContent(selectedText)
          setSelectionRange(selection.getRangeAt(0))
          // calculate the position relative to the document
          const scrollY = window.scrollY
          const scrollX = window.scrollX

          const docX = e.clientX + scrollX
          const docY = e.clientY + scrollY

          // Store pending position for useLayoutEffect to process
          selectionPositionRef.current = { x: docX, y: docY }
          setIsTooltipVisible(true)
        }
      })
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Check if dragging started from within the tooltip container
      if (tooltipContainerRef.current) {
        const eventPath = e.composedPath()
        isDraggingFromTooltipRef.current = eventPath.includes(tooltipContainerRef.current)
      }
      else {
        isDraggingFromTooltipRef.current = false
      }

      if (isDraggingFromTooltipRef.current) {
        return
      }

      setIsTooltipVisible(false)
    }

    const handleSelectionChange = () => {
      // if the selected content is cleared, hide the tooltip
      const selection = window.getSelection()
      if (!selection || selection.toString().trim().length === 0) {
        setIsTooltipVisible(false)
      }
    }

    const handleScroll = () => {
      // cancel the previous animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }

      // use requestAnimationFrame to ensure rendering synchronization
      animationFrameId = requestAnimationFrame(updatePosition)
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('scroll', handleScroll)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isTooltipVisible, setSelectionContent, setIsTooltipVisible, setSelectionRange, updatePosition])

  return (
    <div ref={tooltipContainerRef}>
      {isTooltipVisible && selectionToolbar.enabled && (
        <div
          ref={tooltipRef}
          className="absolute z-[2147483647] bg-zinc-200 dark:bg-zinc-800 rounded-sm shadow-lg overflow-hidden flex items-center"
        >
          <AiButton />
          <TranslateButton />
        </div>
      )}
      <AiPopover />
      <TranslatePopover />
    </div>
  )
}
