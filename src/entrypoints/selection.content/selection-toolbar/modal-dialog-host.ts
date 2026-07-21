import type { SelectionRangeSnapshot } from "../utils"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"

export const MODAL_DIALOG_HOST_SLOT_ATTRIBUTE = "data-read-frog-modal-dialog-host-slot"

const MAX_OVERLAY_Z_INDEX = "2147483647"
const CALIBRATION_TOLERANCE = 1
const CALIBRATION_PASSES = 2

const MODAL_HOST_SLOT_STYLES = [
  ["display", "block"],
  ["position", "absolute"],
  ["top", "0px"],
  ["right", "auto"],
  ["bottom", "auto"],
  ["left", "0px"],
  ["box-sizing", "border-box"],
  ["width", "0px"],
  ["min-width", "0px"],
  ["max-width", "0px"],
  ["height", "0px"],
  ["min-height", "0px"],
  ["max-height", "0px"],
  ["margin", "0px"],
  ["padding", "0px"],
  ["border", "0px"],
  ["overflow", "visible"],
  ["pointer-events", "none"],
  ["z-index", MAX_OVERLAY_Z_INDEX],
] as const

export interface ModalDialogHostSlotCalibration {
  aligned: boolean
  errorX: number
  errorY: number
}

export interface ModalDialogHostController {
  placeForRanges: (ranges: SelectionRangeSnapshot[]) => boolean
  restore: () => void
  dispose: () => void
}

function getParentNodeAcrossShadow(node: Node) {
  if (node.parentNode) {
    return node.parentNode
  }

  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

function isActiveModalDialog(node: Node): node is HTMLDialogElement {
  if (!(node instanceof HTMLDialogElement) || !node.open || !node.isConnected) {
    return false
  }

  try {
    return node.matches(":modal")
  } catch {
    return false
  }
}

function findNearestModalDialog(node: Node) {
  let current: Node | null = node

  while (current) {
    if (isActiveModalDialog(current)) {
      return current
    }

    current = getParentNodeAcrossShadow(current)
  }

  return null
}

function collectMutationObserverTargets(dialog: HTMLDialogElement) {
  const targets = new Set<Node>([dialog.ownerDocument.documentElement])
  let current: Node = dialog

  // Document observers do not see mutations inside shadow trees. Observe every
  // shadow boundary so removing either the dialog or one of its hosts is caught.
  while (true) {
    const root = current.getRootNode()
    if (!(root instanceof ShadowRoot)) {
      break
    }

    targets.add(root)
    current = root.host
  }

  return targets
}

export function findSelectionModalDialog(ranges: SelectionRangeSnapshot[]) {
  const boundaryNodes = new Set<Node>()

  for (const range of ranges) {
    boundaryNodes.add(range.startContainer)
    boundaryNodes.add(range.endContainer)
  }

  if (boundaryNodes.size === 0) {
    return null
  }

  let resolvedDialog: HTMLDialogElement | null = null

  for (const boundaryNode of boundaryNodes) {
    const dialog = findNearestModalDialog(boundaryNode)
    if (!dialog || (resolvedDialog && resolvedDialog !== dialog)) {
      return null
    }

    resolvedDialog = dialog
  }

  return resolvedDialog
}

export function createModalDialogHostSlot(document: Document) {
  const slot = document.createElement("read-frog-modal-dialog-host-slot")
  slot.classList.add(NOTRANSLATE_CLASS)
  slot.setAttribute(MODAL_DIALOG_HOST_SLOT_ATTRIBUTE, "")

  for (const [property, value] of MODAL_HOST_SLOT_STYLES) {
    slot.style.setProperty(property, value, "important")
  }

  return slot
}

function readPixelStyle(element: HTMLElement, property: "left" | "top") {
  const value = Number.parseFloat(element.style.getPropertyValue(property))
  return Number.isFinite(value) ? value : 0
}

export function calibrateModalDialogHostSlot(slot: HTMLElement): ModalDialogHostSlotCalibration {
  const view = slot.ownerDocument.defaultView
  if (!view) {
    return { aligned: false, errorX: Number.POSITIVE_INFINITY, errorY: Number.POSITIVE_INFINITY }
  }

  // WXT's absolute Shadow <html> expects the document origin. Recreate that
  // origin after the host moves under an offset dialog containing block.
  const targetX = -view.scrollX
  const targetY = -view.scrollY

  for (let pass = 0; pass < CALIBRATION_PASSES; pass += 1) {
    const rect = slot.getBoundingClientRect()
    const errorX = targetX - rect.left
    const errorY = targetY - rect.top

    if (Math.abs(errorX) <= CALIBRATION_TOLERANCE && Math.abs(errorY) <= CALIBRATION_TOLERANCE) {
      return { aligned: true, errorX, errorY }
    }

    slot.style.setProperty("left", `${readPixelStyle(slot, "left") + errorX}px`, "important")
    slot.style.setProperty("top", `${readPixelStyle(slot, "top") + errorY}px`, "important")
  }

  const rect = slot.getBoundingClientRect()
  const errorX = targetX - rect.left
  const errorY = targetY - rect.top

  return {
    aligned: Math.abs(errorX) <= CALIBRATION_TOLERANCE && Math.abs(errorY) <= CALIBRATION_TOLERANCE,
    errorX,
    errorY,
  }
}

export function createModalDialogHostController(host: HTMLElement): ModalDialogHostController {
  const ownerDocument = host.ownerDocument
  const view = ownerDocument.defaultView
  const originalParent = host.parentNode
  const originalNextSibling = host.nextSibling
  let activeDialog: HTMLDialogElement | null = null
  let slot: HTMLElement | null = null
  let mutationObserver: MutationObserver | null = null
  let resizeObserver: ResizeObserver | null = null
  let animationFrameId: number | null = null
  let scheduledCalibrationRetry = false
  let disposed = false
  const handlePlacementChange = () => scheduleSync()

  const cancelScheduledSync = () => {
    if (animationFrameId === null || !view) {
      return
    }

    view.cancelAnimationFrame(animationFrameId)
    animationFrameId = null
    scheduledCalibrationRetry = false
  }

  const detachPlacementListeners = () => {
    cancelScheduledSync()
    mutationObserver?.disconnect()
    mutationObserver = null
    resizeObserver?.disconnect()
    resizeObserver = null

    if (!view || !activeDialog) {
      return
    }

    const visualViewport = view.visualViewport
    activeDialog.removeEventListener("close", restore)
    activeDialog.removeEventListener("scroll", handlePlacementChange, true)
    view.removeEventListener("scroll", handlePlacementChange)
    view.removeEventListener("resize", handlePlacementChange)
    visualViewport?.removeEventListener("scroll", handlePlacementChange)
    visualViewport?.removeEventListener("resize", handlePlacementChange)
  }

  const restoreHostToOriginalPosition = () => {
    // A site may remove the whole modal subtree (including our host), so do not
    // require the host itself to still be connected before restoring it.
    const parent = originalParent?.isConnected
      ? originalParent
      : (ownerDocument.body ?? ownerDocument.documentElement)

    if (!parent) {
      return
    }

    if (originalNextSibling?.parentNode === parent) {
      parent.insertBefore(host, originalNextSibling)
    } else {
      parent.appendChild(host)
    }
  }

  function restore() {
    if (!activeDialog && !slot) {
      return
    }

    const previousSlot = slot
    detachPlacementListeners()
    activeDialog = null
    slot = null
    restoreHostToOriginalPosition()
    previousSlot?.remove()
  }

  const syncPlacement = (retryIfNeeded: boolean) => {
    if (disposed || !activeDialog || !slot) {
      return
    }

    if (!isActiveModalDialog(activeDialog)) {
      restore()
      return
    }

    if (slot.parentNode !== activeDialog) {
      activeDialog.appendChild(slot)
    }

    if (host.parentNode !== slot) {
      slot.appendChild(host)
    }

    const calibration = calibrateModalDialogHostSlot(slot)
    if (!calibration.aligned && retryIfNeeded) {
      scheduleSync(false)
    }
  }

  function scheduleSync(retryIfNeeded = true) {
    if (!view || disposed || !activeDialog) {
      return
    }

    scheduledCalibrationRetry ||= retryIfNeeded
    if (animationFrameId !== null) {
      return
    }

    animationFrameId = view.requestAnimationFrame(() => {
      animationFrameId = null
      const shouldRetry = scheduledCalibrationRetry
      scheduledCalibrationRetry = false
      syncPlacement(shouldRetry)
    })
  }

  const attachPlacementListeners = () => {
    if (!view || !activeDialog) {
      return
    }

    const visualViewport = view.visualViewport
    activeDialog.addEventListener("close", restore)
    activeDialog.addEventListener("scroll", handlePlacementChange, {
      capture: true,
      passive: true,
    })
    view.addEventListener("scroll", handlePlacementChange, { passive: true })
    view.addEventListener("resize", handlePlacementChange)
    visualViewport?.addEventListener("scroll", handlePlacementChange, { passive: true })
    visualViewport?.addEventListener("resize", handlePlacementChange)

    mutationObserver = new MutationObserver(handlePlacementChange)
    for (const target of collectMutationObserverTargets(activeDialog)) {
      mutationObserver.observe(target, {
        childList: true,
        subtree: true,
      })
    }
    mutationObserver.observe(activeDialog, {
      attributes: true,
      attributeFilter: ["class", "open", "style"],
    })

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handlePlacementChange)
      resizeObserver.observe(activeDialog)
    }
  }

  const placeForRanges = (ranges: SelectionRangeSnapshot[]) => {
    if (disposed) {
      return false
    }

    const dialog = findSelectionModalDialog(ranges)
    if (!dialog) {
      restore()
      return false
    }

    if (dialog === activeDialog && slot) {
      syncPlacement(true)
      return true
    }

    restore()
    activeDialog = dialog
    slot = createModalDialogHostSlot(ownerDocument)
    activeDialog.appendChild(slot)
    slot.appendChild(host)
    syncPlacement(true)
    attachPlacementListeners()
    return true
  }

  const dispose = () => {
    if (disposed) {
      return
    }

    restore()
    disposed = true
  }

  return { placeForRanges, restore, dispose }
}
