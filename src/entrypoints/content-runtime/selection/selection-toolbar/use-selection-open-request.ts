import type { SelectionRangeSnapshot } from "../utils"
import type { SelectionSession } from "./atoms"
import { useCallback, useEffect, useRef } from "react"
import { readRangeClientRects } from "../utils"

interface SelectionAnchor {
  x: number
  y: number
}

export interface SelectionOpenRequest {
  anchor: SelectionAnchor
  session: SelectionSession
}

interface CachedSelectionOpenRequest extends SelectionOpenRequest {
  capturedAt: number
}

const RECENT_OPEN_REQUEST_TTL_MS = 10_000

function getSelectionAnchorFromRange(rangeSnapshot: SelectionRangeSnapshot) {
  try {
    const targetRect = readRangeClientRects(rangeSnapshot)
      .toReversed()
      .find((rect) => rect.width > 0 || rect.height > 0)

    if (!targetRect) {
      return null
    }

    return {
      x: Math.max(targetRect.left, targetRect.right),
      y: Math.max(targetRect.top, targetRect.bottom),
    }
  } catch {
    return null
  }
}

function getSelectionAnchor(session: SelectionSession | null) {
  if (!session) {
    return null
  }

  for (const rangeSnapshot of session.selectionSnapshot.ranges.toReversed()) {
    const anchor = getSelectionAnchorFromRange(rangeSnapshot)
    if (anchor) {
      return anchor
    }
  }

  return session.selectionSnapshot.anchor ?? null
}

function getViewportCenterAnchor(): SelectionAnchor {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
}

export function useSelectionOpenRequestResolver(selectionSession: SelectionSession | null) {
  const recentCapturedOpenRequestRef = useRef<CachedSelectionOpenRequest | null>(null)

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (!selectionSession) {
        recentCapturedOpenRequestRef.current = null
        return
      }

      recentCapturedOpenRequestRef.current = {
        anchor: { x: event.clientX, y: event.clientY },
        session: selectionSession,
        capturedAt: Date.now(),
      }
    }

    document.addEventListener("contextmenu", handleContextMenu)
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [selectionSession])

  // The context menu opens where it was right-clicked, on the selection it was opened for.
  const resolveContextMenuOpenRequest = useCallback((): SelectionOpenRequest | null => {
    const cachedRequest = recentCapturedOpenRequestRef.current
    if (cachedRequest && Date.now() - cachedRequest.capturedAt <= RECENT_OPEN_REQUEST_TTL_MS) {
      return {
        anchor: cachedRequest.anchor,
        session: cachedRequest.session,
      }
    }

    if (!selectionSession) {
      return null
    }

    return {
      anchor: getSelectionAnchor(selectionSession) ?? getViewportCenterAnchor(),
      session: selectionSession,
    }
  }, [selectionSession])

  // A shortcut acts on the selection it was pressed on (see useSelectionShortcuts), not the
  // one recorded at the last mouseup.
  const resolveShortcutOpenRequest = useCallback(
    (session: SelectionSession | null): SelectionOpenRequest | null =>
      session
        ? { anchor: getSelectionAnchor(session) ?? getViewportCenterAnchor(), session }
        : null,
    [],
  )

  return {
    resolveContextMenuOpenRequest,
    resolveShortcutOpenRequest,
  }
}
