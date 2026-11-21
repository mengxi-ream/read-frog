// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { atom } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useContextMenuReadAloud } from "../use-context-menu-read-aloud"

const { onMessageMock, playMock, TTS_CONFIG } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(...args: any[]) => any>(() => () => {}),
  playMock: vi.fn<(...args: any[]) => any>(),
  TTS_CONFIG: { provider: "test" },
}))

vi.mock("@/utils/message", () => ({
  onMessage: (...args: unknown[]) => onMessageMock(...args),
}))

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({ play: playMock }),
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { tts: atom(TTS_CONFIG) },
}))

function Harness() {
  useContextMenuReadAloud()
  return null
}

function readAloudFromContextMenu(data: { selectionText: string; fromEbookSection?: boolean }) {
  const registration = onMessageMock.mock.calls.findLast(
    (call) => call[0] === "readAloudSelectionFromContextMenu",
  )
  if (!registration) {
    throw new Error("Read aloud message handler not registered")
  }
  ;(registration[1] as (message: { data: typeof data }) => void)({ data })
}

describe("useContextMenuReadAloud", () => {
  beforeEach(() => {
    // Text selected in this frame, such as the reader page's header.
    const paragraph = document.createElement("p")
    paragraph.textContent = "Reader page header"
    document.body.append(paragraph)
    window.getSelection()?.selectAllChildren(paragraph)
  })

  afterEach(() => {
    cleanup()
    window.getSelection()?.removeAllRanges()
    document.body.replaceChildren()
    vi.clearAllMocks()
  })

  it("reads this frame's own selection for a menu opened in this frame", () => {
    render(<Harness />)

    readAloudFromContextMenu({ selectionText: "Reader page header" })

    expect(playMock).toHaveBeenCalledWith("Reader page header", TTS_CONFIG)
  })

  it("reads the menu's text, not this frame's selection, for a menu opened in an ebook section", () => {
    render(<Harness />)

    readAloudFromContextMenu({ selectionText: "punched", fromEbookSection: true })

    expect(playMock).toHaveBeenCalledWith("punched", TTS_CONFIG)
  })
})
