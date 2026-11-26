// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { atom } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useContextMenuReadAloud } from "../use-context-menu-read-aloud"

const { onMessageMock, playMock, TTS_CONFIG } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(...args: any[]) => any>(() => () => {}),
  playMock: vi.fn<(...args: any[]) => Promise<void>>(async () => {}),
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

  it("reads the menu's text when this frame's selection changed after the menu opened", () => {
    render(<Harness />)

    // The menu was opened on "Earlier selection"; the header was selected since.
    readAloudFromContextMenu({ selectionText: "Earlier selection" })

    expect(playMock).toHaveBeenCalledWith("Earlier selection", TTS_CONFIG)
  })

  it("reads this frame's selection without the furigana the menu's text keeps", () => {
    const paragraph = document.createElement("p")
    paragraph.innerHTML = "<ruby>漢字<rt>かんじ</rt></ruby>を読む"
    document.body.replaceChildren(paragraph)
    window.getSelection()?.selectAllChildren(paragraph)
    render(<Harness />)

    readAloudFromContextMenu({ selectionText: "漢字かんじを読む" })

    expect(playMock).toHaveBeenCalledWith("漢字を読む", TTS_CONFIG)
  })

  it("reads this frame's selection, line breaks and all, when the menu's text differs only in whitespace", () => {
    const poem = document.createElement("p")
    poem.style.whiteSpace = "pre-line"
    poem.textContent = "First line\nSecond line"
    document.body.replaceChildren(poem)
    window.getSelection()?.selectAllChildren(poem)
    render(<Harness />)

    readAloudFromContextMenu({ selectionText: "First line Second line" })

    expect(playMock).toHaveBeenCalledWith("First line\nSecond line", TTS_CONFIG)
  })

  it("reads the menu's text, not this frame's selection, for a menu opened in an ebook section", () => {
    render(<Harness />)

    readAloudFromContextMenu({ selectionText: "punched", fromEbookSection: true })

    expect(playMock).toHaveBeenCalledWith("punched", TTS_CONFIG)
  })

  it("absorbs rejected playback promises without emitting unhandledRejection", async () => {
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }
    process.on("unhandledRejection", onUnhandledRejection)

    try {
      playMock.mockRejectedValueOnce(
        new Error(
          "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
        ),
      )
      render(<Harness />)

      readAloudFromContextMenu({ selectionText: "Reader page header" })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(playMock).toHaveBeenCalledWith("Reader page header", TTS_CONFIG)
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off("unhandledRejection", onUnhandledRejection)
    }
  })
})
