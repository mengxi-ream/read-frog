import type { ModalDialogHostController } from "./modal-dialog-host"
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
import { createModalDialogHostController } from "./modal-dialog-host"
import {
  collectSelectionScrollTargets,
  createSelectionAnchorTracker,
  getSelectionDirection,
  getToolbarViewportPosition,
  getViewportRect,
  measureSelectionAnchor,
  SelectionDirection,
  viewportPointToHostPoint,
} from "./positioning"
import { SpeakButton } from "./speak-button"
import { TranslateButton } from "./translate-button"

const SELECTION_GUARD_INTERACTIVE_SELECTOR = [
  "button",
  '[role="button"]',
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
    } catch {
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

  return collectSelectionBoundaryNodes(selection).some((node) =>
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
    if (
      node instanceof Node &&
      isNodeInsideSelectionOverlay(node, overlayContainer, overlayShadowRoot)
    ) {
      return true
    }
  }

  return isNodeInsideSelectionOverlay(
    event.target instanceof Node ? event.target : null,
    overlayContainer,
    overlayShadowRoot,
  )
}

export function SelectionToolbar() {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const selectionPositionRef = useRef<{ x: number; y: number } | null>(null) // store selection position (base position without direction offset)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null) // store selection start position
  const selectionDirectionRef = useRef<SelectionDirection>(SelectionDirection.BOTTOM_RIGHT) // store selection direction
  const selectionAnchorTrackerRef = useRef<ReturnType<typeof createSelectionAnchorTracker>>(null)
  const selectionScrollTargetsRef = useRef<Array<Element | ShadowRoot>>([])
  const modalDialogHostControllerRef = useRef<ModalDialogHostController>(null)
  const isPointerDownInsideOverlayRef = useRef(false)
  const preserveSelectionStateRef = useRef(false)
  const [isSelectionToolbarVisible, setIsSelectionToolbarVisible] = useAtom(
    isSelectionToolbarVisibleAtom,
  )
  const setSelectionState = useSetAtom(setSelectionStateAtom)
  const clearSelectionState = useSetAtom(clearSelectionStateAtom)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const dropdownOpenRef = useRef(false)

  const placeHostForSelection = useCallback(
    (ranges: Parameters<ModalDialogHostController["placeForRanges"]>[0]) => {
      const root = tooltipContainerRef.current?.getRootNode()
      if (!(root instanceof ShadowRoot) || !(root.host instanceof HTMLElement)) {
        return
      }

      modalDialogHostControllerRef.current ??= createModalDialogHostController(root.host)
      modalDialogHostControllerRef.current.placeForRanges(ranges)
    },
    [],
  )

  useEffect(
    () => () => {
      modalDialogHostControllerRef.current?.dispose()
      modalDialogHostControllerRef.current = null
    },
    [],
  )

  const updatePosition = useCallback(
    ({ remeasureSelection = false }: { remeasureSelection?: boolean } = {}) => {
      const tooltip = tooltipRef.current
      const viewportHost = tooltipContainerRef.current
      const selectionPosition = selectionPositionRef.current

      if (!isSelectionToolbarVisible || !tooltip || !viewportHost || !selectionPosition) {
        return
      }

      const viewport = getViewportRect()
      const tracker = selectionAnchorTrackerRef.current

      if (remeasureSelection && tracker) {
        const measurement = measureSelectionAnchor(tracker, viewport)

        if (measurement.status === "invalid") {
          selectionAnchorTrackerRef.current = null
          selectionScrollTargetsRef.current = []
          selectionPositionRef.current = null
          clearSelectionState()
          setIsSelectionToolbarVisible(false)
          return
        }

        if (measurement.status === "offscreen") {
          selectionAnchorTrackerRef.current = null
          selectionScrollTargetsRef.current = []
          selectionPositionRef.current = null
          setIsSelectionToolbarVisible(false)
          return
        }

        selectionAnchorTrackerRef.current = measurement.tracker
        selectionPositionRef.current = measurement.anchor
      }

      const nextSelectionPosition = selectionPositionRef.current
      if (!nextSelectionPosition) {
        return
      }

      const tooltipRect = tooltip.getBoundingClientRect()
      const viewportPosition = getToolbarViewportPosition(
        selectionDirectionRef.current,
        nextSelectionPosition,
        {
          width: tooltipRect.width || tooltip.offsetWidth,
          height: tooltipRect.height || tooltip.offsetHeight,
        },
        viewport,
        MARGIN,
      )
      const hostPosition = viewportPointToHostPoint(viewportPosition, viewportHost)

      tooltip.style.top = `${hostPosition.y}px`
      tooltip.style.left = `${hostPosition.x}px`
    },
    [clearSelectionState, isSelectionToolbarVisible, setIsSelectionToolbarVisible],
  )

  useLayoutEffect(() => {
    updatePosition({ remeasureSelection: true })
  }, [updatePosition])

  useEffect(() => {
    if (!isSelectionToolbarVisible) {
      return undefined
    }

    let animationFrameId: number | null = null
    const schedulePositionUpdate = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null
        updatePosition({ remeasureSelection: true })
      })
    }

    const captureScrollOptions: AddEventListenerOptions = { capture: true, passive: true }
    const passiveOptions: AddEventListenerOptions = { passive: true }
    const selectionScrollTargets = selectionScrollTargetsRef.current
    const visualViewport = window.visualViewport
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePositionUpdate)

    document.addEventListener("scroll", schedulePositionUpdate, captureScrollOptions)
    window.addEventListener("scroll", schedulePositionUpdate, passiveOptions)
    window.addEventListener("resize", schedulePositionUpdate)
    visualViewport?.addEventListener("scroll", schedulePositionUpdate, passiveOptions)
    visualViewport?.addEventListener("resize", schedulePositionUpdate)
    selectionScrollTargets.forEach((target) =>
      target.addEventListener("scroll", schedulePositionUpdate, captureScrollOptions),
    )
    if (tooltipRef.current) {
      resizeObserver?.observe(tooltipRef.current)
    }

    return () => {
      document.removeEventListener("scroll", schedulePositionUpdate, true)
      window.removeEventListener("scroll", schedulePositionUpdate)
      window.removeEventListener("resize", schedulePositionUpdate)
      visualViewport?.removeEventListener("scroll", schedulePositionUpdate)
      visualViewport?.removeEventListener("resize", schedulePositionUpdate)
      selectionScrollTargets.forEach((target) =>
        target.removeEventListener("scroll", schedulePositionUpdate, true),
      )
      resizeObserver?.disconnect()
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isSelectionToolbarVisible, updatePosition])

  useEffect(() => {
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
        const isInputOrTextarea =
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement

        if (isInputOrTextarea && e.target !== document.activeElement) {
          return
        }

        // check if there is text selected
        const selection = window.getSelection()
        const overlayShadowRoot = getSelectionOverlayShadowRoot(tooltipContainerRef.current)

        if (
          isSelectionInsideSelectionOverlay(
            selection,
            tooltipContainerRef.current,
            overlayShadowRoot,
          )
        ) {
          preserveSelectionStateRef.current = true
          return
        }

        const selectionSnapshot = readSelectionSnapshot(selection)

        // https://github.com/mengxi-ream/read-frog/issues/547
        // https://github.com/mengxi-ream/read-frog/pull/790
        if (
          !isInputOrTextarea &&
          interactiveTarget &&
          !selection?.containsNode(interactiveTarget, true)
        ) {
          return
        }

        if (selectionSnapshot) {
          preserveSelectionStateRef.current = false
          // Enter a native modal's top layer before React measures or shows the toolbar.
          placeHostForSelection(selectionSnapshot.ranges)
          setSelectionState({
            selection: selectionSnapshot,
            context: buildContextSnapshot(selectionSnapshot),
          })
          if (selectionStartRef.current) {
            // Get selection start and end positions
            const startX = selectionStartRef.current.x
            const startY = selectionStartRef.current.y
            const endX = e.clientX
            const endY = e.clientY

            // Determine and store selection direction
            selectionDirectionRef.current = getSelectionDirection(startX, startY, endX, endY)
          } else {
            selectionDirectionRef.current = SelectionDirection.BOTTOM_RIGHT
          }

          const selectionPosition = { x: e.clientX, y: e.clientY }
          selectionPositionRef.current = selectionPosition
          selectionAnchorTrackerRef.current = createSelectionAnchorTracker(
            selectionSnapshot.ranges,
            selectionPosition,
          )
          selectionScrollTargetsRef.current = collectSelectionScrollTargets(
            selectionSnapshot.ranges,
          )
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
      selectionPositionRef.current = null
      selectionAnchorTrackerRef.current = null
      selectionScrollTargetsRef.current = []

      clearSelectionState()
      setIsSelectionToolbarVisible(false)
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const overlayShadowRoot = getSelectionOverlayShadowRoot(tooltipContainerRef.current)

      if (
        isSelectionInsideSelectionOverlay(selection, tooltipContainerRef.current, overlayShadowRoot)
      ) {
        preserveSelectionStateRef.current = true
        return
      }

      // if the selected content is cleared, hide the tooltip
      if (!selection || selection.toString().trim().length === 0) {
        if (preserveSelectionStateRef.current) {
          return
        }

        clearSelectionState()
        selectionPositionRef.current = null
        selectionAnchorTrackerRef.current = null
        selectionScrollTargetsRef.current = []
        // Don't hide toolbar when dropdown is open to prevent unwanted dismissal
        // (Firefox clears selection when dropdown gains focus)
        if (!dropdownOpenRef.current) setIsSelectionToolbarVisible(false)
      }
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("selectionchange", handleSelectionChange)

    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [clearSelectionState, placeHostForSelection, setIsSelectionToolbarVisible, setSelectionState])

  useEffect(() => {
    const handler = (e: Event) => {
      dropdownOpenRef.current = Boolean((e as CustomEvent).detail?.open)
    }
    window.addEventListener(DropEvent, handler)
    return () => window.removeEventListener(DropEvent, handler)
  }, [])

  // Check if current site is disabled
  const isSiteDisabled = selectionToolbar.disabledSelectionToolbarPatterns?.some((pattern) =>
    matchDomainPattern(window.location.href, pattern),
  )

  const { features } = selectionToolbar
  const hasAnyEnabledFeature =
    features.translate.enabled ||
    features.speak.enabled ||
    selectionToolbar.customActions.some((a) => a.enabled !== false)

  return (
    <div
      ref={tooltipContainerRef}
      className={`${NOTRANSLATE_CLASS} pointer-events-none fixed inset-0 ${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay}`}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
    >
      {selectionToolbar.enabled && !isSiteDisabled && hasAnyEnabledFeature && (
        <div
          ref={tooltipRef}
          inert={!isSelectionToolbarVisible}
          className={cn(
            `group absolute ${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay} overflow-visible transition-opacity`,
            isSelectionToolbarVisible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <div
            data-slot="selection-toolbar-surface"
            className="flex items-center rounded-sm border border-border/50 bg-popover shadow-floating"
            style={{ opacity: "var(--rf-selection-opacity, 1)" }}
          >
            <div className="no-scrollbar flex max-w-105 items-center overflow-x-auto overflow-y-hidden rounded-sm">
              {features.translate.enabled && <TranslateButton />}
              {features.speak.enabled && <SpeakButton />}
              <SelectionToolbarCustomActionButtons />
            </div>
            <CloseButton />
          </div>
        </div>
      )}
    </div>
  )
}
