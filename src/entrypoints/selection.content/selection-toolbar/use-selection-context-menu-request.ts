import type { SelectionRangeSnapshot } from "../utils"
import type { SelectionSession } from "./atoms"
import { useCallback, useEffect, useRef } from "react"
import { toLiveRange } from "../utils"

interface SelectionAnchor {
  x: number
  y: number
}

export interface SelectionContextMenuRequest {
  anchor: SelectionAnchor
  session: SelectionSession
}

interface CachedSelectionContextMenuSnapshot extends SelectionContextMenuRequest {
  capturedAt: number
}

const CONTEXT_MENU_SNAPSHOT_TTL_MS = 10_000

function getSelectionAnchorFromRange(rangeSnapshot: SelectionRangeSnapshot) {
  try {
    const range = toLiveRange(rangeSnapshot)
    const clientRects = [...range.getClientRects()]
    const targetRect = clientRects.toReversed().find(rect => rect.width > 0 || rect.height > 0)
      ?? range.getBoundingClientRect()

    if (targetRect.width === 0 && targetRect.height === 0) {
      return null
    }

    return {
      x: Math.max(targetRect.left, targetRect.right),
      y: Math.max(targetRect.top, targetRect.bottom),
    }
  }
  catch {
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

  return null
}

function getViewportCenterAnchor(): SelectionAnchor {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
}

export function useSelectionContextMenuRequestResolver(selectionSession: SelectionSession | null) {
  const contextMenuSnapshotRef = useRef<CachedSelectionContextMenuSnapshot | null>(null)

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (!selectionSession) {
        contextMenuSnapshotRef.current = null
        return
      }

      contextMenuSnapshotRef.current = {
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

  const resolveContextMenuSelectionRequest = useCallback((): SelectionContextMenuRequest | null => {
    const cachedSnapshot = contextMenuSnapshotRef.current
    if (cachedSnapshot && Date.now() - cachedSnapshot.capturedAt <= CONTEXT_MENU_SNAPSHOT_TTL_MS) {
      return {
        anchor: cachedSnapshot.anchor,
        session: cachedSnapshot.session,
      }
    }

    if (!selectionSession) {
      return null
    }

    return {
      anchor: getSelectionAnchor(selectionSession)
        ?? getViewportCenterAnchor(),
      session: selectionSession,
    }
  }, [selectionSession])

  return {
    resolveContextMenuSelectionRequest,
  }
}
