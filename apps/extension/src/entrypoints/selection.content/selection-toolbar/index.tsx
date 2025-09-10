import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { configFields } from '@/utils/atoms/config'
import AiButton from './ai-button'
import { isTooltipVisibleAtom, selectionContentAtom } from './atom'
import { TranslateButton, TranslatePopover } from './translate-button'

const MARGIN = 25

export function SelectionToolbar() {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const selectionPositionRef = useRef<{ x: number, y: number } | null>(null) // store selection position
  const isDraggingFromTooltipRef = useRef(false) // track if dragging started from tooltip
  const [isTooltipVisible, setIsTooltipVisible] = useAtom(isTooltipVisibleAtom)
  const setSelectionContent = useSetAtom(selectionContentAtom)
  const selectionToolbar = useAtomValue(configFields.selectionToolbar)

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
    const clampedX = Math.max(Math.min(rightBoundary, selectionPositionRef.current.x), leftBoundary)
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
        // check if there is text selected
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() || ''

        if (selection && selectedText.length > 0) {
          setSelectionContent(selectedText)
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
  }, [isTooltipVisible, setSelectionContent, setIsTooltipVisible, updatePosition])

  return (
    <div ref={tooltipContainerRef}>
      {isTooltipVisible && selectionToolbar.enabled && (
        <div
          ref={tooltipRef}
          className="absolute z-[2147483647] bg-zinc-200 dark:bg-zinc-800 rounded-sm shadow-lg overflow-hidden flex items-center"
        >
          <TranslateButton />
          <AiButton />
        </div>
      )}
      <TranslatePopover />
    </div>
  )
}
