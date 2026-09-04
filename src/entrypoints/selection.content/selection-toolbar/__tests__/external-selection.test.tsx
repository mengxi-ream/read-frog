// @vitest-environment jsdom
import type { EbookBridgeSelectionPayload } from "@read-frog/definitions"
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { atom, getDefaultStore } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  EXTERNAL_SELECTION_CLEAR_EVENT,
  EXTERNAL_SELECTION_OPEN_EVENT,
} from "@/utils/constants/selection"
import { isSelectionToolbarOpenAtom, selectionSessionAtom } from "../atoms"
import { SelectionToolbar } from "../index"

// Mock child components
vi.mock("../translate-button", () => ({
  TranslateButton: () => null,
}))

vi.mock("../speak-button", () => ({
  SpeakButton: () => null,
}))

vi.mock("../custom-action-button", () => ({
  SelectionToolbarCustomActionButtons: () => null,
}))

// Mock atoms
vi.mock("@/utils/atoms/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/atoms/config")>()
  return {
    ...actual,
    configFieldsAtomMap: {
      ...actual.configFieldsAtomMap,
      selectionToolbar: atom({
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        opacity: 100,
        features: {
          translate: {
            enabled: true,
            providerId: "google-translate-default",
            shortcut: "Alt+T",
          },
          speak: { enabled: true },
        },
        customActions: [],
      }),
    },
  }
})

const EXTERNAL_PAYLOAD: EbookBridgeSelectionPayload = {
  requestId: "req-1",
  text: "Selected ebook text",
  contextParagraphs: ["Paragraph one", "Paragraph two"],
  rect: { top: 120, left: 40, width: 200, height: 18 },
  anchor: { x: 240, y: 138 },
  direction: "bottom-right",
  bookTitle: "Some Book",
}

async function dispatchExternalOpen(payload: EbookBridgeSelectionPayload) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(EXTERNAL_SELECTION_OPEN_EVENT, { detail: payload }))
  })
}

async function dispatchExternalClear() {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(EXTERNAL_SELECTION_CLEAR_EVENT))
  })
}

function expectToolbarVisible() {
  expect(document.querySelector(".absolute.z-2147483647")).toHaveClass("opacity-100")
}

function expectToolbarHidden() {
  expect(document.querySelector(".absolute.z-2147483647")).toHaveClass("opacity-0")
}

describe("selectionToolbar - external selection source", () => {
  const store = getDefaultStore()

  beforeEach(() => {
    store.set(selectionSessionAtom, null)
    store.set(isSelectionToolbarOpenAtom, false)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows the toolbar and builds a session from the external payload", async () => {
    render(<SelectionToolbar />)

    await dispatchExternalOpen(EXTERNAL_PAYLOAD)
    await waitFor(expectToolbarVisible)

    const session = store.get(selectionSessionAtom)
    expect(session?.selectionSnapshot.text).toBe(EXTERNAL_PAYLOAD.text)
    expect(session?.selectionSnapshot.ranges).toEqual([])
    expect(session?.contextSnapshot.paragraphs).toEqual(EXTERNAL_PAYLOAD.contextParagraphs)
    expect(session?.contextSnapshot.text).toBe(EXTERNAL_PAYLOAD.contextParagraphs.join("\n\n"))
  })

  it("falls back to the selected text when no context paragraphs are provided", async () => {
    render(<SelectionToolbar />)

    await dispatchExternalOpen({ ...EXTERNAL_PAYLOAD, contextParagraphs: [] })
    await waitFor(expectToolbarVisible)

    const session = store.get(selectionSessionAtom)
    expect(session?.contextSnapshot.paragraphs).toEqual([EXTERNAL_PAYLOAD.text])
    expect(session?.contextSnapshot.text).toBe(EXTERNAL_PAYLOAD.text)
  })

  it("repositions repeated selections using top-frame viewport coordinates", async () => {
    vi.spyOn(window, "scrollX", "get").mockReturnValue(100)
    vi.spyOn(window, "scrollY", "get").mockReturnValue(200)
    render(<SelectionToolbar />)

    await dispatchExternalOpen(EXTERNAL_PAYLOAD)

    const toolbar = document.querySelector<HTMLElement>(".absolute.z-2147483647")
    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "240px", top: "158px" })
    })

    await dispatchExternalOpen({
      ...EXTERNAL_PAYLOAD,
      requestId: "req-2",
      anchor: { x: 80, y: 90 },
      direction: "top-left",
    })

    await waitFor(() => {
      expect(toolbar).toHaveStyle({ left: "80px", top: "70px" })
    })
  })

  it("hides the toolbar and clears the session on the external clear event", async () => {
    render(<SelectionToolbar />)

    await dispatchExternalOpen(EXTERNAL_PAYLOAD)
    await waitFor(expectToolbarVisible)

    await dispatchExternalClear()

    expectToolbarHidden()
    expect(store.get(selectionSessionAtom)).toBeNull()
  })
})
