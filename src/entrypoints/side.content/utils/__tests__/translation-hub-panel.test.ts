// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { MIN_SIDE_CONTENT_WIDTH } from "@/utils/constants/side"
import { sendMessage } from "@/utils/message"
import { getTranslationHubSidePanelWidth, MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL, openTranslationHubSidePanel } from "../translation-hub-panel"

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path = "") => `chrome-extension://test-extension${path}`,
    },
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1200,
  })
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  })
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

describe("translation hub side panel width", () => {
  it("allows the configured minimum side content width", () => {
    expect(getTranslationHubSidePanelWidth(360, 1200)).toBe(MIN_SIDE_CONTENT_WIDTH)
  })

  it("leaves enough room for the page content", () => {
    expect(getTranslationHubSidePanelWidth(900, 1200)).toBe(1200 - MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL)
  })

  it("uses the browser side panel API when side API mode succeeds", async () => {
    setDesktopViewport()
    vi.mocked(sendMessage).mockResolvedValue({ ok: true, action: "opened" })
    const setHasLoadedTranslationHub = vi.fn()
    const setIsSideOpen = vi.fn()

    openTranslationHubSidePanel({
      setHasLoadedTranslationHub,
      setIsSideOpen,
      splitPanelMode: "sideAPI",
    })
    await Promise.resolve()

    expect(sendMessage).toHaveBeenCalledWith("openTranslationHubBrowserSidePanel", undefined)
    expect(setHasLoadedTranslationHub).not.toHaveBeenCalled()
    expect(setIsSideOpen).not.toHaveBeenCalled()
  })

  it("falls back to the DOM split panel when side API mode is unavailable", async () => {
    setDesktopViewport()
    vi.mocked(sendMessage).mockResolvedValue({ ok: false, reason: "unsupported" })
    const setHasLoadedTranslationHub = vi.fn()
    const setIsSideOpen = vi.fn()

    openTranslationHubSidePanel({
      setHasLoadedTranslationHub,
      setIsSideOpen,
      splitPanelMode: "sideAPI",
    })
    await Promise.resolve()

    expect(setHasLoadedTranslationHub).toHaveBeenCalledWith(true)
    expect(setIsSideOpen).toHaveBeenCalledWith(true)
  })
})
