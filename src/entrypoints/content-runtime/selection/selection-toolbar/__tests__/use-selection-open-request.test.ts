// @vitest-environment jsdom
import type { SelectionSession } from "../atoms"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createSelectionSession } from "../atoms"
import { useSelectionOpenRequestResolver } from "../use-selection-open-request"

const EBOOK_ID = "5d0f1c8e-2b8a-4c1e-9f3a-6a7b8c9d0e1f"
const VIEWPORT_CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

// As the toolbar records a selection the ebook reader relays: no ranges here.
function createRelayedSession(text: string): SelectionSession {
  return createSelectionSession(
    { text, ranges: [], anchor: { x: 240, y: 138 } },
    { text: `My mom ${text} me.`, paragraphs: [`My mom ${text} me.`] },
    { kind: "ebook", ebookId: EBOOK_ID, cfi: "epubcfi(/6/4!/4/2/1:10)" },
  )!
}

function resolveFromEbookSection(session: SelectionSession | null, selectionText: string) {
  const { result } = renderHook(() => useSelectionOpenRequestResolver(session))
  return result.current.resolveContextMenuOpenRequest({ selectionText, fromEbookSection: true })
}

describe("resolveContextMenuOpenRequest for a menu opened in an ebook section", () => {
  it("uses the relayed selection when the menu was opened on it", () => {
    const relayed = createRelayedSession("punched\nhard")

    // The menu's text can differ from the reader's in whitespace and zero-width characters.
    const request = resolveFromEbookSection(relayed, "punched​ hard")

    expect(request).toEqual({ anchor: { x: 240, y: 138 }, session: relayed })
  })

  it("acts on the menu's text when the reader last relayed another selection", () => {
    const relayed = createRelayedSession("punched")

    // Extended with the keyboard, or selected by the right-click: no mouseup relayed it.
    const request = resolveFromEbookSection(relayed, "punched me")

    expect(request?.anchor).toEqual(VIEWPORT_CENTER)
    expect(request?.session).not.toBe(relayed)
    expect(request?.session.selectionSnapshot).toEqual({ text: "punched me", ranges: [] })
    expect(request?.session.contextSnapshot).toEqual({
      text: "punched me",
      paragraphs: ["punched me"],
    })
    // Still the same book, but not the other selection's place in it.
    expect(request?.session.noteOrigin).toEqual({ kind: "ebook", ebookId: EBOOK_ID })
  })

  it("acts on the menu's text when the reader relayed nothing", () => {
    const request = resolveFromEbookSection(null, "punched")

    expect(request?.anchor).toEqual(VIEWPORT_CENTER)
    expect(request?.session.selectionSnapshot.text).toBe("punched")
    expect(request?.session.noteOrigin).toBeNull()
  })

  it("does not use a selection made in this frame", () => {
    const own = createSelectionSession(
      { text: "Reader page header", ranges: [] },
      { text: "Reader page header", paragraphs: ["Reader page header"] },
      null,
    )

    const request = resolveFromEbookSection(own, "punched")

    expect(request?.session).not.toBe(own)
    expect(request?.session.selectionSnapshot.text).toBe("punched")
    expect(request?.anchor).toEqual(VIEWPORT_CENTER)
  })
})
