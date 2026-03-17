import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/entrypoints/selection.content/overlay-layers"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { MARGIN } from "@/utils/constants/selection"
import { cn } from "@/utils/styles/utils"
import { matchDomainPattern } from "@/utils/url"
import { buildContextSnapshot, readSelectionSnapshot } from "../utils"
import { AiButton } from "./ai-button"
import {
  clearSelectionStateAtom,
  isSelectionToolbarVisibleAtom,
  setSelectionStateAtom,
} from "./atoms"
import { CloseButton, DropEvent } from "./close-button"
import { SelectionToolbarCustomActionButtons } from "./custom-action-button"
import { SpeakButton } from "./speak-button"
import { TranslateButton } from "./translate-button"

enum SelectionDirection {
  TOP_LEFT = "TOP_LEFT",
  TOP_RIGHT = "TOP_RIGHT",
  BOTTOM_LEFT = "BOTTOM_LEFT",
  BOTTOM_RIGHT = "BOTTOM_RIGHT",
}

function getSelectionDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SelectionDirection {
  const DOWNWARD_TOLERANCE = 8

  const isRightward = startX <= endX
  const isDownward = startY - DOWNWARD_TOLERANCE <= endY

  if (isRightward && isDownward)
    return SelectionDirection.BOTTOM_RIGHT
  if (isRightward && !isDownward)
    return SelectionDirection.TOP_RIGHT
  if (!isRightward && isDownward)
    return SelectionDirection.BOTTOM_LEFT
  return SelectionDirection.TOP_LEFT
}

function applyDirectionOffset(
  direction: SelectionDirection,
  baseX: number,
  baseY: number,
  tooltipWidth: number,
  tooltipHeight: number,
): { x: number, y: number } {
  const MARGIN = 12
  switch (direction) {
    case SelectionDirection.BOTTOM_RIGHT:
      return { x: baseX - MARGIN, y: baseY + MARGIN }
    case SelectionDirection.BOTTOM_LEFT:
      return { x: baseX - tooltipWidth + MARGIN, y: baseY + MARGIN }
    case SelectionDirection.TOP_RIGHT:
      return { x: baseX - MARGIN, y: baseY - tooltipHeight - MARGIN }
    case SelectionDirection.TOP_LEFT:
      return { x: baseX - tooltipWidth + MARGIN, y: baseY - tooltipHeight - MARGIN }
    default:
      return { x: baseX - MARGIN, y: baseY + MARGIN }
  }
}

export function SelectionToolbar() {
  const isFirefox = import.meta.env.BROWSER === "firefox"
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const selectionPositionRef = useRef<{ x: number, y: number } | null>(null) // store selection position (base position without direction offset)
  const selectionStartRef = useRef<{ x: number, y: number } | null>(null) // store selection start position
  const selectionDirectionRef = useRef<SelectionDirection>(SelectionDirection.BOTTOM_RIGHT) // store selection direction
  const isDraggingFromTooltipRef = useRef(false) // track if dragging started from tooltip
  const [isSelectionToolbarVisible, setIsSelectionToolbarVisible] = useAtom(isSelectionToolbarVisibleAtom)
  const setSelectionState = useSetAtom(setSelectionStateAtom)
  const clearSelectionState = useSetAtom(clearSelectionStateAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const dropdownOpenRef = useRef(false)

  const updatePosition = useCallback(() => {
    if (!isSelectionToolbarVisible || !tooltipRef.current || !selectionPositionRef.current)
      return

    const scrollY = window.scrollY
    const viewportHeight = window.innerHeight
    const clientWidth = document.documentElement.clientWidth
    const tooltipWidth = tooltipRef.current.offsetWidth
    const tooltipHeight = tooltipRef.current.offsetHeight

    // Apply direction offset based on selection direction and tooltip dimensions
    const { x: offsetX, y: offsetY } = applyDirectionOffset(
      selectionDirectionRef.current,
      selectionPositionRef.current.x,
      selectionPositionRef.current.y,
      tooltipWidth,
      tooltipHeight,
    )

    // calculate strict boundaries
    const topBoundary = scrollY + MARGIN
    const bottomBoundary = scrollY + viewportHeight - tooltipHeight - MARGIN
    const leftBoundary = MARGIN
    const rightBoundary = clientWidth - tooltipWidth - MARGIN

    // calculate the position of the tooltip, but strictly limit it within the boundaries
    const clampedX = Math.max(leftBoundary, Math.min(rightBoundary, offsetX))
    const clampedY = Math.max(topBoundary, Math.min(bottomBoundary, offsetY))

    // directly operate the DOM, avoid React re-rendering
    tooltipRef.current.style.top = `${clampedY}px`
    tooltipRef.current.style.left = `${clampedX}px`
  }, [isSelectionToolbarVisible])

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
        const selectionSnapshot = readSelectionSnapshot(selection)

        // https://github.com/mengxi-ream/read-frog/issues/547
        // https://github.com/mengxi-ream/read-frog/pull/790
        if (!isInputOrTextarea && !selection?.containsNode(e.target as Node, true) && e.target instanceof HTMLButtonElement) {
          return
        }

        if (selectionSnapshot) {
          setSelectionState({
            selection: selectionSnapshot,
            context: buildContextSnapshot(selectionSnapshot),
          })
          // calculate the position relative to the document
          const scrollY = window.scrollY
          const scrollX = window.scrollX

          if (selectionStartRef.current) {
            // Get selection start and end positions
            const startX = selectionStartRef.current.x
            const startY = selectionStartRef.current.y
            const endX = e.clientX
            const endY = e.clientY

            // Determine and store selection direction
            selectionDirectionRef.current = getSelectionDirection(startX, startY, endX, endY)
          }
          else {
            selectionDirectionRef.current = SelectionDirection.BOTTOM_RIGHT
          }

          const docX = e.clientX + scrollX
          const docY = e.clientY + scrollY

          // Store pending position for useLayoutEffect to process
          selectionPositionRef.current = { x: docX, y: docY }
          setIsSelectionToolbarVisible(true)
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

      // Record selection start position
      selectionStartRef.current = { x: e.clientX, y: e.clientY }

      clearSelectionState()
      setIsSelectionToolbarVisible(false)
    }

    const handleSelectionChange = () => {
      // if the selected content is cleared, hide the tooltip
      const selection = window.getSelection()
      if (!selection || selection.toString().trim().length === 0) {
        clearSelectionState()
        // Don't hide toolbar when dropdown is open to prevent unwanted dismissal
        // (Firefox clears selection when dropdown gains focus)
        if (!dropdownOpenRef.current)
          setIsSelectionToolbarVisible(false)
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

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("selectionchange", handleSelectionChange)
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("selectionchange", handleSelectionChange)
      window.removeEventListener("scroll", handleScroll)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [clearSelectionState, isSelectionToolbarVisible, setIsSelectionToolbarVisible, setSelectionState, updatePosition])

  useEffect(() => {
    const handler = (e: Event) => {
      dropdownOpenRef.current = Boolean((e as CustomEvent).detail?.open)
    }
    window.addEventListener(DropEvent, handler)
    return () => window.removeEventListener(DropEvent, handler)
  }, [])

  // Check if current site is disabled
  const isSiteDisabled = selectionToolbar.disabledSelectionToolbarPatterns?.some(pattern =>
    matchDomainPattern(window.location.href, pattern),
  )

  const { features } = selectionToolbar
  const hasAnyEnabledFeature
    = features.translate.enabled
      || (!isFirefox && features.speak.enabled)
      || features.vocabularyInsight.enabled
      || selectionToolbar.customActions.some(a => a.enabled !== false)

  return (
    <div ref={tooltipContainerRef} className={NOTRANSLATE_CLASS}>
      {selectionToolbar.enabled && !isSiteDisabled && hasAnyEnabledFeature && (
        <div
          ref={tooltipRef}
          aria-hidden={!isSelectionToolbarVisible}
          className={cn(
            `group absolute ${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay} bg-popover rounded-sm shadow-floating border border-border/50 overflow-visible flex items-center transition-opacity`,
            isSelectionToolbarVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="flex items-center overflow-x-auto overflow-y-hidden rounded-sm max-w-105 no-scrollbar">
            {features.translate.enabled && <TranslateButton />}
            {!isFirefox && features.speak.enabled && <SpeakButton />}
            {features.vocabularyInsight.enabled && <AiButton />}
            <SelectionToolbarCustomActionButtons />
          </div>
          <CloseButton />
        </div>
      )}
    </div>
  )
}
