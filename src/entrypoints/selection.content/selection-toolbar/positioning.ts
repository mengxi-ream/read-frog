import type { SelectionRangeSnapshot } from "../utils"
import { toLiveRange } from "../utils"

export interface ViewportPoint {
  x: number
  y: number
}

export interface ViewportRect {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export interface SelectionAnchorTracker {
  ranges: SelectionRangeSnapshot[]
  reference: {
    rangeIndex: number
    rectIndex: number
    offsetX: number
    offsetY: number
  }
  lastAnchor: ViewportPoint
}

export type SelectionAnchorMeasurement =
  | {
      status: "visible"
      anchor: ViewportPoint
      tracker: SelectionAnchorTracker
    }
  | { status: "offscreen" }
  | { status: "invalid" }

export enum SelectionDirection {
  TOP_LEFT = "TOP_LEFT",
  TOP_RIGHT = "TOP_RIGHT",
  BOTTOM_LEFT = "BOTTOM_LEFT",
  BOTTOM_RIGHT = "BOTTOM_RIGHT",
}

interface IndexedClientRect {
  rangeIndex: number
  rectIndex: number
  rect: DOMRect
}

interface ViewportHost {
  offsetWidth: number
  offsetHeight: number
  getBoundingClientRect: () => DOMRect
}

const DOWNWARD_TOLERANCE = 8
const CURSOR_CLEARANCE = 20

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hasArea(rect: DOMRect) {
  return rect.width > 0 || rect.height > 0
}

function getPointToRectDistanceSquared(point: ViewportPoint, rect: DOMRect) {
  const deltaX = point.x < rect.left ? rect.left - point.x : Math.max(point.x - rect.right, 0)
  const deltaY = point.y < rect.top ? rect.top - point.y : Math.max(point.y - rect.bottom, 0)

  return deltaX * deltaX + deltaY * deltaY
}

function getNearestRect(rects: IndexedClientRect[], point: ViewportPoint) {
  let nearestRect: IndexedClientRect | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const rect of rects) {
    const distance = getPointToRectDistanceSquared(point, rect.rect)
    if (distance < nearestDistance) {
      nearestRect = rect
      nearestDistance = distance
    }
  }

  return nearestRect
}

function readIndexedClientRects(ranges: SelectionRangeSnapshot[]) {
  const rects: IndexedClientRect[] = []

  for (const [rangeIndex, rangeSnapshot] of ranges.entries()) {
    if (!rangeSnapshot.startContainer.isConnected || !rangeSnapshot.endContainer.isConnected) {
      return null
    }

    let range: Range

    try {
      range = toLiveRange(rangeSnapshot)
    } catch {
      return null
    }

    let clientRects: DOMRect[]

    try {
      clientRects = Array.from(range.getClientRects()).filter(hasArea)
      if (clientRects.length === 0) {
        const boundingRect = range.getBoundingClientRect()
        if (hasArea(boundingRect)) {
          clientRects.push(boundingRect)
        }
      }
    } catch {
      return null
    }

    for (const [rectIndex, rect] of clientRects.entries()) {
      rects.push({ rangeIndex, rectIndex, rect })
    }
  }

  return rects
}

function isRectVisible(rect: DOMRect, viewport: ViewportRect) {
  return (
    rect.right > viewport.left &&
    rect.left < viewport.right &&
    rect.bottom > viewport.top &&
    rect.top < viewport.bottom
  )
}

export function getViewportRect(): ViewportRect {
  const visualViewport = window.visualViewport
  const left = visualViewport?.offsetLeft ?? 0
  const top = visualViewport?.offsetTop ?? 0
  const width = visualViewport?.width ?? window.innerWidth
  const height = visualViewport?.height ?? window.innerHeight

  return {
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
  }
}

export function getSelectionDirection(startX: number, startY: number, endX: number, endY: number) {
  const isRightward = startX <= endX
  const isDownward = startY - DOWNWARD_TOLERANCE <= endY

  if (isRightward && isDownward) return SelectionDirection.BOTTOM_RIGHT
  if (isRightward && !isDownward) return SelectionDirection.TOP_RIGHT
  if (!isRightward && isDownward) return SelectionDirection.BOTTOM_LEFT
  return SelectionDirection.TOP_LEFT
}

export function getToolbarViewportPosition(
  direction: SelectionDirection,
  anchor: ViewportPoint,
  toolbarSize: { width: number; height: number },
  viewport: ViewportRect,
  margin: number,
) {
  let left = anchor.x
  let top = anchor.y

  switch (direction) {
    case SelectionDirection.BOTTOM_RIGHT:
      top += CURSOR_CLEARANCE
      break
    case SelectionDirection.BOTTOM_LEFT:
      left -= toolbarSize.width
      top += CURSOR_CLEARANCE
      break
    case SelectionDirection.TOP_RIGHT:
      top -= toolbarSize.height + CURSOR_CLEARANCE
      break
    case SelectionDirection.TOP_LEFT:
      left -= toolbarSize.width
      top -= toolbarSize.height + CURSOR_CLEARANCE
      break
    default:
      break
  }

  const minLeft = viewport.left + margin
  const maxLeft = Math.max(minLeft, viewport.right - toolbarSize.width - margin)
  const minTop = viewport.top + margin
  const maxTop = Math.max(minTop, viewport.bottom - toolbarSize.height - margin)

  return {
    x: clamp(left, minLeft, maxLeft),
    y: clamp(top, minTop, maxTop),
  }
}

export function viewportPointToHostPoint(point: ViewportPoint, host: ViewportHost) {
  const hostRect = host.getBoundingClientRect()
  const scaleX = host.offsetWidth > 0 && hostRect.width > 0 ? hostRect.width / host.offsetWidth : 1
  const scaleY =
    host.offsetHeight > 0 && hostRect.height > 0 ? hostRect.height / host.offsetHeight : 1

  return {
    x: (point.x - hostRect.left) / scaleX,
    y: (point.y - hostRect.top) / scaleY,
  }
}

export function createSelectionAnchorTracker(
  ranges: SelectionRangeSnapshot[],
  anchor: ViewportPoint,
): SelectionAnchorTracker | null {
  const rects = readIndexedClientRects(ranges)
  if (!rects || rects.length === 0) {
    return null
  }

  const referenceRect = getNearestRect(rects, anchor)
  if (!referenceRect) {
    return null
  }

  return {
    ranges,
    reference: {
      rangeIndex: referenceRect.rangeIndex,
      rectIndex: referenceRect.rectIndex,
      offsetX: anchor.x - referenceRect.rect.left,
      offsetY: anchor.y - referenceRect.rect.top,
    },
    lastAnchor: anchor,
  }
}

export function measureSelectionAnchor(
  tracker: SelectionAnchorTracker,
  viewport: ViewportRect,
): SelectionAnchorMeasurement {
  const rects = readIndexedClientRects(tracker.ranges)
  if (!rects) {
    return { status: "invalid" }
  }

  const visibleRects = rects.filter(({ rect }) => isRectVisible(rect, viewport))
  if (visibleRects.length === 0) {
    return { status: "offscreen" }
  }

  const referenceRect = visibleRects.find(
    ({ rangeIndex, rectIndex }) =>
      rangeIndex === tracker.reference.rangeIndex && rectIndex === tracker.reference.rectIndex,
  )

  if (referenceRect) {
    const anchor = {
      x: referenceRect.rect.left + tracker.reference.offsetX,
      y: referenceRect.rect.top + tracker.reference.offsetY,
    }

    return {
      status: "visible",
      anchor,
      tracker: {
        ...tracker,
        lastAnchor: anchor,
      },
    }
  }

  const fallbackRect = getNearestRect(visibleRects, tracker.lastAnchor)
  if (!fallbackRect) {
    return { status: "offscreen" }
  }

  const anchor = {
    x: clamp(tracker.lastAnchor.x, fallbackRect.rect.left, fallbackRect.rect.right),
    y: clamp(tracker.lastAnchor.y, fallbackRect.rect.top, fallbackRect.rect.bottom),
  }

  return {
    status: "visible",
    anchor,
    tracker: {
      ranges: tracker.ranges,
      reference: {
        rangeIndex: fallbackRect.rangeIndex,
        rectIndex: fallbackRect.rectIndex,
        offsetX: anchor.x - fallbackRect.rect.left,
        offsetY: anchor.y - fallbackRect.rect.top,
      },
      lastAnchor: anchor,
    },
  }
}

export function collectSelectionShadowRoots(ranges: SelectionRangeSnapshot[]) {
  return collectSelectionScrollTargets(ranges).filter(isShadowRoot)
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1
}

function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && "host" in node
}

export function collectSelectionScrollTargets(ranges: SelectionRangeSnapshot[]) {
  const scrollTargets = new Set<Element | ShadowRoot>()

  for (const range of ranges) {
    for (const boundaryNode of [range.startContainer, range.endContainer]) {
      let current: Node | null = boundaryNode

      while (current) {
        if (isElement(current)) {
          scrollTargets.add(current)
        }

        if (isShadowRoot(current)) {
          scrollTargets.add(current)
          current = current.host
          continue
        }

        const root = current.getRootNode()
        if (current.parentElement) {
          current = current.parentElement
        } else if (isShadowRoot(root)) {
          current = root
        } else {
          current = null
        }
      }
    }
  }

  return [...scrollTargets]
}
