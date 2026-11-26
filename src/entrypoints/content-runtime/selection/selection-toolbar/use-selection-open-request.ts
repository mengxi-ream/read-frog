import type { SelectionRangeSnapshot } from "../utils"
import type { SelectionSession } from "./atoms"
import { useCallback, useEffect, useRef } from "react"
import { normalizeSelectedText, readRangeClientRects } from "../utils"
import { createSelectionSession } from "./atoms"

interface SelectionAnchor {
  x: number
  y: number
}

export interface SelectionOpenRequest {
  anchor: SelectionAnchor
  session: SelectionSession
}

/** The context menu an action came from, as the background describes it. */
export interface ContextMenuSelection {
  selectionText: string
  /** Opened in a book section of the ebook reader, not in this frame. */
  fromEbookSection?: boolean
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

// The menu's text and the reader's can differ in whitespace and in the
// zero-width characters the reader strips.
const EBOOK_ZERO_WIDTH_CHAR_REGEX = /[\u200B-\u200D\uFEFF]/g

function toComparableText(text: string) {
  return text.replace(EBOOK_ZERO_WIDTH_CHAR_REGEX, "").replace(/\s+/g, " ").trim()
}

/**
 * A menu opened in a book section of the ebook reader was right-clicked there,
 * not here, so neither a right-click this frame recorded nor a selection made
 * in this frame is the one it was opened on. The reader relays a selection
 * only on mouseup, so the one it relayed last can be stale too: one changed by
 * keys, or selected by the right-click itself, reaches the menu but not this
 * frame. The relayed selection is used when it is the menu's, for its
 * paragraphs and place in the book; otherwise the menu's own text is.
 */
function resolveEbookSectionOpenRequest(
  session: SelectionSession | null,
  menuText: string,
): SelectionOpenRequest | null {
  const relayed = session?.selectionSnapshot.anchor ? session : null
  if (relayed && toComparableText(relayed.selectionSnapshot.text) === toComparableText(menuText)) {
    return { anchor: getSelectionAnchor(relayed) ?? getViewportCenterAnchor(), session: relayed }
  }

  const text = normalizeSelectedText(menuText)
  if (!text) {
    return null
  }

  // Same book, but the relayed place in it is another selection's.
  const bookOrigin =
    relayed?.noteOrigin?.kind === "ebook"
      ? { kind: "ebook" as const, ebookId: relayed.noteOrigin.ebookId }
      : null
  const menuSession = createSelectionSession(
    { text, ranges: [] },
    { text, paragraphs: [text] },
    bookOrigin,
  )
  return menuSession ? { anchor: getViewportCenterAnchor(), session: menuSession } : null
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
  const resolveContextMenuOpenRequest = useCallback(
    (menu?: ContextMenuSelection): SelectionOpenRequest | null => {
      if (menu?.fromEbookSection) {
        return resolveEbookSectionOpenRequest(selectionSession, menu.selectionText)
      }

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
    },
    [selectionSession],
  )

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
