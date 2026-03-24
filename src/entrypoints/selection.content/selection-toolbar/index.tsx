import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/entrypoints/selection.content/overlay-layers"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { MARGIN } from "@/utils/constants/selection"
import { cn } from "@/utils/styles/utils"
import { matchDomainPattern } from "@/utils/url"
import { buildContextSnapshot, readSelectionSnapshot } from "../utils"
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

const SELECTION_GUARD_INTERACTIVE_SELECTOR = [
  "button",
  "[role=\"button\"]",
  "a[href]",
  "input",
  "textarea",
  "select",
  "summary",
].join(", ")

const SELECTION_OVERLAY_ROOT_SELECTOR = `[${SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE}]`

function getInteractiveGuardTarget(event: MouseEvent) {
  const eventPath = event.composedPath()

  for (const node of eventPath) {
    if (!(node instanceof Element)) {
      continue
    }

    if (node.matches(SELECTION_GUARD_INTERACTIVE_SELECTOR)) {
      return node
    }

    const closestInteractive = node.closest(SELECTION_GUARD_INTERACTIVE_SELECTOR)
    if (closestInteractive) {
      return closestInteractive
    }
  }

  if (!(event.target instanceof Element)) {
    return null
  }

  if (event.target.matches(SELECTION_GUARD_INTERACTIVE_SELECTOR)) {
    return event.target
  }

  return event.target.closest(SELECTION_GUARD_INTERACTIVE_SELECTOR)
}

function getSelectionOverlayShadowRoot(overlayContainer: HTMLElement | null) {
  const root = overlayContainer?.getRootNode()
  return root instanceof ShadowRoot ? root : null
}

function getNearestSelectionOverlayElement(node: Node | null) {
  let current: Node | null = node

  while (current) {
    if (current instanceof Element) {
      return current
    }

    const root = current.getRootNode()
    current = current.parentNode ?? (root instanceof ShadowRoot ? root.host : null)
  }

  return null
}

function isNodeInsideSelectionOverlay(
  node: Node | null,
  overlayContainer: HTMLElement | null,
  overlayShadowRoot: ShadowRoot | null,
) {
  if (!node) {
    return false
  }

  if (overlayContainer?.contains(node)) {
    return true
  }

  const overlayElement = getNearestSelectionOverlayElement(node)
  if (overlayElement?.closest(SELECTION_OVERLAY_ROOT_SELECTOR)) {
    return true
  }

  if (!overlayShadowRoot) {
    return false
  }

  return node === overlayShadowRoot || node.getRootNode() === overlayShadowRoot
}

function collectSelectionBoundaryNodes(selection: Selection) {
  const boundaryNodes = new Set<Node>()

  if (selection.anchorNode) {
    boundaryNodes.add(selection.anchorNode)
  }

  if (selection.focusNode) {
    boundaryNodes.add(selection.focusNode)
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      const range = selection.getRangeAt(index)
      boundaryNodes.add(range.startContainer)
      boundaryNodes.add(range.endContainer)
    }
    catch {
      break
    }
  }

  return [...boundaryNodes]
}

function isSelectionInsideSelectionOverlay(
  selection: Selection | null,
  overlayContainer: HTMLElement | null,
  overlayShadowRoot: ShadowRoot | null,
) {
  if (!selection) {
    return false
  }

  return collectSelectionBoundaryNodes(selection).some(node =>
    isNodeInsideSelectionOverlay(node, overlayContainer, overlayShadowRoot),
  )
}

function isMouseEventInsideSelectionOverlay(
  event: MouseEvent,
  overlayContainer: HTMLElement | null,
  overlayShadowRoot: ShadowRoot | null,
) {
  const eventPath = event.composedPath()

  for (const node of eventPath) {
    if (node instanceof Node && isNodeInsideSelectionOverlay(node, overlayContainer, overlayShadowRoot)) {
      return true
    }
  }

  return isNodeInsideSelectionOverlay(
    event.target instanceof Node ? event.target : null,
    overlayContainer,
    overlayShadowRoot,
  )
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
  const isPointerDownInsideOverlayRef = useRef(false)
  const preserveSelectionStateRef = useRef(false)
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
      if (isPointerDownInsideOverlayRef.current) {
        isPointerDownInsideOverlayRef.current = false
        preserveSelectionStateRef.current = true
        return
      }

      const interactiveTarget = getInteractiveGuardTarget(e)

      // Use requestAnimationFrame to delay selection check
      // This ensures selectionchange event fires first if text selection was cleared
      requestAnimationFrame(() => {
        const isInputOrTextarea = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement

        if (isInputOrTextarea && e.target !== document.activeElement) {
          return
        }

        // check if there is text selected
        const selection = window.getSelection()
        const overlayShadowRoot = getSelectionOverlayShadowRoot(tooltipContainerRef.current)

        if (isSelectionInsideSelectionOverlay(selection, tooltipContainerRef.current, overlayShadowRoot)) {
          preserveSelectionStateRef.current = true
          return
        }

        const selectionSnapshot = readSelectionSnapshot(selection)

        // https://github.com/mengxi-ream/read-frog/issues/547
        // https://github.com/mengxi-ream/read-frog/pull/790
        if (!isInputOrTextarea && interactiveTarget && !selection?.containsNode(interactiveTarget, true)) {
          return
        }

        if (selectionSnapshot) {
          preserveSelectionStateRef.current = false
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
      if (e.button === 2) {
        return
      }

      const overlayShadowRoot = getSelectionOverlayShadowRoot(tooltipContainerRef.current)
      isPointerDownInsideOverlayRef.current = isMouseEventInsideSelectionOverlay(
        e,
        tooltipContainerRef.current,
        overlayShadowRoot,
      )

      if (isPointerDownInsideOverlayRef.current) {
        preserveSelectionStateRef.current = true
        return
      }

      preserveSelectionStateRef.current = false

      // Record selection start position
      selectionStartRef.current = { x: e.clientX, y: e.clientY }

      clearSelectionState()
      setIsSelectionToolbarVisible(false)
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const overlayShadowRoot = getSelectionOverlayShadowRoot(tooltipContainerRef.current)

      if (isSelectionInsideSelectionOverlay(selection, tooltipContainerRef.current, overlayShadowRoot)) {
        preserveSelectionStateRef.current = true
        return
      }

      // if the selected content is cleared, hide the tooltip
      if (!selection || selection.toString().trim().length === 0) {
        if (preserveSelectionStateRef.current) {
          return
        }

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
      || selectionToolbar.customActions.some(a => a.enabled !== false)

  return (
    <div
      ref={tooltipContainerRef}
      className={NOTRANSLATE_CLASS}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
    >
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
            <SelectionToolbarCustomActionButtons />
          </div>
          <CloseButton />
        </div>
      )}
    </div>
  )
}
